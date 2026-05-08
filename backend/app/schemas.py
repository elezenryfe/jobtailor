from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

# Request sent from frontend after Google sign-in
class GoogleAuthRequest(BaseModel):
    credential: str   # the ID token from Google

# Our JWT token response
class Token(BaseModel):
    access_token: str
    token_type: str

class UserOut(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    class Config:
        from_attributes = True

class ResumeUploadOut(BaseModel):
    id: int
    original_filename: str
    structured_data: dict
    created_at: datetime
    class Config:
        from_attributes = True

class TailorRequest(BaseModel):
    resume_id: int
    job_description: str
    mode: str = "both"  # "both" | "resume" | "cover_letter"

class TailorResponse(BaseModel):
    id: int
    tailored_resume_json: dict
    cover_letter_text: str
    resume_pdf_url: Optional[str] = None
    cover_letter_pdf_url: Optional[str] = None

# ----- Job Schemas -----

class JobStageEnum(str, Enum):
    SAVED = "Saved"
    APPLIED = "Applied"
    PHONE_SCREEN = "Phone Screen"
    ONSITE = "Onsite"
    OFFER = "Offer"
    REJECTED = "Rejected"

class JobCreate(BaseModel):
    job_title: str
    company: str
    job_description: Optional[str] = None
    job_url: Optional[str] = None
    notes: Optional[str] = None
    resume_id: Optional[int] = None
    stage: JobStageEnum = JobStageEnum.SAVED

class JobUpdate(BaseModel):
    job_title: Optional[str] = None
    company: Optional[str] = None
    job_description: Optional[str] = None
    job_url: Optional[str] = None
    notes: Optional[str] = None
    resume_id: Optional[int] = None
    stage: Optional[JobStageEnum] = None

class JobOut(BaseModel):
    id: int
    user_id: int
    resume_id: Optional[int] = None
    job_title: str
    company: str
    job_description: Optional[str] = None
    job_url: Optional[str] = None
    notes: Optional[str] = None
    stage: str
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# ----- Analytics Schemas -----

class FunnelEntry(BaseModel):
    stage: str
    count: int

class TimelineEntry(BaseModel):
    period: str
    count: int

class KeywordEntry(BaseModel):
    word: str
    count: int

class TimeInStageEntry(BaseModel):
    stage: str
    avg_days: float

class CompanyPipelineEntry(BaseModel):
    company: str
    stages: dict

class AnalyticsResponse(BaseModel):
    funnel: List[FunnelEntry]
    timeline: List[TimelineEntry]
    keywords: List[KeywordEntry]
    time_in_stage: List[TimeInStageEntry]
    company_pipeline: List[CompanyPipelineEntry]

# ----- Skills Gap Analyzer Schemas -----

class GapRadarPoint(BaseModel):
    skill: str
    demandCount: int
    hasIt: bool

class GapAnalysisResponse(BaseModel):
    matching: List[str]
    missing: List[str]
    extra: List[str]
    matchScore: float
    radarData: List[GapRadarPoint]
    totalSkillsOnResume: int
    totalDemandedSkills: int

class GapSuggestion(BaseModel):
    skill: str
    category: str
    title: str
    description: str
    url: Optional[str] = None

class GapSuggestionsResponse(BaseModel):
    suggestions: List[GapSuggestion]

# ----- Interview Prep Schemas -----

class GenerateQuestionsRequest(BaseModel):
    job_id: Optional[int] = None
    job_description: Optional[str] = None
    count: int = 3  # Number of technical + role-specific questions per category

class QuestionItem(BaseModel):
    id: str
    question: str
    guidance: str

class QuestionSet(BaseModel):
    behavioral: List[QuestionItem]
    technical: List[QuestionItem]
    role_specific: List[QuestionItem]

class InterviewPrepOut(BaseModel):
    id: int
    job_id: Optional[int] = None
    job_title: Optional[str] = None
    company: Optional[str] = None
    questions: QuestionSet
    created_at: datetime
    class Config:
        from_attributes = True

class EvaluateAnswerRequest(BaseModel):
    question: str
    answer: str
    context: str

class EvaluateAnswerResponse(BaseModel):
    clarity: str
    star_structure: str
    relevance: str
    feedback: str
    overall_score: int