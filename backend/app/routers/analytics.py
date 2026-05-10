import logging
from typing import List, Optional
from collections import defaultdict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from .. import models, schemas, auth, database
from ..services.keyword_extractor import extract_keywords

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)


def _get_user_jobs(db: Session, user_id: int):
    return db.query(models.Job).filter(models.Job.user_id == user_id)


@router.get("/funnel", response_model=List[schemas.FunnelEntry])
def funnel(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    rows = (
        _get_user_jobs(db, current_user.id)
        .with_entities(models.Job.stage, sa_func.count(models.Job.id))
        .group_by(models.Job.stage)
        .all()
    )
    stage_order = {s.value: i for i, s in enumerate(models.JobStage)}
    result = [{"stage": stage, "count": count} for stage, count in rows]
    result.sort(key=lambda x: stage_order.get(x["stage"], 99))
    return result


@router.get("/timeline", response_model=List[schemas.TimelineEntry])
def timeline(
    group_by: str = Query("week", regex="^(week|month)$"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    jobs = (
        _get_user_jobs(db, current_user.id)
        .filter(models.Job.stage != models.JobStage.SAVED.value)
        .all()
    )
    buckets = defaultdict(int)
    for job in jobs:
        if group_by == "week":
            period = job.created_at.strftime("%Y-W%W")
        else:
            period = job.created_at.strftime("%Y-%m")
        buckets[period] += 1
    return [{"period": p, "count": c} for p, c in sorted(buckets.items())]


@router.get("/keywords", response_model=List[schemas.KeywordEntry])
def keywords(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    # Limit to 10 most recent JDs for token efficiency
    jobs = (
        _get_user_jobs(db, current_user.id)
        .filter(models.Job.job_description.isnot(None))
        .order_by(models.Job.created_at.desc())
        .limit(10)
        .all()
    )
    descriptions = [j.job_description for j in jobs if j.job_description]
    if not descriptions:
        return []
    result = extract_keywords(descriptions, db=db, user_id=current_user.id)
    return result


@router.get("/time-in-stage", response_model=List[schemas.TimeInStageEntry])
def time_in_stage(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    jobs = _get_user_jobs(db, current_user.id).all()
    if not jobs:
        return []

    from datetime import datetime as dt
    now = dt.utcnow()
    stage_days = defaultdict(list)
    for job in jobs:
        days = (now - job.created_at).total_seconds() / 86400
        stage_days[job.stage].append(max(days, 0))

    stage_order = {s.value: i for i, s in enumerate(models.JobStage)}
    result = [
        {"stage": stage, "avg_days": round(sum(days) / len(days), 1)}
        for stage, days in stage_days.items()
    ]
    result.sort(key=lambda x: stage_order.get(x["stage"], 99))
    return result


@router.get("/company-pipeline", response_model=List[schemas.CompanyPipelineEntry])
def company_pipeline(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    rows = (
        _get_user_jobs(db, current_user.id)
        .with_entities(models.Job.company, models.Job.stage, sa_func.count(models.Job.id))
        .group_by(models.Job.company, models.Job.stage)
        .all()
    )
    pipeline = defaultdict(dict)
    for company, stage, count in rows:
        pipeline[company][stage] = count
    return [{"company": c, "stages": s} for c, s in sorted(pipeline.items())]
