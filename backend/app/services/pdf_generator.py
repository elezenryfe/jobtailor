import os
import uuid
import logging
import asyncio
from jinja2 import Environment, FileSystemLoader
from ..config import settings

logger = logging.getLogger(__name__)

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))


def html_to_pdf(html_string: str, output_path: str):
    """
    Convert HTML string to PDF using a new Playwright browser each call.
    This avoids thread‑switching greenlet errors.
    """
    # Windows requires the ProactorEventLoop to support subprocesses inside threads.
    if os.name == "nt":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.set_content(html_string)
            page.pdf(
                path=output_path,
                format="Letter",
                margin={"top": "1in", "bottom": "1in", "left": "1in", "right": "1in"},
            )
            page.close()
        finally:
            browser.close()


def generate_resume_pdf(resume_data: dict, output_dir: str) -> str:
    template = env.get_template("resume_template.html")
    html_out = template.render(resume=resume_data)
    filename = f"{uuid.uuid4()}_resume.pdf"
    filepath = os.path.join(output_dir, filename)
    os.makedirs(output_dir, exist_ok=True)
    try:
        html_to_pdf(html_out, filepath)
        logger.info(f"Generated resume PDF: {filepath}")
        return filepath
    except Exception as e:
        logger.error(f"Resume PDF generation failed: {e}")
        raise RuntimeError("Failed to generate resume PDF.")


def generate_cover_letter_pdf(letter_text: str, candidate_name: str, output_dir: str) -> str:
    template = env.get_template("cover_letter_template.html")
    html_out = template.render(
        letter_body=letter_text.replace("\n", "<br>"), candidate_name=candidate_name
    )
    filename = f"{uuid.uuid4()}_cover.pdf"
    filepath = os.path.join(output_dir, filename)
    os.makedirs(output_dir, exist_ok=True)
    try:
        html_to_pdf(html_out, filepath)
        logger.info(f"Generated cover letter PDF: {filepath}")
        return filepath
    except Exception as e:
        logger.error(f"Cover letter PDF generation failed: {e}")
        raise RuntimeError("Failed to generate cover letter PDF.")