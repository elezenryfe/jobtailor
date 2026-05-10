import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

class JobStage(str, enum.Enum):
    SAVED = "Saved"
    APPLIED = "Applied"
    PHONE_SCREEN = "Phone Screen"
    ONSITE = "Onsite"
    OFFER = "Offer"
    REJECTED = "Rejected"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    google_sub = Column(String, unique=True, index=True, nullable=False)  # Google account unique ID
    name = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Resume(Base):
    __tablename__ = "resumes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    original_filename = Column(String)
    original_filepath = Column(String)
    structured_data = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())
    user = relationship("User")

class TailoredDocument(Base):
    __tablename__ = "tailored_documents"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    resume_id = Column(Integer, ForeignKey("resumes.id"))
    job_description = Column(Text)
    job_title = Column(String, nullable=True)
    company = Column(String, nullable=True)
    mode = Column(String, nullable=True, default="both")  # "both" | "resume" | "cover_letter"
    tailored_resume_json = Column(JSON)
    cover_letter_text = Column(Text)
    resume_pdf_path = Column(String)
    cover_letter_pdf_path = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    user = relationship("User")
    resume = relationship("Resume")

class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=True)
    job_title = Column(String, nullable=False)
    company = Column(String, nullable=False)
    job_description = Column(Text, nullable=True)
    job_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    stage = Column(String, default=JobStage.SAVED.value, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    user = relationship("User", backref="jobs")
    resume = relationship("Resume", backref="jobs")

class InterviewPrep(Base):
    __tablename__ = "interview_preps"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)
    job_description = Column(Text, nullable=False)
    job_title = Column(String, nullable=True)
    company = Column(String, nullable=True)
    questions = Column(JSON, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    user = relationship("User")
    job = relationship("Job")

class LLMCallLog(Base):
    __tablename__ = "llm_call_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    call_name = Column(String, nullable=False)       # e.g. "resume_parse", "tailor_resume"
    model = Column(String, nullable=False)             # e.g. "deepseek-v4-flash", "llama3.1:8b"
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    user = relationship("User")