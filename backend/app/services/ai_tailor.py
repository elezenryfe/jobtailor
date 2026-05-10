import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI, APIError, RateLimitError
from ..config import settings
from .llm_utils import log_tokens, strip_jd_boilerplate

logger = logging.getLogger(__name__)

# Simple tech skill extraction from JD text (regex-based, no LLM needed)
_RE_TECH_WORDS = re.compile(
    r'\b(python|javascript|typescript|java|go|rust|c\+\+|ruby|php|swift|kotlin|scala|'
    r'aws|azure|gcp|cloud|docker|kubernetes|terraform|ansible|jenkins|ci/cd|'
    r'sql|postgresql|mysql|mongodb|redis|elasticsearch|kafka|rabbitmq|graphql|rest|grpc|'
    r'react|angular|vue|node\.?js|next\.?js|django|flask|spring|rails|'
    r'ml|ai|machine learning|deep learning|nlp|data science|tensorflow|pytorch|'
    r'linux|git|agile|scrum|jira|confluence)\b',
    re.IGNORECASE,
)

_JD_CLEANUP = re.compile(r'[,.;:!?"\')(\[\]{}|/\\]')


def _extract_tech_from_jd(jd_text: str) -> list:
    """Extract tech stack keywords from JD using regex (free, no LLM)."""
    cleaned = _JD_CLEANUP.sub(' ', jd_text.lower())
    found = set(m.group(0).lower() for m in _RE_TECH_WORDS.finditer(cleaned))
    return sorted(found)


def _extract_title_company_from_jd(jd_text: str) -> tuple:
    """Best-effort extraction of job title and company from JD text (regex, no LLM)."""
    import re
    title = ""
    company = ""

    # Company: "[Company] is looking for", "at [Company]", "About [Company]"
    m = re.search(r'(?:at|About|join)\s+([A-Z][A-Za-z0-9\s&\.]{2,30}?)(?:\s*(?:is|are|has|was|,|\.|to|for|in|and|—|-|a)|$)', jd_text[:500])
    if m:
        candidate = m.group(1).strip()
        # Reject if it looks like a generic word rather than a company name
        if not re.match(r'^(The|This|We|You|Our|Your|A|An|All|Each|Every|Some|Any)\b', candidate):
            company = candidate

    # Job title: first line that looks like a title (capitalized words, 2-5 words)
    lines = jd_text[:300].split('\n')
    for line in lines:
        line = line.strip()
        # Skip short lines, URLs, all-caps headers, lines with "job" or "position"
        if len(line) < 5 or len(line) > 80:
            continue
        if re.match(r'^[A-Z][A-Za-z0-9\s/&\(\)\-–—]{2,60}$', line):
            # Skip section headers
            if re.match(r'^(About|Job|Position|Description|Requirements|Qualifications|Responsibilities|What|How|The|We|Our)', line):
                continue
            title = line
            break

    return title, company


def _build_minimal_context(resume_json: dict, job_description: str, job_title: str = "", company: str = "") -> dict:
    """Build a minimal context dict for cover letter generation (no full JD needed)."""
    # Extract from JD if not provided
    if not job_title or not company:
        extracted_title, extracted_company = _extract_title_company_from_jd(job_description)
        job_title = job_title or extracted_title or "this role"
        company = company or extracted_company or "your organization"

    # Top 5 skills
    skills = resume_json.get("skills", [])[:5]

    # Recent job titles
    titles = [e.get("title", "") for e in (resume_json.get("experience") or []) if e.get("title")][:2]

    # Extracted tech from JD
    jd_tech = _extract_tech_from_jd(job_description)[:8]

    return {
        "candidate_name": resume_json.get("full_name", "the candidate"),
        "job_titles": titles,
        "top_skills": skills,
        "company": company,
        "role": job_title,
        "jd_key_terms": jd_tech,
    }


def _generate_cover_letter_from_context(minimal_ctx: dict) -> str:
    """Generate cover letter from minimal context (single user message, no system prompt)."""
    candidate = minimal_ctx["candidate_name"]
    titles = minimal_ctx["job_titles"]
    skills = minimal_ctx["top_skills"]
    company = minimal_ctx["company"]
    role = minimal_ctx["role"]
    key_terms = minimal_ctx["jd_key_terms"]

    user_message = (
        f"Write a professional cover letter for {candidate} applying for the {role} role at {company}. "
        f"The candidate has worked as {', '.join(titles) if titles else 'a professional'} "
        f"with skills in {', '.join(skills) if skills else 'technology and leadership'}. "
        f"The role involves: {', '.join(key_terms) if key_terms else 'the described responsibilities'}. "
        "Use the exact role and company provided above — do NOT use brackets or placeholder text like "
        "'[Company Name]' or '[Job Title]'. Keep it 200-300 words, plain text, no markdown."
    )

    return user_message


def tailor_resume(resume_json: dict, job_description: str, db=None, user_id=None) -> dict:
    """AI call: tailor resume to match job. PII stripped before LLM, reattached after."""
    # Strip PII before sending to LLM
    pii_fields = {}
    for key in ("full_name", "email"):
        pii_fields[key] = resume_json.get(key)
        resume_json.pop(key, None)

    # Strip JD boilerplate
    clean_jd = strip_jd_boilerplate(job_description)

    system_prompt = (
        "Rewrite this resume JSON to match the job description. Use keywords from the JD, "
        "rephrase bullets for impact, reorder sections if helpful. Do NOT invent information. "
        "Preserve ALL sections from the original resume, including any entries in the 'other' array. "
        "For 'other' entries, tailor the content to highlight aspects relevant to the JD while "
        "keeping the original heading. "
        "Return JSON with the same structure: summary, experience[{title, company, dates, bullets}], "
        "education[{degree, school, year}], skills[string], certifications[{name, year}], "
        "other[{heading, content}]."
    )

    user_message = (
        f"Resume:\n{json.dumps(resume_json, indent=2)}\n\n"
        f"Job Description:\n{clean_jd}"
    )

    if settings.DEEPSEEK_API_KEY == "ollama":
        from ollama import chat
        logger.info("Using Ollama for resume tailoring...")
        try:
            response = chat(
                model="llama3.1:8b",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                format="json",
                options={"temperature": 0.3},
            )
            log_tokens(response, "tailor_resume", db=db, user_id=user_id, model="llama3.1:8b")
            content = response["message"]["content"]
            tailored = json.loads(content)
        except Exception as e:
            logger.error(f"Ollama tailoring failed: {e}")
            raise RuntimeError("AI service call failed (Ollama).")
    else:
        client = OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
        try:
            logger.info("Calling DeepSeek for resume tailoring...")
            response = client.chat.completions.create(
                model="deepseek-v4-flash",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=2500,
                extra_body={"thinking": {"type": "disabled"}},
            )
            log_tokens(response, "tailor_resume", db=db, user_id=user_id, model="deepseek-v4-flash")
            content = response.choices[0].message.content
            tailored = json.loads(content)
        except RateLimitError as e:
            logger.error(f"DeepSeek rate limit: {e}")
            raise RuntimeError("AI service is temporarily overloaded.")
        except APIError as e:
            logger.error(f"DeepSeek API error: {e}")
            raise RuntimeError("AI service call failed.")
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from AI: {content}")
            raise RuntimeError("Failed to parse AI response.")

    # Re-attach PII
    tailored["full_name"] = pii_fields.get("full_name")
    tailored["email"] = pii_fields.get("email")

    for field in ["summary", "experience", "education", "skills", "certifications", "other"]:
        if field not in tailored:
            tailored[field] = None if field == "summary" else []

    # Fallback: merge any original "other" entries the LLM dropped
    original_other = resume_json.get("other") or []
    tailored_other = tailored.get("other") or []
    if original_other and (not tailored_other or len(tailored_other) < len(original_other)):
        tailored_headings = {e.get("heading", "") for e in tailored_other}
        for entry in original_other:
            if entry.get("heading", "") not in tailored_headings:
                tailored_other.append(entry)
        tailored["other"] = tailored_other

    return tailored


def generate_cover_letter(resume_json: dict, job_description: str, job_title: str = "", company: str = "", db=None, user_id=None) -> str:
    """Generate cover letter using minimal context. Single user message, no system prompt."""
    minimal_ctx = _build_minimal_context(resume_json, job_description, job_title, company)
    user_message = _generate_cover_letter_from_context(minimal_ctx)

    if settings.DEEPSEEK_API_KEY == "ollama":
        from ollama import chat
        logger.info("Using Ollama for cover letter...")
        try:
            response = chat(
                model="llama3.1:8b",
                messages=[{"role": "user", "content": user_message}],
                options={"temperature": 0.7},
            )
            log_tokens(response, "cover_letter", db=db, user_id=user_id, model="llama3.1:8b")
            return response["message"]["content"].strip()
        except Exception as e:
            logger.error(f"Ollama cover letter failed: {e}")
            raise RuntimeError("AI service call failed (Ollama).")
    else:
        client = OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
        try:
            logger.info("Calling DeepSeek for cover letter generation...")
            response = client.chat.completions.create(
                model="deepseek-v4-flash",
                messages=[{"role": "user", "content": user_message}],
                temperature=0.7,
                max_tokens=800,
                extra_body={"thinking": {"type": "disabled"}},
            )
            log_tokens(response, "cover_letter", db=db, user_id=user_id, model="deepseek-v4-flash")
            return response.choices[0].message.content.strip()
        except RateLimitError as e:
            logger.error(f"DeepSeek rate limit: {e}")
            raise RuntimeError("AI service is temporarily overloaded.")
        except APIError as e:
            logger.error(f"DeepSeek API error: {e}")
            raise RuntimeError("AI service call failed.")


def run_tailor_and_cover_parallel(resume_json: dict, job_description: str, mode: str, job_title: str = "", company: str = "", db=None, user_id=None) -> tuple:
    """Run tailor_resume and generate_cover_letter in parallel when mode=='both'."""
    tailored_json = resume_json
    cover_text = ""

    if mode == "both":
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_tailor = executor.submit(tailor_resume, resume_json, job_description, db, user_id)
            future_cover = executor.submit(generate_cover_letter, dict(resume_json), job_description, job_title, company, db, user_id)

            for future in as_completed([future_tailor, future_cover]):
                try:
                    result = future.result()
                    if future == future_tailor:
                        tailored_json = result
                    else:
                        cover_text = result
                except Exception:
                    # Let the router handle the exception
                    future_tailor.cancel()
                    future_cover.cancel()
                    raise
    elif mode == "resume":
        tailored_json = tailor_resume(resume_json, job_description, db, user_id)
    elif mode == "cover_letter":
        cover_text = generate_cover_letter(resume_json, job_description, job_title, company, db, user_id)

    return tailored_json, cover_text
