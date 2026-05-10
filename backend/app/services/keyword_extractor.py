import hashlib
import logging
import re
from collections import Counter
from .llm_utils import strip_jd_boilerplate

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

# Words that pass stop-word filter but aren't technical skills
_NON_TECH_WORDS = {
    "strong", "excellent", "proven", "minimum", "plus", "nice",
    "related", "relevant", "similar", "various", "multiple",
    "complex", "leading", "fast", "paced", "dynamic", "growing",
    "seeking", "dedicated", "passionate", "talented", "motivated",
    "driven", "creative", "innovative", "collaborative",
    "environment", "company", "business", "industry", "client",
    "clients", "customer", "customers", "stakeholders",
    "solution", "solutions", "service", "services", "product",
    "products", "platform", "project", "projects", "management",
    "development", "design", "build", "building", "support",
    "ensure", "help", "need", "like", "make", "get", "set",
    "understanding", "knowledge", "background", "degree",
    "bachelor", "master", "phd", "equivalent", "preferred",
    "bonus", "benefits", "salary", "full", "time", "part",
    "senior", "junior", "lead", "manager", "director", "engineer",
    "analyst", "developer", "specialist", "associate",
    "realworld", "youll", "youre", "were",
    "data", "analytical", "analytics", "know", "scientist",
    "systems", "models", "research", "technical", "quantitative",
    "science", "engineer", "building", "design",
}

# Alias map: surface form → canonical form (for merging near-duplicates)
_KEYWORD_ALIASES = {
    "aws": "aws",
    "amazon web services": "aws",
    "ec2": "aws",
    "s3": "aws",
    "lambda": "aws",
    "azure": "azure",
    "microsoft azure": "azure",
    "gcp": "gcp",
    "google cloud": "gcp",
    "google cloud platform": "gcp",
    "k8s": "kubernetes",
    "reactjs": "react",
    "react js": "react",
    "vuejs": "vue",
    "vue js": "vue",
    "nodejs": "node js",
    "node": "node js",
    "nextjs": "next js",
    "next": "next js",
    "nuxtjs": "nuxt",
    "nuxt js": "nuxt",
    "cpp": "c++",
    "csharp": "c#",
    "net": "c#",
    "dotnet": "c#",
    "asp net": "c#",
    "golang": "go",
    "ml": "machine learning",
    "dl": "deep learning",
    "nlp": "natural language processing",
    "cv": "computer vision",
    "ci": "ci/cd",
    "cd": "ci/cd",
    "cicd": "ci/cd",
    "gha": "github actions",
    "github actions": "ci/cd",
    "ts": "typescript",
    "js": "javascript",
    "psql": "postgresql",
    "postgres": "postgresql",
    "mongo": "mongodb",
    "tf": "terraform",
    "elk": "elasticsearch",
    "es": "elasticsearch",
    "sagemaker": "aws",
    "bedrock": "aws",
    "comprehend": "aws",
    "textract": "aws",
    "athena": "aws",
    "faiss": "vector databases",
    "rag": "rag",
    "llm": "llm",
    "ai": "ai",
    "genai": "genai",
    "gen ai": "genai",
    "generative ai": "genai",
    "agentic": "agentic workflows",
    "agentic ai": "agentic workflows",
}

# In-memory cache
_keyword_cache: dict = {}
_MAX_CACHE_SIZE = 50


def _simple_norm(word: str) -> str:
    """Normalize a word for dedup: lowercase, strip symbols, collapse whitespace."""
    cleaned = word.lower().strip()
    cleaned = re.sub(r"[.\-_]", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _local_keyword_extract(descriptions):
    """Word + bigram frequency extraction with stop-word filtering."""
    counter = Counter()
    for text in descriptions:
        if not text:
            continue
        words = text.lower().split()
        clean_words = []
        for w in words:
            cleaned = "".join(c for c in w if c.isalpha())
            if cleaned and len(cleaned) > 2 and cleaned not in STOP_WORDS:
                clean_words.append(cleaned)
        for w in clean_words:
            counter[w] += 1
        for i in range(len(clean_words) - 1):
            bigram = "{} {}".format(clean_words[i], clean_words[i + 1])
            counter[bigram] += 1
    return [{"word": w, "count": c} for w, c in counter.most_common(80)]


# Known technical bigrams that are valid even at count 1
_TECH_BIGRAMS = {
    "machine learning", "deep learning", "data science", "computer vision",
    "natural language processing", "agentic workflows", "reinforcement learning",
    "neural network", "neural networks", "large language", "language models",
    "vector databases", "version control", "continuous integration",
    "continuous deployment", "cloud computing", "big data",
    "data engineering", "data analysis", "statistical analysis",
    "software engineering", "web development", "mobile development",
    "operating systems", "distributed systems", "system design",
    "object oriented", "functional programming", "data structures",
    "design patterns", "rest api", "graphql api", "database management",
    "time series", "data pipeline", "data pipelines", "data warehouse",
    "data modeling", "data visualization", "business intelligence",
    "project management", "product management", "agile methodology",
    "unit testing", "integration testing", "test automation",
    "ci cd", "ci/cd pipeline", "devops engineering",
}


def _is_bigram_valid(bigram: str) -> bool:
    """A bigram is valid if it's a known technical phrase or appears in JDs."""
    if bigram in _TECH_BIGRAMS:
        return True
    # Also accept bigrams that are in the alias map (e.g. "agentic workflows" → "agentic workflows")
    norm = _simple_norm(bigram)
    if norm in _KEYWORD_ALIASES:
        return True
    return False


def _dedup_and_filter(keywords):
    """Normalize, merge near-duplicates, remove non-technical words. Returns top 20."""
    # Separate unigrams and bigrams (bigrams contain a space)
    unigrams = {}
    bigrams = {}
    for item in keywords:
        word = item["word"]
        count = item["count"]
        is_bigram = " " in word
        target = bigrams if is_bigram else unigrams
        # Accumulate counts for same surface form
        target[word] = target.get(word, 0) + count

    # Filter bigrams: keep only valid ones (known phrases or count >= 2)
    valid_bigrams = {}
    for bigram, count in bigrams.items():
        if count >= 2 or _is_bigram_valid(bigram):
            valid_bigrams[bigram] = count
            # Reduce constituent unigram counts to avoid double-counting
            parts = bigram.split()
            for part in parts:
                if part in unigrams:
                    unigrams[part] = max(0, unigrams[part] - count)

    # Build merged output
    merged = {}

    def _add(norm_key, display_word, count):
        if norm_key in _NON_TECH_WORDS:
            return
        existing = merged.get(norm_key)
        if existing is None:
            merged[norm_key] = {"word": display_word, "count": count}
        else:
            existing["count"] += count
            if len(display_word) > len(existing["word"]):
                existing["word"] = display_word

    # Add valid bigrams
    for bigram, count in valid_bigrams.items():
        norm = _simple_norm(bigram)
        resolved = norm
        seen = {norm}
        while resolved in _KEYWORD_ALIASES:
            nxt = _KEYWORD_ALIASES[resolved]
            if nxt == resolved or nxt in seen:
                break
            seen.add(nxt)
            resolved = nxt
        _add(resolved, bigram, count)

    # Add unigrams
    for word, count in unigrams.items():
        if count <= 0:
            continue
        if word in _NON_TECH_WORDS:
            continue
        norm = _simple_norm(word)
        # Skip unigram if it's part of a valid bigram and its count was fully subsumed
        resolved = norm
        seen = {norm}
        while resolved in _KEYWORD_ALIASES:
            nxt = _KEYWORD_ALIASES[resolved]
            if nxt == resolved or nxt in seen:
                break
            seen.add(nxt)
            resolved = nxt
        if count > 0:
            _add(resolved, word, count)

    result = sorted(merged.values(), key=lambda x: x["count"], reverse=True)
    return result[:20]


def extract_keywords(descriptions, max_jds: int = 10, db=None, user_id=None):
    """Extract top 20 keywords from job descriptions (local, no LLM)."""
    if not descriptions or all(not d for d in descriptions):
        return []

    descriptions = descriptions[:max_jds]
    clean_descriptions = [strip_jd_boilerplate(d) for d in descriptions if d]
    if not clean_descriptions:
        return []

    cache_key = hashlib.sha256("|||".join(sorted(clean_descriptions)).encode()).hexdigest()
    if cache_key in _keyword_cache:
        logger.info("Keyword extraction: cache hit")
        return _keyword_cache[cache_key]

    local_terms = _local_keyword_extract(clean_descriptions)
    if not local_terms:
        return []

    result = _dedup_and_filter(local_terms)
    _cache_and_prune(cache_key, result)
    return result


def _cache_and_prune(key, value):
    if len(_keyword_cache) >= _MAX_CACHE_SIZE:
        oldest = next(iter(_keyword_cache))
        del _keyword_cache[oldest]
    _keyword_cache[key] = value
