import re
import json
import hashlib
import logging
import pdfplumber
from openai import OpenAI, APIError, RateLimitError
from ..config import settings
from .llm_utils import log_tokens

logger = logging.getLogger(__name__)

# Pre-compiled regex for text cleaning and PII redaction
_RE_EMAIL = re.compile(r'[\w\.-]+@[\w\.-]+\.\w+')
_RE_PHONE = re.compile(
    r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
    r'|(?:\d{3}[-.\s]){2}\d{4}'
    r'|\(\d{3}\)\s*\d{3}[-.\s]?\d{4}'
)
_RE_PAGE_NUM = re.compile(r'^\d+$', re.MULTILINE)
_RE_DIVIDER = re.compile(r'[=\-*_]{4,}')
_RE_MULTI_NEWLINE = re.compile(r'\n{3,}')
_RE_MULTI_SPACE = re.compile(r' {2,}')


def _redact_name(text: str, profile_name: str) -> str:
    """Redact the user's known name from raw text before sending to LLM."""
    if not profile_name:
        return text
    parts = profile_name.strip().split()
    for part in parts:
        if len(part) > 1:
            text = re.sub(r'\b' + re.escape(part) + r'\b', '[NAME_REDACTED]', text, flags=re.IGNORECASE)
    text = re.sub(r'\b' + re.escape(profile_name.strip()) + r'\b', '[NAME_REDACTED]', text, flags=re.IGNORECASE)
    return text


def _clean_raw_text(text: str) -> str:
    """Strip noise and redact PII from raw PDF text before sending to LLM."""
    text = _RE_EMAIL.sub('[EMAIL_REDACTED]', text)
    text = _RE_PHONE.sub('[PHONE_REDACTED]', text)
    text = _RE_DIVIDER.sub('', text)
    text = _RE_PAGE_NUM.sub('', text)
    text = _RE_MULTI_NEWLINE.sub('\n\n', text)
    text = _RE_MULTI_SPACE.sub(' ', text)
    return text.strip()


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


def structure_resume_with_ai(raw_text: str, db=None, user_id=None, profile_name: str = None, profile_email: str = None) -> dict:
    """Parse resume raw text into structured JSON using DeepSeek or Ollama.
    PII (name, email, phone) is redacted before sending to the LLM and re-injected
    from the user's profile after parsing.
    """

    # Redact known PII before sending to LLM
    safe_text = _redact_name(raw_text, profile_name) if profile_name else raw_text

    system_prompt = (
        "Parse this resume text and return valid JSON with these fields: "
        'summary, '
        'experience[{title, company, dates, bullets}], '
        'education[{degree, school, year}], '
        'skills[string], certifications[{name, year}], '
        'other[{heading, content}]. '
        "The 'other' field captures any additional sections present in the resume "
        "(e.g. projects, publications, awards, volunteer work, languages, etc.). "
        "Each entry has a 'heading' (the section title) and 'content' (the section text, "
        "which may include newlines for bullet-style lists). "
        "Do NOT extract personal identifiable information (names, emails, phones, addresses) — "
        "these are redacted as [NAME_REDACTED], [EMAIL_REDACTED], [PHONE_REDACTED]. "
        "Focus only on professional content. "
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
                    {"role": "user", "content": safe_text},
                ],
                format="json",
            )
            log_tokens(response, "resume_parse", db=db, user_id=user_id, model="llama3.1:8b")
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
                model="deepseek-v4-flash",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": safe_text},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=2000,
                extra_body={"thinking": {"type": "disabled"}},
            )
            log_tokens(response, "resume_parse", db=db, user_id=user_id, model="deepseek-v4-flash")
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

    # Ensure all fields exist
    defaults = {
        "summary": None,
        "experience": [], "education": [], "skills": [], "certifications": [],
        "other": [],
    }
    for field, default in defaults.items():
        if field not in structured:
            structured[field] = default

    # Inject profile PII — never trust the LLM with personal data
    structured["full_name"] = profile_name or None
    structured["email"] = profile_email or None

    return structured
