import os
import logging
from typing import List
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, auth, database
from ..services.resume_parser import extract_text_from_pdf, structure_resume_with_ai
from ..services.llm_utils import check_rate_limit
from ..config import settings

router = APIRouter(prefix="/api/resume", tags=["resume"])
logger = logging.getLogger(__name__)

@router.post("/upload", response_model=schemas.ResumeUploadOut)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(400, "Only PDF files are allowed")
    
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    # Store under user subdirectory to avoid name collisions
    user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    file_path = os.path.join(user_dir, file.filename)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Extract text
    try:
        raw_text = extract_text_from_pdf(file_path)
    except RuntimeError as e:
        raise HTTPException(500, detail=str(e))
    
    if not raw_text:
        raise HTTPException(400, "Could not extract any text from the PDF; it may be scanned or contain no text.")
    
    # Rate limit
    if not check_rate_limit(current_user.id):
        raise HTTPException(429, "Too many requests. Please wait a moment.")

    # Structure with AI (PII redacted, injected from profile)
    try:
        structured = structure_resume_with_ai(raw_text, db=db, user_id=current_user.id, profile_name=current_user.name, profile_email=current_user.email)
    except RuntimeError as e:
        raise HTTPException(500, detail=str(e))
    
    resume_record = models.Resume(
        user_id=current_user.id,
        original_filename=file.filename,
        original_filepath=file_path,
        structured_data=structured
    )
    db.add(resume_record)
    db.commit()
    db.refresh(resume_record)
    logger.info(f"Resume uploaded by user {current_user.email}: {file.filename}")
    return resume_record

@router.get("/list", response_model=List[schemas.ResumeUploadOut])
def list_resumes(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    resumes = db.query(models.Resume).filter(
        models.Resume.user_id == current_user.id
    ).order_by(models.Resume.created_at.desc()).all()
    return resumes


@router.delete("/{resume_id}")
def delete_resume(
    resume_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    resume = db.query(models.Resume).filter(
        models.Resume.id == resume_id,
        models.Resume.user_id == current_user.id
    ).first()
    if not resume:
        raise HTTPException(404, "Resume not found")

    # Delete associated tailored documents
    db.query(models.TailoredDocument).filter(
        models.TailoredDocument.resume_id == resume_id
    ).delete()

    # Delete the PDF file from disk
    if resume.original_filepath and os.path.exists(resume.original_filepath):
        try:
            os.remove(resume.original_filepath)
        except OSError:
            logger.warning(f"Could not delete file: {resume.original_filepath}")

    db.delete(resume)
    db.commit()
    logger.info(f"Resume {resume_id} deleted by user {current_user.email}")
    return {"detail": "Resume deleted"}