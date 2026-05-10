import json
import logging
from openai import OpenAI, APIError, RateLimitError
from ..config import settings
from .llm_utils import log_tokens, clean_json_content

logger = logging.getLogger(__name__)

# Static lookup table: common tech skills → certs/courses/projects
# Only calls LLM for skills NOT in this table
# Mapping of surface forms to canonical skill names for matching.
# Built from SKILL_SUGGESTIONS aliases + common tech abbreviations.
_SKILL_ALIASES: dict = {}


def _simple_normalize(s: str) -> str:
    """Normalize without alias resolution: lowercase, strip symbols, collapse whitespace."""
    import re
    cleaned = s.lower().strip()
    cleaned = re.sub(r"[.\-_]", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _normalize_skill(s: str) -> str:
    """Normalize for comparison. Resolves aliases, then maps to a SKILL_SUGGESTIONS
    key when possible so canonical forms are recognizable for suggestions lookup."""
    norm = _simple_normalize(s)
    # Resolve through alias map (chain: A→B→C until stable)
    seen = {norm}
    while norm in _SKILL_ALIASES:
        norm = _SKILL_ALIASES[norm]
        if norm in seen:
            break
        seen.add(norm)
    # Map to best SKILL_SUGGESTIONS key if one exists
    return _NORM_TO_SKILL_KEY.get(norm, norm)


SKILL_SUGGESTIONS = {
    "aws": [
        {"category": "certification", "title": "AWS Certified Solutions Architect – Associate", "description": "The gold-standard AWS cert covering core services, architecture patterns, and cost optimization.", "url": "https://aws.amazon.com/certification/certified-solutions-architect-associate/"},
    ],
    "azure": [
        {"category": "certification", "title": "Microsoft Certified: Azure Administrator (AZ-104)", "description": "Covers Azure compute, storage, networking, and governance. The most practical Azure entry cert.", "url": "https://learn.microsoft.com/en-us/certifications/azure-administrator/"},
    ],
    "gcp": [
        {"category": "certification", "title": "Google Cloud Associate Cloud Engineer", "description": "Foundational GCP certification covering deployment, monitoring, and maintenance of GCP projects.", "url": "https://cloud.google.com/certification/cloud-engineer"},
    ],
    "docker": [
        {"category": "course", "title": "Docker Mastery (Udemy by Bret Fisher)", "description": "Comprehensive Docker course from basics to Swarm orchestration. Most recommended Docker course.", "url": "https://www.udemy.com/course/docker-mastery/"},
    ],
    "kubernetes": [
        {"category": "certification", "title": "Certified Kubernetes Administrator (CKA)", "description": "Hands-on K8s certification from CNCF. Tests real cluster administration skills in a live environment.", "url": "https://www.cncf.io/certification/cka/"},
        {"category": "course", "title": "Kubernetes for Developers (KodeKloud)", "description": "Practical K8s course covering pods, deployments, services, and debugging.", "url": "https://kodekloud.com/courses/kubernetes-for-the-absolute-beginners/"},
    ],
    "python": [
        {"category": "project", "title": "Build a REST API with FastAPI + PostgreSQL", "description": "End-to-end project: build, test, and deploy a production-grade API. Demonstrates real-world Python skills.", "url": None},
    ],
    "react": [
        {"category": "project", "title": "Build a Full-Stack Dashboard with React + API", "description": "Create a dashboard with charts, auth, and API integration. Showcases modern React patterns.", "url": None},
    ],
    "typescript": [
        {"category": "course", "title": "Understanding TypeScript (Udemy by Maximilian Schwarzmüller)", "description": "Deep dive into TypeScript types, generics, decorators, and integration with Node/React.", "url": "https://www.udemy.com/course/understanding-typescript/"},
    ],
    "javascript": [
        {"category": "course", "title": "JavaScript: The Advanced Concepts (Zero to Mastery)", "description": "Covers closures, prototypal inheritance, async patterns, and modern ES6+ features.", "url": "https://zerotomastery.io/courses/advanced-javascript-concepts/"},
    ],
    "node.js": [
        {"category": "project", "title": "Build a Real-Time Chat App with Node.js + Socket.io", "description": "Full-stack project demonstrating WebSockets, auth, and deployment. Impressive portfolio piece.", "url": None},
    ],
    "nodejs": [
        {"category": "project", "title": "Build a Real-Time Chat App with Node.js + Socket.io", "description": "Full-stack project demonstrating WebSockets, auth, and deployment.", "url": None},
    ],
    "sql": [
        {"category": "course", "title": "SQL for Data Analysis (Mode Analytics)", "description": "Free, hands-on SQL tutorial covering window functions, CTEs, and query optimization.", "url": "https://mode.com/sql-tutorial/"},
    ],
    "postgresql": [
        {"category": "course", "title": "PostgreSQL Bootcamp (Udemy)", "description": "Comprehensive PostgreSQL course from basics to advanced indexing and performance tuning.", "url": "https://www.udemy.com/course/postgresql-bootcamp/"},
    ],
    "mongodb": [
        {"category": "certification", "title": "MongoDB Associate Developer", "description": "Official MongoDB certification covering CRUD, indexing, aggregation pipeline, and data modeling.", "url": "https://learn.mongodb.com/pages/mongodb-associate-developer-certification"},
    ],
    "machine learning": [
        {"category": "course", "title": "Machine Learning Specialization (Andrew Ng, Coursera)", "description": "The definitive ML intro. Covers supervised/unsupervised learning, neural networks, and best practices.", "url": "https://www.coursera.org/specializations/machine-learning-introduction"},
    ],
    "ml": [
        {"category": "course", "title": "Machine Learning Specialization (Andrew Ng, Coursera)", "description": "The definitive ML intro from Stanford.", "url": "https://www.coursera.org/specializations/machine-learning-introduction"},
    ],
    "ai": [
        {"category": "course", "title": "AI For Everyone (Andrew Ng, Coursera)", "description": "Non-technical introduction to AI concepts, terminology, and business applications.", "url": "https://www.coursera.org/learn/ai-for-everyone"},
    ],
    "deep learning": [
        {"category": "course", "title": "Deep Learning Specialization (Andrew Ng, Coursera)", "description": "Five-course series on neural networks, CNNs, RNNs, and sequence models.", "url": "https://www.coursera.org/specializations/deep-learning"},
    ],
    "tensorflow": [
        {"category": "certification", "title": "TensorFlow Developer Certificate", "description": "Official Google cert proving TF skills for building and training neural networks.", "url": "https://www.tensorflow.org/certificate"},
    ],
    "pytorch": [
        {"category": "course", "title": "Deep Learning with PyTorch (PyTorch official + Udacity)", "description": "Official intro to PyTorch covering tensors, autograd, neural networks, and deployment.", "url": "https://pytorch.org/tutorials/"},
    ],
    "data science": [
        {"category": "course", "title": "Data Science Professional Certificate (IBM, Coursera)", "description": "Comprehensive data science program covering Python, SQL, ML, and data viz.", "url": "https://www.coursera.org/professional-certificates/ibm-data-science"},
    ],
    "terraform": [
        {"category": "certification", "title": "HashiCorp Certified: Terraform Associate", "description": "Official Terraform cert covering IaC, state management, modules, and cloud provisioning.", "url": "https://www.hashicorp.com/certification/terraform-associate"},
    ],
    "ansible": [
        {"category": "certification", "title": "Red Hat Certified Specialist in Ansible Automation", "description": "Validates Ansible skills for automation, configuration management, and orchestration.", "url": "https://www.redhat.com/en/services/certification/red-hat-certified-specialist-in-ansible-automation"},
    ],
    "jenkins": [
        {"category": "certification", "title": "Jenkins Engineer Certification", "description": "Official Jenkins cert covering pipelines, plugins, security, and administration.", "url": "https://www.cloudbees.com/jenkins/certification"},
    ],
    "ci/cd": [
        {"category": "course", "title": "GitHub Actions: The Complete Guide (Udemy)", "description": "Covers CI/CD pipelines, workflows, secrets, and deployment automation with GitHub Actions.", "url": "https://www.udemy.com/course/github-actions-the-complete-guide/"},
    ],
    "git": [
        {"category": "course", "title": "Learn Git Branching (free, interactive)", "description": "Visual and interactive way to master Git branching, rebasing, and workflows.", "url": "https://learngitbranching.js.org/"},
    ],
    "linux": [
        {"category": "certification", "title": "CompTIA Linux+ or LPIC-1", "description": "Industry-recognized Linux cert covering system admin, scripting, networking, and security.", "url": "https://www.comptia.org/certifications/linux"},
    ],
    "django": [
        {"category": "project", "title": "Build a Production Django App with REST API", "description": "Full Django project with DRF, auth, testing, and Docker deployment.", "url": None},
    ],
    "flask": [
        {"category": "project", "title": "Build Microservices with Flask + Docker", "description": "Create containerized Flask microservices with proper error handling and tests.", "url": None},
    ],
    "graphql": [
        {"category": "course", "title": "The Modern GraphQL Bootcamp (Udemy)", "description": "Covers schemas, resolvers, Apollo, authentication, and real-time subscriptions.", "url": "https://www.udemy.com/course/graphql-bootcamp/"},
    ],
    "rest": [
        {"category": "project", "title": "Design and Document a REST API (OpenAPI/Swagger)", "description": "Design a production-grade REST API with proper status codes, pagination, and OpenAPI docs.", "url": None},
    ],
    "agile": [
        {"category": "certification", "title": "Certified ScrumMaster (CSM)", "description": "Entry-level Agile cert covering Scrum framework, roles, ceremonies, and artifacts.", "url": "https://www.scrumalliance.org/get-certified/scrum-master-track/certified-scrummaster"},
    ],
    "scrum": [
        {"category": "certification", "title": "Certified ScrumMaster (CSM)", "description": "Entry-level Agile/Scrum cert from Scrum Alliance.", "url": "https://www.scrumalliance.org/get-certified/scrum-master-track/certified-scrummaster"},
    ],
    "kafka": [
        {"category": "course", "title": "Apache Kafka Series (Udemy by Stéphane Maarek)", "description": "Comprehensive Kafka course covering producers, consumers, streams, Kafka Connect, and monitoring.", "url": "https://www.udemy.com/course/apache-kafka/"},
    ],
    "redis": [
        {"category": "course", "title": "Redis University (free, official)", "description": "Official Redis courses covering data structures, streams, search, and clustering.", "url": "https://redis.io/university/"},
    ],
    "elasticsearch": [
        {"category": "course", "title": "Elasticsearch Engineer (official Elastic training)", "description": "Covers indexing, search, aggregations, and cluster management.", "url": "https://www.elastic.co/training/elasticsearch-engineer-1"},
    ],
    "java": [
        {"category": "certification", "title": "Oracle Certified Professional: Java SE 17 Developer", "description": "Professional Java cert covering streams, concurrency, JDBC, and modern Java features.", "url": "https://education.oracle.com/java-se-17-developer/pexam_1Z0-829"},
    ],
    "go": [
        {"category": "project", "title": "Build a CLI Tool in Go", "description": "Create a practical CLI tool using Go's standard library, cobra, and proper error handling.", "url": None},
    ],
    "rust": [
        {"category": "course", "title": "The Rust Programming Language (free, official)", "description": "The Rust Book — official interactive tutorial covering ownership, borrowing, and lifetimes.", "url": "https://doc.rust-lang.org/book/"},
    ],
    "c++": [
        {"category": "course", "title": "C++ Fundamentals (Pluralsight)", "description": "Modern C++17/20 patterns, STL, smart pointers, and concurrency.", "url": "https://www.pluralsight.com/paths/cplusplus"},
    ],
    "swift": [
        {"category": "course", "title": "100 Days of SwiftUI (Hacking with Swift, free)", "description": "Project-based Swift and SwiftUI course. Build 100 apps in 100 days.", "url": "https://www.hackingwithswift.com/100/swiftui"},
    ],
    "kotlin": [
        {"category": "course", "title": "Kotlin for Android Developers (Google Codelabs)", "description": "Official Google Kotlin course covering coroutines, flows, and Jetpack Compose.", "url": "https://developer.android.com/courses/kotlin-android-fundamentals/overview"},
    ],
}


# Reverse map: normalized form → best SKILL_SUGGESTIONS key
_NORM_TO_SKILL_KEY: dict = {}
for _key in SKILL_SUGGESTIONS:
    _n = _simple_normalize(_key)
    _existing = _NORM_TO_SKILL_KEY.get(_n)
    if _existing is None or len(_key) > len(_existing):
        _NORM_TO_SKILL_KEY[_n] = _key


def _build_alias_map():
    """Derives aliases from SKILL_SUGGESTIONS entries that point to the same target."""
    from collections import defaultdict
    by_target = defaultdict(list)
    for skill, entries in SKILL_SUGGESTIONS.items():
        key = tuple(sorted((e["title"], e.get("url", "")) for e in entries))
        by_target[key].append(skill)
    for names in by_target.values():
        if len(names) > 1:
            canonical = names[0]
            for alias in names[1:]:
                norm_alias = _simple_normalize(alias)
                norm_canon = _simple_normalize(canonical)
                # Link at the normalized level
                if norm_alias != norm_canon:
                    _SKILL_ALIASES[norm_alias] = norm_canon


_build_alias_map()

# Additional manual aliases (keys are simple-normalized forms, values are simple-normalized targets)
_SKILL_ALIASES.update({
    "k8s": "kubernetes",
    "ec2": "aws",
    "s3": "aws",
    "lambda": "aws",
    "gcp": "google cloud platform",
    "google cloud": "gcp",
    "azure": "microsoft azure",
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
    "amazon web services": "aws",
})

# Flatten alias chains so every key resolves to its ultimate target in one hop
for _key in list(_SKILL_ALIASES.keys()):
    _seen = {_key}
    _val = _SKILL_ALIASES[_key]
    while _val in _SKILL_ALIASES:
        if _val in _seen:
            break
        _seen.add(_val)
        _val = _SKILL_ALIASES[_val]
    _SKILL_ALIASES[_key] = _val


def analyze_skills_gap(resume_skills, job_descriptions, db=None, user_id=None):
    """Compare resume skills against market demand from JDs."""
    from .keyword_extractor import extract_keywords

    try:
        market_keywords = extract_keywords(job_descriptions, db=db, user_id=user_id)
    except Exception:
        market_keywords = []

    if not market_keywords:
        return {
            "matching": [], "missing": [], "extra": [], "matchScore": 0,
            "radarData": [], "totalSkillsOnResume": len(resume_skills) if resume_skills else 0,
            "totalDemandedSkills": 0,
        }

    # Build normalized user skill set with original→normalized mapping
    user_skills_norm = {}
    for s in resume_skills:
        if s and s.strip():
            orig = s.strip()
            norm = _normalize_skill(orig)
            user_skills_norm[norm] = orig

    # Build normalized market skill set with normalized→original (display) mapping
    market_skill_norms = {}
    market_freq = {}
    for item in market_keywords:
        word = item["word"].lower().strip()
        norm = _normalize_skill(word)
        count = item["count"]
        # Keep most specific original name as display when multiple map to same norm
        existing = market_skill_norms.get(norm)
        if existing is None or len(word) > len(existing):
            market_skill_norms[norm] = word
        market_freq[norm] = market_freq.get(norm, 0) + count

    user_norm_set = set(user_skills_norm.keys())
    market_norm_set = set(market_skill_norms.keys())

    matching_norms = user_norm_set & market_norm_set
    missing_norms = market_norm_set - user_norm_set
    extra_norms = user_norm_set - market_norm_set

    # Return original display names
    matching = sorted(market_skill_norms[n] for n in matching_norms)
    missing = sorted(market_skill_norms[n] for n in missing_norms)
    extra = sorted(user_skills_norm[n] for n in extra_norms)

    total_demanded = len(market_norm_set)
    match_score = round((len(matching_norms) / total_demanded) * 100, 1) if total_demanded > 0 else 0

    all_relevant = sorted(
        [market_skill_norms[n] for n in (matching_norms | missing_norms)],
        key=lambda s: market_freq.get(_normalize_skill(s), 0), reverse=True,
    )[:12]

    radar_data = [
        {"skill": s, "demandCount": market_freq.get(_normalize_skill(s), 0),
         "hasIt": _normalize_skill(s) in user_norm_set}
        for s in all_relevant
    ]

    return {
        "matching": matching, "missing": missing, "extra": extra,
        "matchScore": match_score, "radarData": radar_data,
        "totalSkillsOnResume": len(resume_skills),
        "totalDemandedSkills": total_demanded,
    }


def _normalize_suggestion(item: dict, skill_name_fallback: str = "") -> dict:
    """Normalize LLM output field names to match GapSuggestion schema."""
    normalized = {}
    # Map skill_name → skill
    if "skill" in item:
        normalized["skill"] = item["skill"]
    elif "skill_name" in item:
        normalized["skill"] = item["skill_name"]
    elif skill_name_fallback:
        normalized["skill"] = skill_name_fallback
    else:
        return None  # can't normalize without a skill name
    # Copy known fields, drop unknowns
    for field in ("category", "title", "description"):
        normalized[field] = item.get(field, "")
    normalized["url"] = item.get("url") or None
    return normalized


def generate_gap_suggestions(resume_skills, missing_skills, job_descriptions=None, db=None, user_id=None):
    """AI call for gap suggestions. Uses static lookup first, LLM only for unknowns."""
    if not missing_skills:
        return []

    suggestions = []
    unknown = []

    for skill in missing_skills:
        skill_lower = skill.lower().strip()
        entry = SKILL_SUGGESTIONS.get(skill_lower)
        if entry is None:
            entry = SKILL_SUGGESTIONS.get(_normalize_skill(skill))
        if entry is None:
            entry = SKILL_SUGGESTIONS.get(_simple_normalize(skill))
        if entry:
            for s in entry:
                suggestions.append({"skill": skill, **s})
        else:
            unknown.append(skill)

    # Only call LLM for skills not in static table
    if not unknown:
        return suggestions

    system_prompt = (
        "Suggest practical ways to learn skills. For each skill, recommend a certification, "
        "course, or project. Output ONLY a valid JSON array — no markdown, no code fences, "
        "no text before or after. The first character must be [ and the last must be ].\n"
        "Format: [{\"skill\": \"skill_name\", \"category\": \"certification|course|project\", "
        "\"title\": \"...\", \"description\": \"1-2 sentences\", \"url\": \"optional URL or null\"}]"
    )

    user_message = (
        f"My skills: {', '.join(resume_skills)}\n"
        f"Skills to develop: {', '.join(unknown)}\n"
        "Suggestions JSON:"
    )

    if settings.DEEPSEEK_API_KEY == "ollama":
        try:
            from ollama import chat
            logger.info("Using Ollama for gap suggestions...")
            response = chat(
                model="llama3.1:8b",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                format="json",
                options={"temperature": 0.5},
            )
            log_tokens(response, "gap_suggestions", db=db, user_id=user_id, model="llama3.1:8b")
            content = response["message"]["content"]
            result = clean_json_content(content)
            items = result if isinstance(result, list) else []
            for item in items:
                norm = _normalize_suggestion(item)
                if norm:
                    suggestions.append(norm)
        except Exception as e:
            logger.warning(f"Ollama gap suggestions failed: {e}")
    else:
        client = OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
        try:
            logger.info("Calling DeepSeek for gap suggestions...")
            response = client.chat.completions.create(
                model="deepseek-v4-flash",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.5,
                max_tokens=4000,
                extra_body={"thinking": {"type": "disabled"}},
            )
            log_tokens(response, "gap_suggestions", db=db, user_id=user_id, model="deepseek-v4-flash")
            content = response.choices[0].message.content
            finish = response.choices[0].finish_reason
            if not content:
                if finish == 'length':
                    logger.warning("DeepSeek gap suggestions hit max_tokens, content empty")
                else:
                    logger.warning("DeepSeek gap suggestions content empty, finish_reason=%s", finish)
                return suggestions
            parsed = clean_json_content(content)
            items = []
            if isinstance(parsed, list):
                items = parsed
            elif isinstance(parsed, dict):
                # Try common wrapper keys first
                for key in ("suggestions", "results", "data"):
                    if key in parsed and isinstance(parsed[key], list):
                        items = parsed[key]
                        break
                if not items:
                    for v in parsed.values():
                        if isinstance(v, list):
                            items = v
                            break
            for item in items:
                norm = _normalize_suggestion(item)
                if norm:
                    suggestions.append(norm)
        except (RateLimitError, APIError, json.JSONDecodeError, Exception) as e:
            logger.warning(f"DeepSeek gap suggestions failed: {e}")

    return suggestions
