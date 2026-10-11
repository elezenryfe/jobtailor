import json
import logging
from openai import OpenAI, APIError, RateLimitError
from ..config import settings
from .llm_utils import log_tokens, strip_jd_boilerplate

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "Extract the job posting metadata from this text. Return JSON with exactly these fields: "
    "job_title (the role title), "
    "company (the hiring company's name), "
    "job_url (the direct URL of the posting if one appears in the text, else null). "
    "Use null for any field that is not explicitly present in the text. "
    "Never invent or guess a value, especially a URL. "
    "Return ONLY JSON."
)


def _clean(value) -> str:
    """Coerce an LLM field to a trimmed string, or None if it carries no value."""
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value or value.lower() in ("null", "none", "n/a", "na", "unknown"):
        return None
    return value


def _clean_url(value) -> str:
    """Accept only a real http(s) URL. job_url drives duplicate detection on create,
    so a non-URL here would silently break that and could block a legitimate save."""
    value = _clean(value)
    if value and value.startswith(("http://", "https://")):
        return value
    return None


def _normalize(data) -> dict:
    if not isinstance(data, dict):
        data = {}
    return {
        "job_title": _clean(data.get("job_title")),
        "company": _clean(data.get("company")),
        "job_url": _clean_url(data.get("job_url")),
    }


def extract_job_fields(jd_text: str, db=None, user_id=None) -> dict:
    """Extract job_title, company and job_url from a pasted job description.

    Returns {"job_title": str|None, "company": str|None, "job_url": str|None}.
    """
    # Drop EEO/benefits/about-us prose and cap length before spending tokens.
    # The header block, where the title and company live, is unaffected.
    user_message = strip_jd_boilerplate(jd_text, max_chars=3000)
    if not user_message:
        user_message = jd_text[:3000]

    # ---------- Ollama path ----------
    if settings.DEEPSEEK_API_KEY == "ollama":
        from ollama import chat
        logger.info("Using Ollama to extract job fields...")
        try:
            response = chat(
                model="llama3.1:8b",
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                format="json",
                options={"temperature": 0.1},
            )
            log_tokens(response, "jd_extract", db=db, user_id=user_id, model="llama3.1:8b")
            result = json.loads(response["message"]["content"])
        except Exception as e:
            logger.error(f"Ollama job field extraction failed: {e}")
            raise RuntimeError("AI service call failed (Ollama).")
    # ---------- DeepSeek path ----------
    else:
        client = OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
        try:
            logger.info("Calling DeepSeek to extract job fields...")
            response = client.chat.completions.create(
                model="deepseek-v4-flash",
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=300,
                extra_body={"thinking": {"type": "disabled"}},
            )
            log_tokens(response, "jd_extract", db=db, user_id=user_id, model="deepseek-v4-flash")
            raw = response.choices[0].message.content
            if not raw:
                # json.loads(None) raises TypeError, not JSONDecodeError
                raise RuntimeError("Failed to parse AI response.")
            result = json.loads(raw)
        except RateLimitError as e:
            logger.error(f"DeepSeek rate limit: {e}")
            raise RuntimeError("AI service is temporarily overloaded.")
        except APIError as e:
            logger.error(f"DeepSeek API error: {e}")
            raise RuntimeError("AI service call failed.")
        except json.JSONDecodeError:
            logger.error("Invalid JSON from AI for job field extraction")
            raise RuntimeError("Failed to parse AI response.")

    return _normalize(result)
