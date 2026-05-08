import json
import logging
import uuid
import hashlib
from openai import OpenAI, APIError, RateLimitError
from ..config import settings
from .llm_utils import log_tokens, strip_jd_boilerplate

logger = logging.getLogger(__name__)

# 20 universal behavioral questions (STAR format) — no LLM needed
BEHAVIORAL_QUESTIONS = [
    {"id": "b001", "question": "Tell me about a time you had to meet a tight deadline. How did you prioritize and what was the outcome?", "guidance": "Describe the project, how you broke it down, what you deprioritized, and the result. Use specific metrics if possible."},
    {"id": "b002", "question": "Describe a conflict you had with a coworker. How did you handle it?", "guidance": "Focus on the resolution process. Show empathy, listening, and a collaborative outcome. Avoid blaming the other person."},
    {"id": "b003", "question": "Tell me about a time you made a mistake at work. What happened and what did you learn?", "guidance": "Own the mistake fully. Explain what you did to fix it, what safeguards you put in place, and how you grew from it."},
    {"id": "b004", "question": "Give an example of a time you took initiative on a project.", "guidance": "Describe what you saw that needed doing, how you proposed it, what you delivered, and the impact on the team/business."},
    {"id": "b005", "question": "Tell me about a time you had to learn a new skill or technology quickly.", "guidance": "Explain your learning process, resources you used, how you applied the new skill, and the result."},
    {"id": "b006", "question": "Describe a time you worked on a project with a difficult stakeholder.", "guidance": "Focus on communication strategies, how you managed expectations, and how you found common ground."},
    {"id": "b007", "question": "Tell me about a time you had to say no to a request.", "guidance": "Explain why you said no, how you communicated it constructively, and what alternative you offered."},
    {"id": "b008", "question": "Give an example of a time you went above and beyond your job responsibilities.", "guidance": "Describe what you did beyond expectations, why you did it, and the value it created."},
    {"id": "b009", "question": "Tell me about a time you received critical feedback. How did you respond?", "guidance": "Show you can receive feedback without defensiveness. Explain how you acted on it and what improved."},
    {"id": "b010", "question": "Describe a time you had to explain a complex technical concept to a non-technical audience.", "guidance": "Explain how you simplified the concept, what analogies you used, and how you confirmed understanding."},
    {"id": "b011", "question": "Tell me about a project that failed or was cancelled. What was your role and what did you learn?", "guidance": "Be honest about what went wrong. Focus on lessons learned and how you apply them now."},
    {"id": "b012", "question": "Give an example of how you've handled a sudden change in priorities or scope.", "guidance": "Describe your adaptability. How did you re-prioritize, communicate the change, and keep momentum?"},
    {"id": "b013", "question": "Tell me about a time you mentored or helped a teammate grow.", "guidance": "Describe your approach to teaching/mentoring. What did they learn, and what did you learn about leadership?"},
    {"id": "b014", "question": "Describe a time you identified and solved a problem before anyone else noticed it.", "guidance": "Explain how you spotted the issue, the solution you implemented, and the proactive value you created."},
    {"id": "b015", "question": "Tell me about a time you had to influence a decision without authority.", "guidance": "Focus on persuasion skills: data, relationships, framing. How did you get buy-in without formal power?"},
    {"id": "b016", "question": "Give an example of a cross-functional project you worked on.", "guidance": "Describe the teams involved, how you collaborated across boundaries, and the outcome."},
    {"id": "b017", "question": "Tell me about a time you improved a process or workflow.", "guidance": "Explain what was inefficient, how you identified the fix, what you implemented, and the measurable improvement."},
    {"id": "b018", "question": "Describe how you stay organized and manage multiple competing priorities.", "guidance": "Be specific about your system (tools, methods, routines). Give a concrete example of it working under pressure."},
    {"id": "b019", "question": "Tell me about your proudest professional achievement.", "guidance": "Choose something with measurable impact. Explain your specific contribution and why it matters to you."},
    {"id": "b020", "question": "Why are you interested in this role, and what makes you a strong fit?", "guidance": "Connect your skills and experience directly to the job requirements. Show you've researched the company."},
]


def _extract_requirements(jd_text: str) -> str:
    """Extract a compact requirements summary from JD text (regex, no LLM)."""
    # Try to find bullet-point sections (common in JDs)
    lines = jd_text.split('\n')
    requirements = []
    capturing = False
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Bullet-point lines typically start with -, •, *, or a number
        if line.startswith(('-', '•', '*')) or (len(line) > 2 and line[0].isdigit() and line[1] in ('.', ')')):
            requirements.append(line.lstrip('-•*0123456789.) '))
            capturing = True
        elif capturing and len(line) > 30:
            requirements.append(line)
        elif capturing and len(line) < 15:
            capturing = False

    if requirements:
        return '; '.join(requirements[:12])
    # Fallback: first 800 chars of stripped JD
    return strip_jd_boilerplate(jd_text, 800)


def generate_questions(job_description, job_title="", company="", count=3):
    """Generate interview questions. Behavioral from static bank, technical+role from LLM."""
    clean_jd = strip_jd_boilerplate(job_description)
    reqs = _extract_requirements(clean_jd)

    # Behavioral: from static bank (always 5, regardless of count param)
    behavioral = BEHAVIORAL_QUESTIONS[:5]

    # Technical + Role-specific: from LLM, using only requirements not full JD
    n = max(1, min(count, 5))
    system_prompt = (
        f"Generate {n} technical and {n} role-specific interview questions for this role. "
        "Each must have 'question' and 'guidance'. Return JSON: "
        '{technical: [{question, guidance}], role_specific: [{question, guidance}]}.'
    )

    user_message = (
        f"Job: {job_title or 'Not specified'} at {company or 'Not specified'}\n"
        f"Key requirements: {reqs}\nGenerate questions."
    )

    if settings.DEEPSEEK_API_KEY == "ollama":
        from ollama import chat
        try:
            logger.info("Using Ollama for interview questions...")
            response = chat(
                model="llama3.1:8b",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                format="json",
                options={"temperature": 0.7},
            )
            log_tokens(response, "interview_questions")
            result = json.loads(response["message"]["content"])
        except Exception as e:
            logger.error(f"Ollama question generation failed: {e}")
            raise RuntimeError("AI service call failed (Ollama).")
    else:
        client = OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
        try:
            logger.info("Calling DeepSeek for interview questions...")
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
                max_tokens=2000,
            )
            log_tokens(response, "interview_questions")
            result = json.loads(response.choices[0].message.content)
        except RateLimitError as e:
            logger.error(f"DeepSeek rate limit: {e}")
            raise RuntimeError("AI service is temporarily overloaded.")
        except APIError as e:
            logger.error(f"DeepSeek API error: {e}")
            raise RuntimeError("AI service call failed.")
        except json.JSONDecodeError:
            logger.error("Invalid JSON from AI for interview questions")
            raise RuntimeError("Failed to parse AI response.")

    # Assign IDs
    for category in ["technical", "role_specific"]:
        if category in result and isinstance(result[category], list):
            result[category] = [
                {"id": str(uuid.uuid4())[:8], **q}
                for q in result[category] if isinstance(q, dict) and "question" in q
            ]
        else:
            result[category] = []

    result["behavioral"] = behavioral
    return result


def evaluate_answer(question, answer, context=""):
    """Evaluate a practice answer. Context should be minimal (role title + company)."""

    system_prompt = (
        "Evaluate this interview answer. Return JSON: clarity (strong|adequate|needs_work), "
        "star_structure (excellent|partial|missing), relevance (high|medium|low), "
        "feedback (2-3 sentences), overall_score (0-100)."
    )

    ctx_suffix = f"\nRole context: {context}" if context else ""
    user_message = f"Question: {question}\nAnswer: {answer}{ctx_suffix}\nEvaluation:"

    if settings.DEEPSEEK_API_KEY == "ollama":
        from ollama import chat
        try:
            logger.info("Using Ollama for answer evaluation...")
            response = chat(
                model="llama3.1:8b",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                format="json",
                options={"temperature": 0.3},
            )
            log_tokens(response, "answer_eval")
            return json.loads(response["message"]["content"])
        except Exception as e:
            logger.error(f"Ollama evaluation failed: {e}")
            raise RuntimeError("AI service call failed (Ollama).")
    else:
        client = OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
        try:
            logger.info("Calling DeepSeek for answer evaluation...")
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=600,
            )
            log_tokens(response, "answer_eval")
            return json.loads(response.choices[0].message.content)
        except RateLimitError as e:
            logger.error(f"DeepSeek rate limit: {e}")
            raise RuntimeError("AI service is temporarily overloaded.")
        except APIError as e:
            logger.error(f"DeepSeek API error: {e}")
            raise RuntimeError("AI service call failed.")
        except json.JSONDecodeError:
            logger.error("Invalid JSON from AI for answer evaluation")
            raise RuntimeError("Failed to parse AI response.")
