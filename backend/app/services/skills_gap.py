import json
import logging
from openai import OpenAI, APIError, RateLimitError
from ..config import settings
from .llm_utils import log_tokens

logger = logging.getLogger(__name__)

# Static lookup table: common tech skills → certs/courses/projects
# Only calls LLM for skills NOT in this table
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


def analyze_skills_gap(resume_skills, job_descriptions):
    """Compare resume skills against market demand from JDs."""
    from .keyword_extractor import extract_keywords

    try:
        market_keywords = extract_keywords(job_descriptions)
    except Exception:
        market_keywords = []

    if not market_keywords:
        return {
            "matching": [], "missing": [], "extra": [], "matchScore": 0,
            "radarData": [], "totalSkillsOnResume": len(resume_skills) if resume_skills else 0,
            "totalDemandedSkills": 0,
        }

    user_skills_lower = set(s.lower().strip() for s in resume_skills if s and s.strip())
    market_skill_names = set()
    market_freq = {}
    for item in market_keywords:
        word = item["word"].lower().strip()
        count = item["count"]
        market_skill_names.add(word)
        market_freq[word] = count

    matching = sorted(s for s in user_skills_lower if s in market_skill_names)
    missing = sorted(s for s in market_skill_names if s not in user_skills_lower)
    extra = sorted(s for s in user_skills_lower if s not in market_skill_names)

    total_demanded = len(market_skill_names)
    match_score = round((len(matching) / total_demanded) * 100, 1) if total_demanded > 0 else 0

    all_relevant = sorted(
        [s for s in set(matching + missing)],
        key=lambda s: market_freq.get(s, 0), reverse=True,
    )[:12]

    radar_data = [{"skill": s, "demandCount": market_freq.get(s, 0), "hasIt": s in user_skills_lower} for s in all_relevant]

    return {
        "matching": matching, "missing": missing, "extra": extra,
        "matchScore": match_score, "radarData": radar_data,
        "totalSkillsOnResume": len(resume_skills),
        "totalDemandedSkills": total_demanded,
    }


def generate_gap_suggestions(resume_skills, missing_skills, job_descriptions=None):
    """AI call for gap suggestions. Uses static lookup first, LLM only for unknowns."""
    if not missing_skills:
        return []

    suggestions = []
    unknown = []

    for skill in missing_skills:
        skill_lower = skill.lower().strip()
        if skill_lower in SKILL_SUGGESTIONS:
            for s in SKILL_SUGGESTIONS[skill_lower]:
                suggestions.append({"skill": skill, **s})
        else:
            unknown.append(skill)

    # Only call LLM for skills not in static table
    if not unknown:
        return suggestions

    system_prompt = (
        "Suggest practical ways to learn these skills. For each: skill name, "
        'category ("certification"|"course"|"project"), title, description (1-2 sentences), '
        "url (optional). Return ONLY a JSON array."
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
            log_tokens(response, "gap_suggestions")
            content = response["message"]["content"]
            result = json.loads(content)
            if isinstance(result, list):
                suggestions.extend(result)
        except Exception as e:
            logger.warning(f"Ollama gap suggestions failed: {e}")
    else:
        client = OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
        try:
            logger.info("Calling DeepSeek for gap suggestions...")
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
                temperature=0.5,
                max_tokens=1500,
            )
            log_tokens(response, "gap_suggestions")
            content = response.choices[0].message.content
            parsed = json.loads(content)
            if isinstance(parsed, list):
                suggestions.extend(parsed)
            elif isinstance(parsed, dict):
                for v in parsed.values():
                    if isinstance(v, list):
                        suggestions.extend(v)
        except (RateLimitError, APIError, json.JSONDecodeError, Exception) as e:
            logger.warning(f"DeepSeek gap suggestions failed: {e}")

    return suggestions
