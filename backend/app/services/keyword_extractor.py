import json
import hashlib
import logging
from collections import Counter
from openai import OpenAI, APIError, RateLimitError
from ..config import settings
from .llm_utils import log_tokens, strip_jd_boilerplate

logger = logging.getLogger(__name__)

STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "can", "shall", "you",
    "your", "we", "our", "they", "their", "it", "its", "this", "that",
    "these", "those", "not", "no", "if", "so", "than", "also", "very",
    "just", "about", "into", "over", "such", "each", "all", "both",
    "few", "more", "most", "other", "some", "only", "own", "same",
    "new", "now", "up", "out", "when", "how", "what", "which", "who",
    "whom", "any", "then", "there", "here", "between", "through",
    "during", "before", "after", "above", "below", "under", "again",
    "further", "once", "based", "including", "within", "while",
    "where", "well", "work", "team", "role", "year", "one",
    "two", "use", "used", "using", "skills", "experience", "ability",
    "must", "required", "qualifications", "position", "looking",
    "candidate", "candidates", "job", "etc", "across", "per",
    "day", "every", "equal", "opportunity", "employer", "without",
    "regard", "race", "color", "religion", "sex", "national",
    "origin", "protected", "veteran", "status", "disability",
    "gender", "identity", "sexual", "orientation", "please", "apply",
}

# Simple in-memory cache: {sha256(jd_texts_concatenated): [keyword_entries]}
_keyword_cache: dict = {}
_MAX_CACHE_SIZE = 50


def _local_keyword_extract(descriptions):
    """Simple word frequency extraction (free, no LLM)."""
    counter = Counter()
    for text in descriptions:
        if not text:
            continue
        words = text.lower().split()
        for w in words:
            cleaned = "".join(c for c in w if c.isalpha())
            if cleaned and len(cleaned) > 2 and cleaned not in STOP_WORDS:
                counter[cleaned] += 1
    return [{"word": w, "count": c} for w, c in counter.most_common(50)]


def extract_keywords(descriptions, max_jds: int = 10):
    """Extract top 20 keywords from job descriptions using LLM with TF-IDF pre-filter."""
    if not descriptions or all(not d for d in descriptions):
        return []

    # Limit to N most recent JDs (router passes already-limited list)
    descriptions = descriptions[:max_jds]

    # Strip boilerplate from each
    clean_descriptions = [strip_jd_boilerplate(d) for d in descriptions if d]
    if not clean_descriptions:
        return []

    # Hash cache check
    cache_key = hashlib.sha256("|||".join(sorted(clean_descriptions)).encode()).hexdigest()
    if cache_key in _keyword_cache:
        logger.info("Keyword extraction: cache hit")
        return _keyword_cache[cache_key]

    # Local TF-IDF pass: get top 50 terms, send only those to LLM
    local_terms = _local_keyword_extract(clean_descriptions)
    if not local_terms:
        return []

    # Send only word+count pairs, not raw JD text
    term_list = json.dumps(local_terms[:50])

    system_prompt = (
        "Given a list of keywords extracted from job descriptions, deduplicate semantically "
        'similar terms (e.g. "aws" and "amazon web services" → "aws"), remove generic words, '
        "keep only technical skills, tools, domains. Return top 20 as JSON array of "
        '{word, count}. Example: [{"word": "python", "count": 5}]. Return ONLY JSON.'
    )

    if settings.DEEPSEEK_API_KEY == "ollama":
        try:
            from ollama import chat
            logger.info("Using Ollama for keyword dedup...")
            response = chat(
                model="llama3.1:8b",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": term_list},
                ],
                format="json",
            )
            log_tokens(response, "keyword_extract")
            content = response["message"]["content"]
            result = json.loads(content)
            if isinstance(result, list) and all("word" in r and "count" in r for r in result):
                _cache_and_prune(cache_key, result[:20])
                return result[:20]
        except Exception as e:
            logger.warning(f"Ollama keyword extraction failed, falling back to local: {e}")
            fallback = _local_keyword_extract(clean_descriptions)[:20]
            _cache_and_prune(cache_key, fallback)
            return fallback
    else:
        client = OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
        try:
            logger.info("Calling DeepSeek for keyword dedup...")
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": term_list},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=1000,
            )
            log_tokens(response, "keyword_extract")
            content = response.choices[0].message.content
            parsed = json.loads(content)
            if isinstance(parsed, list):
                result = parsed
            elif isinstance(parsed, dict):
                result = parsed.get("keywords", list(parsed.values())[0] if parsed.values() else [])
            else:
                result = []
            if isinstance(result, list) and all("word" in r and "count" in r for r in result):
                _cache_and_prune(cache_key, result[:20])
                return result[:20]
        except (RateLimitError, APIError, json.JSONDecodeError, Exception) as e:
            logger.warning(f"DeepSeek keyword extraction failed, falling back to local: {e}")
            fallback = _local_keyword_extract(clean_descriptions)[:20]
            _cache_and_prune(cache_key, fallback)
            return fallback

    return _local_keyword_extract(clean_descriptions)[:20]


def _cache_and_prune(key, value):
    """Store in cache, prune if too large."""
    if len(_keyword_cache) >= _MAX_CACHE_SIZE:
        oldest = next(iter(_keyword_cache))
        del _keyword_cache[oldest]
    _keyword_cache[key] = value
