import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, auth, database
from ..services.job_search import search_jobs

router = APIRouter(prefix="/api/job-search", tags=["job_search"])
logger = logging.getLogger(__name__)


@router.post("/search", response_model=schemas.JobSearchResponse)
def search(
    params: schemas.JobSearchParams,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    try:
        logger.info(
            "Job search by user %s: keywords=%s page=%d",
            current_user.email,
            params.keywords,
            params.page,
        )
        return search_jobs(params)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
