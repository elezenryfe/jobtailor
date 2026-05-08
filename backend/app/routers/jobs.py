import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import models, schemas, auth, database

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
logger = logging.getLogger(__name__)


@router.post("/", response_model=schemas.JobOut)
def create_job(
    req: schemas.JobCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    job = models.Job(
        user_id=current_user.id,
        job_title=req.job_title,
        company=req.company,
        job_description=req.job_description,
        job_url=req.job_url,
        notes=req.notes,
        resume_id=req.resume_id,
        stage=req.stage.value if req.stage else models.JobStage.SAVED.value,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    logger.info(f"Job created by user {current_user.email}: {job.job_title} at {job.company}")
    return job


@router.get("/", response_model=List[schemas.JobOut])
def list_jobs(
    stage: Optional[str] = Query(None),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    q = db.query(models.Job).filter(models.Job.user_id == current_user.id)
    if stage:
        q = q.filter(models.Job.stage == stage)
    return q.order_by(models.Job.updated_at.desc()).all()


@router.get("/{job_id}", response_model=schemas.JobOut)
def get_job(
    job_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    job = db.query(models.Job).filter(
        models.Job.id == job_id, models.Job.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.patch("/{job_id}", response_model=schemas.JobOut)
def update_job(
    job_id: int,
    req: schemas.JobUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    job = db.query(models.Job).filter(
        models.Job.id == job_id, models.Job.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(404, "Job not found")

    update_data = req.model_dump(exclude_unset=True)
    if "stage" in update_data and update_data["stage"] is not None:
        update_data["stage"] = update_data["stage"].value

    for field, value in update_data.items():
        if value is not None:
            setattr(job, field, value)

    db.commit()
    db.refresh(job)
    logger.info(f"Job {job_id} updated by user {current_user.email}")
    return job


@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    job = db.query(models.Job).filter(
        models.Job.id == job_id, models.Job.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(404, "Job not found")
    db.delete(job)
    db.commit()
    logger.info(f"Job {job_id} deleted by user {current_user.email}")
    return {"ok": True}
