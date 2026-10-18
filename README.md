# JobSort

JobSort is a personal job-search workspace. Upload your resume once, and JobSort uses an AI model to read and structure it. Then, for any job description, it produces a tailored resume and cover letter as print-ready PDFs. Around that core it adds a visual application tracker, job search across major boards, analytics on your pipeline, a skills-gap analyzer, and an interview-prep coach.

It runs locally (FastAPI + React + SQLite) and can use either the DeepSeek API or a local Ollama model, so your resume data never has to leave your machine if you choose Ollama.

---

## What it does (non-technical)

| Feature | What you get |
| --- | --- |
| **Resume upload** | Drop in a PDF. JobSort extracts the text and converts it into clean, editable sections (summary, experience, education, skills, certifications). |
| **Tailored documents** | Paste a job description or pick a saved job. The AI rewrites your resume to match the role and writes a cover letter. You can preview and edit everything before exporting. |
| **PDF export** | Download polished resume and cover-letter PDFs, rendered from HTML templates. |
| **Job board** | A drag-and-drop Kanban board with six stages: Saved → Applied → Phone Screen → Onsite → Offer → Rejected. Keep notes, links, and the resume you used with each job. |
| **Job search** | Search live listings by keyword, location, employment type, remote-only, and salary range. Save any result straight to your board with one click. |
| **Browser extension** | A Chrome extension adds a one-click "save this job" button on LinkedIn, Indeed, Glassdoor, Monster, ZipRecruiter, Dice, SimplyHired, Wellfound, and CareerBuilder. |
| **Analytics** | Application funnel, response rate, applications over time, top keywords across job descriptions, average time in each stage, and a per-company pipeline view. |
| **Skills gap analyzer** | Compares the skills on your resume against the jobs you have saved, shows a match score plus covered/missing skills, and suggests what to learn next. |
| **Interview prep** | Generates behavioral, technical, and role-specific questions from a job description, then evaluates your practice answers and keeps a history. |
| **Google sign-in** | Sign in with Google; your resumes, jobs, and documents are tied to your account. |

## Tech stack

| Layer | Technologies |
| --- | --- |
| **Backend** | Python, FastAPI, SQLAlchemy 2, SQLite, Pydantic v2, python-jose (JWT), google-auth, pdfplumber, Playwright (headless Chromium), Jinja2, OpenAI Python SDK (DeepSeek-compatible), Ollama |
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, React Router 7, Axios, `@react-oauth/google`, `@dnd-kit` (drag-and-drop), Recharts |
| **Browser extension** | Chrome Manifest V3, vanilla JS content scripts, `chrome.identity` OAuth |
| **AI providers** | DeepSeek via an OpenAI-compatible endpoint, or a local Ollama model (`llama3.1:8b`) |
| **Job data** | JSearch (RapidAPI) with Adzuna as a fallback |

## Architecture

```
┌──────────────────────────┐        ┌──────────────────────────────┐
│ React SPA (Vite :5173)   │  HTTP  │ FastAPI (:8000)              │
│  pages / components      │ ─────> │  routers / services          │
│  AuthContext (JWT)       │ <───── │  SQLAlchemy ──> SQLite       │
└──────────────────────────┘        │      │                       │
        ▲                           │      ├─ DeepSeek / Ollama     │
        │ postMessage / REST        │      ├─ pdfplumber           │
┌───────┴──────────────────┐        │      ├─ Playwright + Jinja2  │
│ Chrome extension (MV3)   │ ─────> │      ├─ JSearch / Adzuna     │
│  scrape job posting      │        │      └─ Google token verify  │
└──────────────────────────┘        └──────────────────────────────┘
```

### Backend (`backend/app/`)

| File | Role |
| --- | --- |
| `main.py` | App setup, CORS, static mount for generated PDFs, router registration |
| `config.py` | Environment-variable settings |
| `database.py` | SQLAlchemy engine, session factory, `get_db` dependency |
| `models.py` | `User`, `Resume`, `TailoredDocument`, `Job`, `InterviewPrep`, `LLMCallLog` |
| `schemas.py` | Pydantic request/response models |
| `auth.py` | Google ID-token verification, JWT creation, `get_current_user` |
| `routers/auth.py` | Google login, current user, profile update |
| `routers/resume.py` | PDF upload → text extraction → AI structuring; list/delete resumes |
| `routers/tailor.py` | Tailor resume + cover letter, regenerate PDFs, no-AI PDF test |
| `routers/jobs.py` | Kanban job CRUD and AI field extraction from a pasted posting |
| `routers/analytics.py` | Funnel, timeline, keywords, time-in-stage, company pipeline |
| `routers/gap_analyzer.py` | Skills gap analysis and learning suggestions |
| `routers/interview.py` | Generate questions, evaluate answers, history |
| `routers/job_search.py` | Aggregated job search |
| `services/resume_parser.py` | pdfplumber text extraction, cleaning, PII pre-extraction, AI structuring |
| `services/ai_tailor.py` | Resume tailoring and cover-letter generation |
| `services/jd_extractor.py` | Pulls title, company, URL, etc. from a job description |
| `services/pdf_generator.py` | Jinja2 HTML → Playwright Chromium → PDF |
| `services/job_search.py` | JSearch and Adzuna clients with in-memory TTL cache |
| `services/keyword_extractor.py` | Local TF-IDF keyword extraction with LLM cleanup |
| `services/skills_gap.py` | Skill alias normalization, matching, LLM suggestions |
| `services/interview_coach.py` | Question generation and answer evaluation |
| `services/llm_utils.py` | Token logging, JSON cleanup, JD boilerplate stripping, caching, rate limiting |
| `templates/` | `resume_template.html`, `cover_letter_template.html` |

### Frontend (`frontend/src/`)

| Route | Page | Purpose |
| --- | --- | --- |
| `/login` | `Login.jsx` | Google Sign-In |
| `/` | `Dashboard.jsx` | Upload/select resume, paste JD or pick saved job, generate and edit documents |
| `/profile` | `ProfilePage.jsx` | Edit name and email used in generated documents |
| `/board` | `BoardPage.jsx` | Drag-and-drop application board |
| `/job-search` | `JobSearchPage.jsx` | Search live listings and save them to the board |
| `/analytics` | `AnalyticsPage.jsx` | Funnel, timeline, keywords, time-in-stage, company pipeline charts |
| `/gap-analyzer` | `GapAnalyzerPage.jsx` | Resume-vs-saved-jobs skill matching |
| `/interview-prep` | `InterviewPrepPage.jsx` | Question generation and answer practice |

Providers are composed in `main.jsx`: Router → Theme → Google OAuth → Auth. `services/api.js` is the Axios instance that injects the JWT and redirects on 401. Theme and auth state persist in `localStorage`; the UI uses Tailwind v4 with CSS design tokens and a `dark` class.

### Data flow

1. **Upload:** PDF → `pdfplumber` text extraction → cleaning/URL/PII stripping → AI returns structured JSON → stored in `Resume.structured_data` and the original file in `UPLOAD_DIR`.
2. **Tailor:** job description → boilerplate stripping and keyword extraction → AI rewrites the resume JSON and/or writes a cover letter → Jinja2 renders HTML → Playwright prints PDFs → served under `/api/files/<user_id>/<uuid>_resume.pdf`.
3. **Auth:** Google ID token → verified server-side with Google → user found or created → backend issues an HS256 JWT → every request sends `Authorization: Bearer <jwt>`.

### Cost controls

The app is built to keep LLM usage small: regex pre-extraction for email/phone, compressed system prompts, JD boilerplate stripping, local TF-IDF before keyword LLM calls, request deduplication via hashes, in-memory caches, parallel resume/cover-letter calls, and a per-user rate limit. Every call logs prompt/completion/total tokens to `llm_call_logs`. Details are in [`LLM_OPTIMIZATION.md`](LLM_OPTIMIZATION.md); the UI design system is documented in [`DESIGN.md`](DESIGN.md).

### API overview

| Prefix | Endpoints |
| --- | --- |
| `/api/auth` | `POST /google`, `GET /me`, `PATCH /profile` |
| `/api/resume` | `POST /upload`, `GET /list`, `DELETE /{resume_id}` |
| `/api/tailor` | `POST /`, `POST /regenerate-pdf`, `POST /test-pdf` |
| `/api/jobs` | `POST /`, `POST /extract`, `GET /`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}` |
| `/api/analytics` | `GET /funnel`, `GET /timeline`, `GET /keywords`, `GET /time-in-stage`, `GET /company-pipeline` |
| `/api/gap-analyzer` | `GET /analyze`, `GET /suggestions` |
| `/api/interview` | `POST /generate`, `POST /evaluate`, `GET /history` |
| `/api/job-search` | `POST /search` |

Every functional API route requires a JWT except `POST /api/auth/google`; the `/` health message, `/docs`, and the `/api/files` static mount are public.

## Getting started

### Prerequisites

- Python 3.10+
- Node.js 20.19+ (required by Vite 8)
- A Google OAuth **Web application** client (for sign-in)
- A DeepSeek API key, **or** [Ollama](https://ollama.com) running locally
- Optional: a JSearch key (RapidAPI) and/or Adzuna credentials for live job search

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium       # required for PDF generation
```

Create `backend/.env`:

```dotenv
DATABASE_URL=sqlite:///./jobsort.db
SECRET_KEY=replace-with-a-long-random-string
GOOGLE_CLIENT_ID=your-google-oauth-client-id

# AI: leave the key empty and set the value to "ollama" to use local Ollama
DEEPSEEK_API_KEY=your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Optional job search providers
JSEARCH_API_KEY=
ADZUNA_APP_ID=
ADZUNA_APP_KEY=

UPLOAD_DIR=./uploads
ACCESS_TOKEN_EXPIRE_MINUTES=1440
LOG_LEVEL=INFO
```

Run it:

```bash
uvicorn app.main:app --reload
```

The API is at `http://localhost:8000` and interactive docs at `http://localhost:8000/docs`. Tables are created automatically on startup.

For local AI, install Ollama, run `ollama pull llama3.1:8b`, and set `DEEPSEEK_API_KEY=ollama`.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

```bash
npm run dev        # http://localhost:5173
npm run build      # production build
npm run lint       # ESLint
```

### Browser extension

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the `extension/` directory.
3. Open the extension popup, sign in with Google, and set the API URL (default `http://localhost:8000`) and Google client ID if needed.

The extension scrapes the open job posting (with JSON-LD fallback when site selectors change) and posts it to `/api/jobs/`.

## Configuration reference

| Backend variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./jobsort.db` | Database connection string |
| `SECRET_KEY` | `dev-secret` | JWT signing key — **set a real value for anything beyond local use** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | JWT lifetime (24 hours) |
| `GOOGLE_CLIENT_ID` | — | Verifies Google ID tokens |
| `DEEPSEEK_API_KEY` | — | DeepSeek key, or `ollama` for local models |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | OpenAI-compatible endpoint |
| `UPLOAD_DIR` | `./uploads` | Uploaded PDFs and generated output |
| `LOG_LEVEL` | `INFO` | Python logging level |
| `JSEARCH_API_KEY` | — | Primary job-search provider |
| `JSEARCH_BASE_URL` | `https://jsearch.p.rapidapi.com` | JSearch endpoint |
| `JSEARCH_CACHE_TTL` | `300` | Search cache lifetime in seconds |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | — | Optional fallback provider |

| Frontend variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Backend base URL (defaults to `http://localhost:8000`) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID used by the sign-in button |

## Repository layout

```
backend/
  app/
    routers/        API endpoints
    services/       AI, PDF, parsing, job search, analytics helpers
    templates/      Jinja2 HTML for PDF output
  requirements.txt
frontend/
  src/
    pages/          Route-level screens
    components/     Board, cards, layout, modals
    context/        Auth and theme providers
    services/       Axios client
extension/          Chrome MV3 "save this job" extension
DESIGN.md           Visual design system and tokens
LLM_OPTIMIZATION.md LLM call inventory and token-cost optimizations
```

## Security notes

- Never commit `backend/.env` or `frontend/.env`; both are git-ignored.
- Set a strong `SECRET_KEY`. The built-in `dev-secret` default is only acceptable for local development.
- Generated PDFs are served from `/api/files/` with unguessable UUID filenames but without per-user authorization. Treat this as a local/self-hosted tool, or put the static mount behind auth before exposing it publicly.
- Uploaded resumes and the SQLite database contain personal data. Both are git-ignored (`*.pdf`, `*.db`) and should be included in your backups/privacy plan.

## License

No license is included. This is a personal project; add one before distributing or accepting contributions.
