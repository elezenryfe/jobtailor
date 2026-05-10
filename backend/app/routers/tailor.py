import os
import hashlib
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, auth, database
from ..services.ai_tailor import run_tailor_and_cover_parallel, tailor_resume, generate_cover_letter
from ..services.pdf_generator import generate_resume_pdf, generate_cover_letter_pdf
from ..services.llm_utils import check_rate_limit, hash_text
from ..config import settings

router = APIRouter(prefix="/api/tailor", tags=["tailor"])
logger = logging.getLogger(__name__)
from pydantic import BaseModel

class TestPDFRequest(BaseModel):
    resume_id: int

class RegeneratePDFRequest(BaseModel):
    tailored_resume_json: dict
    cover_letter_text: str = ""
    mode: str = "both"  # "both" | "resume" | "cover_letter"

@router.post("/test-pdf", response_model=schemas.TailorResponse)
def test_pdf(
    req: TestPDFRequest,      # ← reads from JSON body
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    """Return PDFs from the stored resume JSON without any AI calls."""
    resume = db.query(models.Resume).filter(
        models.Resume.id == req.resume_id,
        models.Resume.user_id == current_user.id
    ).first()
    if not resume:
        raise HTTPException(404, "Resume not found")

    structured = resume.structured_data
    # Use the exact same resume JSON as the "tailored" one (no changes)
    tailored_resume_json = structured
    cover_letter_text = f"Cover letter for {structured.get('full_name', 'the candidate')}.\n\nPlaceholder – replace with real AI generation."

    # Generate PDFs
    output_dir = os.path.join(settings.UPLOAD_DIR, "generated", str(current_user.id))
    try:
        resume_pdf_path = generate_resume_pdf(tailored_resume_json, output_dir)
        cover_pdf_path = generate_cover_letter_pdf(cover_letter_text, tailored_resume_json.get("full_name", "Candidate"), output_dir)
    except RuntimeError as e:
        raise HTTPException(500, detail=str(e))

    # Save dummy record
    doc = models.TailoredDocument(
        user_id=current_user.id,
        resume_id=resume.id,
        job_description="TEST PDF – no AI",
        job_title="",
        company="",
        mode="both",
        tailored_resume_json=tailored_resume_json,
        cover_letter_text=cover_letter_text,
        resume_pdf_path=resume_pdf_path,
        cover_letter_pdf_path=cover_pdf_path,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    base_url = f"/api/files/{current_user.id}/"
    return schemas.TailorResponse(
        id=doc.id,
        tailored_resume_json=doc.tailored_resume_json,
        cover_letter_text=doc.cover_letter_text,
        resume_pdf_url=base_url + os.path.basename(resume_pdf_path),
        cover_letter_pdf_url=base_url + os.path.basename(cover_pdf_path),
    )
    
@router.post("/", response_model=schemas.TailorResponse)
def create_tailored_documents(
    req: schemas.TailorRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    # Fetch the resume
    resume = db.query(models.Resume).filter(
        models.Resume.id == req.resume_id,
        models.Resume.user_id == current_user.id
    ).first()
    if not resume:
        raise HTTPException(404, "Resume not found")
    
    mode = getattr(req, "mode", "both")

    # Helper: find cached document by mode
    def _find_cached(mode_filter):
        dedup_key = hash_text(f"{req.job_description}|{mode_filter}")
        docs = db.query(models.TailoredDocument).filter(
            models.TailoredDocument.user_id == current_user.id,
            models.TailoredDocument.resume_id == req.resume_id,
            models.TailoredDocument.mode == mode_filter,
        ).order_by(models.TailoredDocument.created_at.desc()).limit(3).all()
        for d in docs:
            if d.job_description and hash_text(f"{d.job_description}|{mode_filter}") == dedup_key:
                return d
        return None

    # 1. Exact-mode cache hit → return immediately (no AI, no PDF regeneration)
    exact = _find_cached(mode)
    if exact:
        logger.info(f"Dedup hit: returning cached tailored document {exact.id} (mode={mode})")
        base_url = f"/api/files/{current_user.id}/"
        return schemas.TailorResponse(
            id=exact.id,
            tailored_resume_json=exact.tailored_resume_json,
            cover_letter_text=exact.cover_letter_text or "",
            resume_pdf_url=base_url + os.path.basename(exact.resume_pdf_path) if exact.resume_pdf_path else None,
            cover_letter_pdf_url=base_url + os.path.basename(exact.cover_letter_pdf_path) if exact.cover_letter_pdf_path else None,
        )

    # 2. Cross-mode cache: reuse content from other modes, only call LLM for what's missing
    tailored_resume_json = resume.structured_data  # default: original (for cover_letter-only)
    cover_letter_text = ""
    needs_resume_llm = False
    needs_cover_llm = False

    if mode == "both":
        cache_resume = _find_cached("resume")
        cache_cover = _find_cached("cover_letter")
        # Also check "both" cache as a source for either half
        cache_both = _find_cached("both")

        if cache_resume:
            tailored_resume_json = cache_resume.tailored_resume_json
            logger.info(f"Cross-mode: reusing resume from cached 'resume' doc {cache_resume.id}")
        elif cache_both:
            tailored_resume_json = cache_both.tailored_resume_json
            logger.info(f"Cross-mode: reusing resume from cached 'both' doc {cache_both.id}")
        else:
            needs_resume_llm = True

        if cache_cover:
            cover_letter_text = cache_cover.cover_letter_text
            logger.info(f"Cross-mode: reusing cover letter from cached 'cover_letter' doc {cache_cover.id}")
        elif cache_both:
            cover_letter_text = cache_both.cover_letter_text
            logger.info(f"Cross-mode: reusing cover letter from cached 'both' doc {cache_both.id}")
        else:
            needs_cover_llm = True

    elif mode == "resume":
        cache_both = _find_cached("both")
        if cache_both:
            tailored_resume_json = cache_both.tailored_resume_json
            logger.info(f"Cross-mode: reusing resume from cached 'both' doc {cache_both.id}")
        else:
            needs_resume_llm = True

    elif mode == "cover_letter":
        cache_both = _find_cached("both")
        if cache_both:
            cover_letter_text = cache_both.cover_letter_text
            logger.info(f"Cross-mode: reusing cover letter from cached 'both' doc {cache_both.id}")
        else:
            needs_cover_llm = True

    # 3. Rate limit only when LLM calls are actually needed
    if needs_resume_llm or needs_cover_llm:
        if not check_rate_limit(current_user.id):
            raise HTTPException(429, "Too many requests. Please wait a moment and try again.")

    # 4. Make only the needed LLM calls
    try:
        if needs_resume_llm and needs_cover_llm:
            tailored_resume_json, cover_letter_text = run_tailor_and_cover_parallel(
                resume.structured_data, req.job_description, "both", db=db, user_id=current_user.id
            )
        elif needs_resume_llm:
            tailored_resume_json = tailor_resume(resume.structured_data, req.job_description, db=db, user_id=current_user.id)
        elif needs_cover_llm:
            cover_letter_text = generate_cover_letter(resume.structured_data, req.job_description, db=db, user_id=current_user.id)
    except RuntimeError as e:
        raise HTTPException(500, detail=str(e))

    # 5. Generate PDFs
    output_dir = os.path.join(settings.UPLOAD_DIR, "generated", str(current_user.id))
    resume_pdf_path = ""
    cover_pdf_path = ""
    try:
        if mode in ("both", "resume"):
            resume_pdf_path = generate_resume_pdf(tailored_resume_json, output_dir)
        if mode in ("both", "cover_letter"):
            cover_pdf_path = generate_cover_letter_pdf(cover_letter_text, tailored_resume_json.get("full_name", "Candidate"), output_dir)
    except RuntimeError as e:
        raise HTTPException(500, detail=str(e))

    # 6. Save record
    doc = models.TailoredDocument(
        user_id=current_user.id,
        resume_id=resume.id,
        job_description=req.job_description,
        job_title="",
        company="",
        mode=mode,
        tailored_resume_json=tailored_resume_json,
        cover_letter_text=cover_letter_text,
        resume_pdf_path=resume_pdf_path,
        cover_letter_pdf_path=cover_pdf_path
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    base_url = f"/api/files/{current_user.id}/"
    return schemas.TailorResponse(
        id=doc.id,
        tailored_resume_json=doc.tailored_resume_json,
        cover_letter_text=doc.cover_letter_text,
        resume_pdf_url=base_url + os.path.basename(resume_pdf_path) if resume_pdf_path else None,
        cover_letter_pdf_url=base_url + os.path.basename(cover_pdf_path) if cover_pdf_path else None,
    )


@router.post("/regenerate-pdf", response_model=schemas.TailorResponse)
def regenerate_pdf(
    req: RegeneratePDFRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    """Re-generate PDF(s) from edited resume JSON / cover letter text without AI calls."""
    output_dir = os.path.join(settings.UPLOAD_DIR, "generated", str(current_user.id))
    resume_pdf_path = ""
    cover_pdf_path = ""

    try:
        if req.mode in ("both", "resume"):
            resume_pdf_path = generate_resume_pdf(req.tailored_resume_json, output_dir)
        if req.mode in ("both", "cover_letter"):
            cover_pdf_path = generate_cover_letter_pdf(
                req.cover_letter_text,
                req.tailored_resume_json.get("full_name", "Candidate"),
                output_dir,
            )
    except RuntimeError as e:
        raise HTTPException(500, detail=str(e))

    base_url = f"/api/files/{current_user.id}/"
    return schemas.TailorResponse(
        id=0,  # not tied to a DB record
        tailored_resume_json=req.tailored_resume_json,
        cover_letter_text=req.cover_letter_text,
        resume_pdf_url=base_url + os.path.basename(resume_pdf_path) if resume_pdf_path else None,
        cover_letter_pdf_url=base_url + os.path.basename(cover_pdf_path) if cover_pdf_path else None,
    )