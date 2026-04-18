# Job Hunter AI — Claude Code Instructions

## Project Overview
Autonomous job application agent with a React dashboard.
FastAPI backend (api.py) + React frontend (/frontend) + PostgreSQL.

## Stack
- Backend: Python 3.12, FastAPI, PostgreSQL (psycopg2), Anthropic Claude API
- Frontend: React (Vite + TypeScript), Tailwind CSS, Axios
- AI tools: tools/company_research.py, tools/job_finder.py, tools/cv_customizer.py,
  tools/cover_letter.py, tools/tracker.py
- Agent orchestrator: agent.py
- Local path: C:\Users\sadir\IdeaProjects\job-hunter\

## Folder Structure
job-hunter/
├── api.py              ← FastAPI app, all endpoints, DO NOT rename
├── agent.py            ← Agent orchestrator, DO NOT modify logic
├── config.py           ← Config, read before touching env vars
├── tools/              ← 5 agent tools, stable — touch only if asked
├── frontend/           ← React app (Vite), BUILD TARGET
├── output/             ← Generated CVs and cover letters
├── templates/          ← CV/cover letter templates
├── index.html          ← Legacy HTML dashboard, KEEP as fallback
├── .env                ← NEVER read or print this file

## Existing API Endpoints (all under /api prefix)
GET  /api/stats                    → {stats: {total_jobs, applied_today, total_applications, total_companies, success_rate}}
GET  /api/jobs                     → {jobs[], total} — params: limit, offset, status, company, order_by, desc
GET  /api/applications             → {applications[], total} — params: limit, offset, status
GET  /api/apply-today              → {applications[], count, date}
GET  /api/files                    → {files[]}
GET  /api/files/{filename}         → FileResponse
POST /api/run                      → {status, run_id} — body: {mode, limit, dry_run}
GET  /api/run/status               → {status, run_id, last_10_lines}
WS   /api/ws/logs                  → WebSocket log stream

## Database (PostgreSQL)
Tables: jobs, applications, companies
Connection: DATABASE_URL from .env via psycopg2
Schema managed by: tools/tracker.py → _create_schema()

## Key Conventions
- All new FastAPI routes go in api.py, under the existing router, prefix /api
- Pydantic models for all new request/response schemas
- Never hardcode secrets — always os.environ.get()
- React: functional components, hooks only, no class components
- Tailwind for all React styling
- API calls from React: use /api/* — backend runs on port 8000
- Frontend dev server runs on port 5173 (Vite default)

## Current Build Task
Week 1 Dashboard: React Kanban board + fit score modal
See: .claude/commands/build-kanban.md

## Do Not Touch
- .env file
- agent.py run() logic
- tools/ modules (unless explicitly asked)
- index.html (keep as fallback)