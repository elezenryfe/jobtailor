import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import models, schemas, auth, database
from ..services.skills_gap import analyze_skills_gap, generate_gap_suggestions
from ..services.llm_utils import check_rate_limit

router = APIRouter(prefix="/api/gap-analyzer", tags=["gap-analyzer"])
logger = logging.getLogger(__name__)


@router.get("/analyze", response_model=schemas.GapAnalysisResponse)
def analyze(
    resume_id: int = Query(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    resume = db.query(models.Resume).filter(
        models.Resume.id == resume_id,
        models.Resume.user_id == current_user.id,
    ).first()
    if not resume:
        raise HTTPException(404, "Resume not found")

    if not check_rate_limit(current_user.id):
        raise HTTPException(429, "Too many requests. Please wait a moment.")

    structured = resume.structured_data
    if not structured or not isinstance(structured, dict):
        raise HTTPException(400, "Resume has no structured data. Upload and parse a resume first.")

    skills = structured.get("skills")
    if not skills or not isinstance(skills, list) or len(skills) == 0:
        raise HTTPException(400, "Resume has no skills listed. Re-upload a resume with skills data.")

    # Fetch 10 most recent job descriptions
    job_descriptions = [
        j.job_description
        for j in db.query(models.Job)
        .filter(models.Job.user_id == current_user.id, models.Job.job_description.isnot(None))
        .order_by(models.Job.created_at.desc())
        .limit(10)
        .all()
        if j.job_description
    ]
    if not job_descriptions:
        raise HTTPException(400, "No job descriptions found. Add jobs with descriptions on the Job Board first.")

    try:
        return analyze_skills_gap(skills, job_descriptions)
    except Exception as e:
        logger.error(f"Skills gap analysis failed: {e}")
        raise HTTPException(500, "Failed to analyze skills gap.")


@router.get("/suggestions", response_model=schemas.GapSuggestionsResponse)
def suggestions(
    resume_id: int = Query(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    resume = db.query(models.Resume).filter(
        models.Resume.id == resume_id,
        models.Resume.user_id == current_user.id,
    ).first()
    if not resume:
        raise HTTPException(404, "Resume not found")

    structured = resume.structured_data
    if not structured or not isinstance(structured, dict):
        return {"suggestions": []}

    skills = structured.get("skills", [])
    if not isinstance(skills, list):
        skills = []

    job_descriptions = [
        j.job_description
        for j in db.query(models.Job)
        .filter(models.Job.user_id == current_user.id, models.Job.job_description.isnot(None))
        .all()
        if j.job_description
    ]

    if not skills or not job_descriptions:
        return {"suggestions": []}

    analysis = analyze_skills_gap(skills, job_descriptions)
    missing = analysis.get("missing", [])[:5]
    if not missing:
        return {"suggestions": []}

    try:
        result = generate_gap_suggestions(skills, missing, job_descriptions)
    except Exception as e:
        logger.error(f"Gap suggestions failed: {e}")
        return {"suggestions": []}

    return {"suggestions": result}
