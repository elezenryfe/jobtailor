import logging
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, resume, tailor, jobs, analytics, gap_analyzer, interview
from .config import settings

# Configure logging
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="JobSort")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["localhost:3000", "http://localhost:3000", "localhost:5173", "http://localhost:5173","http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file mount for generated PDFs
generated_dir = os.path.join(settings.UPLOAD_DIR, "generated")
os.makedirs(generated_dir, exist_ok=True)
app.mount("/api/files", StaticFiles(directory=generated_dir), name="files")

# Routers
app.include_router(auth.router)
app.include_router(resume.router)
app.include_router(tailor.router)
app.include_router(jobs.router)
app.include_router(analytics.router)
app.include_router(gap_analyzer.router)
app.include_router(interview.router)

@app.get("/")
def root():
    return {"message": "JobSort API is running"}