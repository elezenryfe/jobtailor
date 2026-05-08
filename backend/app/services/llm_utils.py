"""
Shared LLM utilities: token logging, JD boilerplate stripping, dedup helpers, rate limiting.
"""
import re
import hashlib
import logging
import time
from collections import defaultdict

logger = logging.getLogger(__name__)

# ── Token logging ─────────────────────────────────────────────

def log_tokens(response, call_name: str):
    """Log token usage from an OpenAI-compatible or Ollama response."""
    try:
        if hasattr(response, 'usage') and response.usage:
            logger.info(
                f"[TOKENS] {call_name} | prompt={response.usage.prompt_tokens} "
                f"completion={response.usage.completion_tokens} "
                f"total={response.usage.total_tokens}"
            )
        elif isinstance(response, dict) and "message" in response:
            # Ollama response: {message: {content: ...}}
            content = response.get("message", {}).get("content", "")
            estimated = max(1, int(len(content.split()) * 1.3))
            logger.info(f"[TOKENS] {call_name} | estimated_total={estimated} (Ollama)")
        else:
            logger.info(f"[TOKENS] {call_name} | usage data unavailable")
    except Exception:
        logger.debug(f"[TOKENS] {call_name} | failed to log tokens")


# ── JD boilerplate stripping ──────────────────────────────────

_BOILERPLATE_PATTERNS = [
    # EEO / diversity statements
    r'(?i)we\s+are\s+an?\s+equal\s+opportunity\s+employer[^.]*\.',
    r'(?i)equal\s+opportunity\s+employer[^.]*\.',
    r'(?i)committed\s+to\s+(creating|building|fostering)\s+(a\s+)?diverse[^.]*\.',
    r'(?i)do\s+not\s+discriminate[^.]*\.',
    r'(?i)regardless\s+of\s+(race|color|religion|sex|gender|national\s+origin|age|disability)[^.]*\.',
    # Benefits / perks / compensation
    r'(?i)(we\s+offer|benefits\s+include|perks\s*(:|\n)|what\s+we\s+offer|compensation\s*(:|\n))[^.]*\.',
    r'(?i)(health|dental|vision|401k|401\(k\)|retirement|PTO|paid\s+time\s+off|unlimited\s+PTO|stock\s+options|equity|parental\s+leave|wellness\s+stipend)[^.]*\.',
    r'(?i)salary\s+(range|band)[^.]*\.',
    # About Us / company descriptions (usually starts after "About Us" header)
    r'(?i)about\s+(us|the\s+company|the\s+team|\[company\])[:\n][^.]*\.',
    r'(?i)\[company\]\s+is\s+a\s+[^.]*\.',
    # Location / remote boilerplate
    r'(?i)this\s+(role|position)\s+is\s+(remote|hybrid|onsite|fully\s+remote|work\s+from\s+home)[^.]*\.',
    r'(?i)(remote|hybrid|work\s+from\s+home|WFH|onsite)\s+(first|friendly|policy|eligible)[^.]*\.',
]


def strip_jd_boilerplate(jd_text: str, max_chars: int = 3000) -> str:
    """
    Remove boilerplate from a job description: EEO statements, benefits,
    company about-us, location policy. Truncates to max_chars.
    """
    if not jd_text:
        return ""

    cleaned = jd_text

    for pattern in _BOILERPLATE_PATTERNS:
        cleaned = re.sub(pattern, '', cleaned, flags=re.DOTALL)

    # Clean up artifacts: multiple spaces, triple+ newlines, leading/trailing
    cleaned = re.sub(r' {2,}', ' ', cleaned)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    cleaned = cleaned.strip()

    if len(cleaned) > max_chars:
        cleaned = cleaned[:max_chars]

    return cleaned


# ── Dedup helpers ─────────────────────────────────────────────

def hash_text(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def get_cached_tailor(db, user_id: int, resume_id: int, jd_hash: str, mode: str):
    """Check if a TailoredDocument already exists for these exact inputs."""
    from ..models import TailoredDocument
    return db.query(TailoredDocument).filter(
        TailoredDocument.user_id == user_id,
        TailoredDocument.resume_id == resume_id,
        TailoredDocument.job_description == jd_hash,  # we store the hash as a marker
    ).first()


def get_cached_interview(db, user_id: int, job_description: str):
    """Check if an InterviewPrep already exists for this JD."""
    from ..models import InterviewPrep
    jd_hash = hash_text(job_description)
    return db.query(InterviewPrep).filter(
        InterviewPrep.user_id == user_id,
        InterviewPrep.job_description == jd_hash,
    ).first()


# ── Rate limiter ──────────────────────────────────────────────

_MAX_CALLS_PER_HOUR = 30
_WINDOW_SECONDS = 3600
_rate_store: dict = defaultdict(list)


def check_rate_limit(user_id: int) -> bool:
    """Returns True if allowed, False if rate limited."""
    now = time.time()
    cutoff = now - _WINDOW_SECONDS

    # Prune old entries
    _rate_store[user_id] = [t for t in _rate_store[user_id] if t > cutoff]

    if len(_rate_store[user_id]) >= _MAX_CALLS_PER_HOUR:
        return False

    _rate_store[user_id].append(now)
    return True
