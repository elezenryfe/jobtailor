import re
import hashlib
import logging
import time
from typing import Optional, List
import requests

from ..config import settings
from ..schemas import JobSearchParams, JobSearchResult, JobSearchResponse

logger = logging.getLogger(__name__)

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_MULTI_SPACE_RE = re.compile(r"\s+")

# In-memory search cache: keyed by SHA-256 of search params, stores (timestamp, response)
_cache: dict = {}
_CACHE_TTL = settings.JSEARCH_CACHE_TTL


def _cache_key(params: JobSearchParams) -> str:
    raw = f"{params.keywords}|{params.location}|{params.remote_only}|{params.page}|{params.num_pages}"
    if params.employment_types:
        raw += "|" + ",".join(sorted(et.value for et in params.employment_types))
    return hashlib.sha256(raw.encode()).hexdigest()


def _strip_html(html: str) -> str:
    if not html:
        return ""
    text = _HTML_TAG_RE.sub(" ", html)
    text = _MULTI_SPACE_RE.sub(" ", text)
    return text.strip()[:5000]


def _format_location(city: Optional[str], state: Optional[str], country: Optional[str]) -> Optional[str]:
    parts = [p for p in [city, state, country] if p]
    return ", ".join(parts) if parts else None


def _normalize_jsearch_item(item: dict) -> Optional[JobSearchResult]:
    if not isinstance(item, dict):
        return None
    job_url = (item.get("job_apply_link") or "").strip()
    if not item.get("job_title") or not job_url:
        return None
    description_html = item.get("job_description") or ""
    description_text = _strip_html(description_html)
    return JobSearchResult(
        source_job_id=str(item.get("job_id", "")),
        job_title=item.get("job_title", ""),
        company=item.get("employer_name", ""),
        location=_format_location(
            item.get("job_city"), item.get("job_state"), item.get("job_country")
        ),
        job_description=description_text,
        job_description_html=description_html,
        min_salary=item.get("job_min_salary"),
        max_salary=item.get("job_max_salary"),
        salary_currency=item.get("job_salary_currency"),
        salary_period=item.get("job_salary_period"),
        employment_type=item.get("job_employment_type"),
        job_url=job_url,
        posted_at=item.get("job_posted_at_datetime_utc"),
        publisher=item.get("job_publisher"),
        required_skills=item.get("job_required_skills", []) or [],
    )


def _normalize_adzuna_item(item: dict) -> Optional[JobSearchResult]:
    if not isinstance(item, dict):
        return None
    job_url = item.get("redirect_url", "")
    if not item.get("title") or not job_url:
        return None
    desc = (item.get("description") or "")[:5000]
    company_info = item.get("company") or {}
    location_info = item.get("location") or {}
    return JobSearchResult(
        source_job_id=str(item.get("id", "")),
        job_title=item.get("title", ""),
        company=company_info.get("display_name", ""),
        location=location_info.get("display_name"),
        job_description=desc,
        job_description_html=None,
        min_salary=item.get("salary_min"),
        max_salary=item.get("salary_max"),
        salary_currency="GBP" if not item.get("salary_is_predicted") else None,
        salary_period="yearly",
        employment_type=item.get("contract_time"),
        job_url=job_url,
        posted_at=item.get("created"),
        publisher="Adzuna",
        required_skills=[],
    )


def _search_jsearch(params: JobSearchParams) -> JobSearchResponse:
    if not settings.JSEARCH_API_KEY:
        raise RuntimeError(
            "JSearch API key not configured. Set JSEARCH_API_KEY in your .env file."
        )

    query_parts = [params.keywords]
    if params.location and not params.remote_only:
        query_parts.append(f"in {params.location}")
    query_string = " ".join(query_parts)

    api_params = {
        "query": query_string,
        "page": params.page,
        "num_pages": min(params.num_pages, 5),
    }
    if params.remote_only:
        api_params["remote_jobs_only"] = "true"
    if params.employment_types:
        api_params["employment_types"] = ",".join(et.value for et in params.employment_types)

    headers = {
        "X-RapidAPI-Key": settings.JSEARCH_API_KEY,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    }

    try:
        logger.info("JSearch query='%s' page=%d", query_string, params.page)
        resp = requests.get(
            f"{settings.JSEARCH_BASE_URL}/search",
            headers=headers,
            params=api_params,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else 0
        if status == 401:
            raise RuntimeError("Invalid JSearch API key. Check your JSEARCH_API_KEY.")
        elif status == 429:
            raise RuntimeError("JSearch API rate limit exceeded. Try again later.")
        else:
            raise RuntimeError(f"JSearch API error (HTTP {status}): {e}")
    except requests.exceptions.ConnectionError:
        raise RuntimeError("Could not connect to JSearch API. Check your internet connection.")
    except requests.exceptions.Timeout:
        raise RuntimeError("JSearch API request timed out.")

    raw = data.get("data", []) if isinstance(data, dict) else []
    results = []
    for item in raw:
        normalized = _normalize_jsearch_item(item)
        if normalized:
            results.append(normalized)

    return JobSearchResponse(
        results=results,
        total=len(results),
        page=params.page,
        num_pages=params.num_pages,
    )


def _search_adzuna(params: JobSearchParams) -> JobSearchResponse:
    if not settings.ADZUNA_APP_ID or not settings.ADZUNA_APP_KEY:
        raise RuntimeError("Adzuna API not configured. Set ADZUNA_APP_ID and ADZUNA_APP_KEY.")

    country = "us"
    location = (params.location or "").strip().lower()
    if location in ("uk", "united kingdom", "london", "manchester", "birmingham"):
        country = "gb"
    elif location in ("canada", "toronto", "vancouver", "montreal"):
        country = "ca"
    elif location in ("australia", "sydney", "melbourne"):
        country = "au"
    elif location in ("india", "mumbai", "bangalore", "delhi"):
        country = "in"

    api_params = {
        "app_id": settings.ADZUNA_APP_ID,
        "app_key": settings.ADZUNA_APP_KEY,
        "what": params.keywords,
        "results_per_page": 20,
    }
    if params.location and not params.remote_only:
        api_params["where"] = params.location
    if params.employment_types:
        types_str = ",".join(et.value.lower() for et in params.employment_types)
        api_params["contract_type"] = types_str

    try:
        logger.info("Adzuna fallback query='%s' country=%s", params.keywords, country)
        resp = requests.get(
            f"https://api.adzuna.com/v1/api/jobs/{country}/search/{params.page}",
            params=api_params,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else 0
        if status == 401:
            raise RuntimeError("Invalid Adzuna API credentials.")
        elif status == 429:
            raise RuntimeError("Adzuna API rate limit exceeded. Try again later.")
        else:
            raise RuntimeError(f"Adzuna API error (HTTP {status})")
    except requests.exceptions.ConnectionError:
        raise RuntimeError("Could not connect to Adzuna API.")
    except requests.exceptions.Timeout:
        raise RuntimeError("Adzuna API request timed out.")

    raw = data.get("results", []) if isinstance(data, dict) else []
    results = []
    for item in raw:
        normalized = _normalize_adzuna_item(item)
        if normalized:
            results.append(normalized)

    return JobSearchResponse(
        results=results,
        total=data.get("count", len(results)) if isinstance(data, dict) else len(results),
        page=params.page,
        num_pages=params.num_pages,
    )


def search_jobs(params: JobSearchParams) -> JobSearchResponse:
    # Check in-memory cache
    key = _cache_key(params)
    if key in _cache:
        cached_at, cached_response = _cache[key]
        if time.time() - cached_at < _CACHE_TTL:
            logger.info("Search cache hit for key=%s", key[:12])
            return cached_response

    # Try JSearch first
    try:
        response = _search_jsearch(params)
        _cache[key] = (time.time(), response)
        return response
    except RuntimeError as jsearch_error:
        logger.warning("JSearch failed: %s", jsearch_error)

        # Fall back to Adzuna if configured
        if settings.ADZUNA_APP_ID and settings.ADZUNA_APP_KEY:
            try:
                logger.info("Falling back to Adzuna...")
                response = _search_adzuna(params)
                _cache[key] = (time.time(), response)
                return response
            except RuntimeError as adzuna_error:
                logger.warning("Adzuna fallback also failed: %s", adzuna_error)
                raise RuntimeError(
                    f"All job search providers failed. JSearch: {jsearch_error}. "
                    f"Adzuna: {adzuna_error}"
                )

        # No fallback available
        raise jsearch_error
