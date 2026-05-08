import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, auth, database
from ..services import interview_coach
from ..services.llm_utils import check_rate_limit, hash_text

router = APIRouter(prefix="/api/interview", tags=["interview"])
logger = logging.getLogger(__name__)


@router.post("/generate", response_model=schemas.InterviewPrepOut)
def generate_questions(
    req: schemas.GenerateQuestionsRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    job_title = ""
    company = ""
    job_desc = ""

    if req.job_id:
        job = db.query(models.Job).filter(
            models.Job.id == req.job_id,
            models.Job.user_id == current_user.id,
        ).first()
        if not job:
            raise HTTPException(404, "Job not found")
        job_desc = job.job_description or ""
        job_title = job.job_title
        company = job.company
    elif req.job_description:
        job_desc = req.job_description
    else:
        raise HTTPException(400, "Provide either a job_id or a job_description")

    if not job_desc or not job_desc.strip():
        raise HTTPException(400, "Job description is empty")

    # Rate limit
    if not check_rate_limit(current_user.id):
        raise HTTPException(429, "Too many requests. Please wait a moment.")

    count = getattr(req, "count", 3)

    # Dedup check: same user + same JD + same count
    dedup_key = hash_text(f"{job_desc}|{count}")
    cached = db.query(models.InterviewPrep).filter(
        models.InterviewPrep.user_id == current_user.id,
    ).order_by(models.InterviewPrep.created_at.desc()).limit(10).all()
    for prep in cached:
        if prep.job_description and hash_text(f"{prep.job_description}|{count}") == dedup_key:
            logger.info(f"Dedup hit: returning cached interview prep {prep.id} (count={count})")
            return prep

    try:
        questions = interview_coach.generate_questions(job_desc, job_title, company, count=count)
    except RuntimeError as e:
        raise HTTPException(500, detail=str(e))

    record = models.InterviewPrep(
        user_id=current_user.id,
        job_id=req.job_id,
        job_description=job_desc,
        job_title=job_title,
        company=company,
        questions=questions,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    logger.info(f"Interview questions generated for user {current_user.email}")
    return record


@router.post("/evaluate", response_model=schemas.EvaluateAnswerResponse)
def evaluate_answer(
    req: schemas.EvaluateAnswerRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    try:
        result = interview_coach.evaluate_answer(req.question, req.answer, req.context)
    except RuntimeError as e:
        raise HTTPException(500, detail=str(e))
    return result


@router.get("/history", response_model=List[schemas.InterviewPrepOut])
def list_history(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    return (
        db.query(models.InterviewPrep)
        .filter(models.InterviewPrep.user_id == current_user.id)
        .order_by(models.InterviewPrep.created_at.desc())
        .all()
    )
