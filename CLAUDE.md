# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

JobSort is a full-stack app that uploads a resume PDF, extracts and structures its content with AI, then generates a tailored resume and cover letter matched to a job description.

- **Backend**: Python FastAPI, SQLAlchemy + SQLite, Google OAuth + JWT, DeepSeek (or Ollama) for AI, Playwright for PDF rendering, Jinja2 HTML templates
- **Frontend**: React 19, Vite 8, Tailwind CSS v4, React Router v7, `@react-oauth/google`

## Commands

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload          # dev server at http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # production build
npm run lint         # ESLint
```

### Environment variables

Backend (`backend/.env`):
```
DATABASE_URL=sqlite:///./jobsort.db
SECRET_KEY=<random-string>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
DEEPSEEK_API_KEY=<deepseek-api-key>   # set to "ollama" to use local Ollama instead
DEEPSEEK_BASE_URL=https://api.deepseek.com
UPLOAD_DIR=./uploads
```

Frontend (`frontend/.env`):
```
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

## Architecture

### Backend (`backend/app/`)

| File | Role |
|------|------|
| `main.py` | FastAPI app creation, CORS, static file mount for generated PDFs, router registration |
| `config.py` | All env vars loaded into `Settings` dataclass |
| `database.py` | SQLAlchemy engine, session factory, `get_db` dependency |
| `models.py` | Three models: `User`, `Resume`, `TailoredDocument` |
| `schemas.py` | Pydantic request/response models |
| `auth.py` | Google ID token verification, JWT creation, `get_current_user` dependency |
| `routers/auth.py` | `POST /api/auth/google` (login/find-or-create), `GET /api/auth/me` |
| `routers/resume.py` | `POST /api/resume/upload` (PDF upload → text extraction → AI structuring → DB save), `GET /api/resume/list` |
| `routers/tailor.py` | `POST /api/tailor/` (AI tailor + cover letter + PDF generation), `POST /api/tailor/test-pdf` (no-AI PDF test) |
| `services/resume_parser.py` | `extract_text_from_pdf` (pdfplumber), `structure_resume_with_ai` (DeepSeek or Ollama) |
| `services/ai_tailor.py` | `tailor_resume` (tailors resume JSON to job desc), `generate_cover_letter` — both support DeepSeek or Ollama |
| `services/pdf_generator.py` | Jinja2 HTML rendering + Playwright (Chromium headless) → PDF |
| `templates/` | `resume_template.html` and `cover_letter_template.html` (Jinja2, rendered to PDF) |

**Data flow for the core feature**: Upload PDF → `pdfplumber` extracts text → AI structures into JSON (`full_name`, `email`, `experience[]`, `education[]`, `skills[]`, `certifications[]`) → stored in `resumes.structured_data`. When user submits a job description → AI tailors the JSON and generates a cover letter → Jinja2 renders HTML → Playwright renders HTML to PDF → PDFs served via `/api/files/`.

**Auth flow**: Frontend Google Sign-In → ID token sent to `POST /api/auth/google` → backend verifies with Google, finds or creates `User`, returns a JWT → all subsequent requests use `Authorization: Bearer <jwt>`.

### Frontend (`frontend/src/`)

| File | Role |
|------|------|
| `main.jsx` | Provider stack: BrowserRouter → ThemeProvider → GoogleOAuthProvider → AuthProvider → App |
| `App.jsx` | Routes: `/login` (public), `/` (protected behind `RequireAuth` + `Layout`) |
| `context/AuthContext.jsx` | Auth state, `loginWithGoogle`, `logout`, token persistence in localStorage |
| `context/ThemeContext.jsx` | Dark/light toggle, persisted in localStorage, toggles `dark` class on `<html>` |
| `services/api.js` | Axios instance with base URL, auth header injection, 401 interceptor |
| `pages/Login.jsx` | Google Sign-In button, redirects to `/` on success |
| `pages/Dashboard.jsx` | Upload, select resume, paste job description, generate tailored docs, view/download PDFs |
| `components/Layout.jsx` | Sidebar + Topbar + `<Outlet>` |
| `components/Sidebar.jsx` | Navigation, theme toggle, user info, logout, collapsible (desktop) / drawer (mobile) |
| `components/RequireAuth.jsx` | Redirects to `/login` if not authenticated |

**Styling**: Tailwind CSS v4 with `dark:` variants. The `@tailwindcss/vite` plugin handles compilation. No separate config file needed for Tailwind v4.

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
