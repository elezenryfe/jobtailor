import re
import json
import hashlib
import logging
import pdfplumber
from openai import OpenAI, APIError, RateLimitError
from ..config import settings
from .llm_utils import log_tokens

logger = logging.getLogger(__name__)

# Pre-compiled regex for PII extraction
_RE_EMAIL = re.compile(r'[\w\.-]+@[\w\.-]+\.\w+')
_RE_PHONE = re.compile(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}')
_RE_URL = re.compile(r'https?://[^\s]+')
_RE_PAGE_NUM = re.compile(r'^\d+$', re.MULTILINE)
_RE_DIVIDER = re.compile(r'[=\-*_]{4,}')
_RE_MULTI_NEWLINE = re.compile(r'\n{3,}')
_RE_MULTI_SPACE = re.compile(r' {2,}')


def _clean_raw_text(text: str) -> str:
    """Strip noise from raw PDF text before sending to LLM."""
    # Remove URLs
    text = _RE_URL.sub('', text)
    # Remove ASCII dividers
    text = _RE_DIVIDER.sub('', text)
    # Remove standalone page numbers
    text = _RE_PAGE_NUM.sub('', text)
    # Collapse whitespace
    text = _RE_MULTI_NEWLINE.sub('\n\n', text)
    text = _RE_MULTI_SPACE.sub(' ', text)
    return text.strip()


def _pre_extract_pii(text: str) -> dict:
    """Extract email and phone via regex before LLM call."""
    pii = {}
    email_match = _RE_EMAIL.search(text)
    if email_match:
        pii["email"] = email_match.group()
        text = text.replace(pii["email"], "[EMAIL_REDACTED]")
    phone_match = _RE_PHONE.search(text)
    if phone_match:
        pii["phone"] = phone_match.group().strip()
    return pii


def extract_text_from_pdf(filepath: str) -> str:
    """Extract and clean raw text from a PDF file."""
    try:
        with pdfplumber.open(filepath) as pdf:
            text = ""
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return _clean_raw_text(text)
    except Exception as e:
        logger.error(f"Failed to extract text from PDF {filepath}: {e}")
        raise RuntimeError(f"PDF extraction failed: {e}")


def structure_resume_with_ai(raw_text: str) -> dict:
    """Parse resume raw text into structured JSON using DeepSeek or Ollama."""

    # Pre-extract PII
    pii = _pre_extract_pii(raw_text)

    system_prompt = (
        "Parse this resume text and return valid JSON with these fields: "
        'full_name, email, phone, summary, '
        'experience[{title, company, dates, bullets}], '
        'education[{degree, school, year}], '
        'skills[string], certifications[{name, year}]. '
        "Missing fields → null or []. Return ONLY JSON."
    )

    # Dedup: hash raw text, check if any user already parsed identical text
    text_hash = hashlib.sha256(raw_text.encode()).hexdigest()
    try:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import Session
        from ..database import SessionLocal
        db = SessionLocal()
        try:
            from ..models import Resume
            cached = db.query(Resume).filter(
                Resume.structured_data.isnot(None)
            ).order_by(Resume.id.desc()).limit(20).all()
            for r in cached:
                if r.structured_data and isinstance(r.structured_data, dict):
                    cached_hash = hashlib.sha256(
                        json.dumps(r.structured_data, sort_keys=True).encode()
                    ).hexdigest()
                    # We can't fully dedup here without storing the raw text hash.
                    # Skip this lightweight check for simplicity; the router layer
                    # handles real caching via the DB record already being present.
        finally:
            db.close()
    except Exception:
        pass  # dedup is best-effort

    # ---------- Ollama path ----------
    if settings.DEEPSEEK_API_KEY == "ollama":
        from ollama import chat
        logger.info("Using Ollama for resume parsing...")
        try:
            response = chat(
                model="llama3.1:8b",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": raw_text},
                ],
                format="json",
            )
            log_tokens(response, "resume_parse")
            content = response["message"]["content"]
            structured = json.loads(content)
        except Exception as e:
            logger.error(f"Ollama call failed: {e}")
            raise RuntimeError("Resume parsing via Ollama failed.")
    # ---------- DeepSeek path ----------
    else:
        client = OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
        try:
            logger.info("Calling DeepSeek to parse resume text...")
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": raw_text},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=2000,
            )
            log_tokens(response, "resume_parse")
            content = response.choices[0].message.content
            structured = json.loads(content)
        except RateLimitError as e:
            logger.error(f"DeepSeek rate limit: {e}")
            raise RuntimeError("AI service is temporarily overloaded.")
        except APIError as e:
            logger.error(f"DeepSeek API error: {e}")
            raise RuntimeError("AI service call failed.")
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from AI: {content}")
            raise RuntimeError("Failed to parse AI response.")

    # Merge pre-extracted PII back (regex extraction is more reliable)
    if pii.get("email") and not structured.get("email"):
        structured["email"] = pii["email"]
    if pii.get("phone") and not structured.get("phone"):
        structured["phone"] = pii["phone"]

    # Ensure all fields exist
    defaults = {
        "full_name": None, "email": None, "phone": None, "summary": None,
        "experience": [], "education": [], "skills": [], "certifications": [],
    }
    for field, default in defaults.items():
        if field not in structured:
            structured[field] = default

    return structured
