# Job Hunter AI 🤖

> An autonomous AI agent that finds jobs, researches companies, tailors your CV, and writes cover letters — all on autopilot.

![Job Hunter AI Dashboard](docs/demo.gif)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue.svg)](https://www.postgresql.org/)

---

## What is this?

Job hunting is exhausting. You spend hours scrolling job boards, rewriting the same CV, and sending generic cover letters into the void.

**Job Hunter AI eliminates all of that.**

You set your preferences once. The agent does the rest — finding relevant jobs, analyzing each company with Claude AI, generating a tailored CV and cover letter per role, and tracking everything in a clean dashboard.

Built for **freshers and early-career job seekers** in technical roles (Software Engineering, Backend, Data Engineering).

---

## Features

- **Autonomous job search** — pulls listings from Tavily and Exa across multiple roles and locations
- **AI company research** — Claude analyzes tech stack, culture, and fit score for every company
- **Tailored CV generation** — customizes your base CV to match each job description
- **Cover letter writing** — generates professional, role-specific cover letters
- **Live dashboard** — real-time stats, job tracking, application history
- **WebSocket log streaming** — watch the agent work in real-time from the browser
- **PostgreSQL persistence** — all jobs, applications, and research stored reliably
- **Cost-aware design** — processes only what you need, respects API limits

---

## Demo

> 📸 Screenshot / GIF placeholder — add your own after first run

![Dashboard](docs/dashboard.png)
![Run Agent](docs/run_agent.png)
![Jobs](docs/jobs.png)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI / LLM | Anthropic Claude |
| Job Search | Tavily API, Exa API |
| Backend | FastAPI, Python 3.10+ |
| Database | PostgreSQL |
| Frontend | HTML, CSS, Vanilla JS |
| Real-time | WebSockets |
| Document Generation | python-docx |

---

## Prerequisites

Before you start, make sure you have:

- Python 3.10 or higher
- PostgreSQL 14 or higher (running locally or remote)
- API keys for:
  - [Anthropic Claude](https://console.anthropic.com/)
  - [Tavily](https://app.tavily.com/)
  - [Exa](https://dashboard.exa.ai/)

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Tanzil-Ahmed/job-hunter-agent.git
cd job-hunter-agent
```

### 2. Create and activate virtual environment

```bash
python -m venv .venv

# Windows
.\.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# Database
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/job_hunter

# AI
ANTHROPIC_API_KEY=your_anthropic_key

# Search
TAVILY_API_KEY=your_tavily_key
EXA_API_KEY=your_exa_key

# Your profile (used for CV + cover letter)
CANDIDATE_EMAIL=your@email.com
CANDIDATE_PHONE=+91-XXXXXXXXXX
CANDIDATE_LINKEDIN=https://linkedin.com/in/yourprofile
CANDIDATE_GITHUB=https://github.com/yourusername
```

### 5. Create the database

```bash
psql -U postgres -c "CREATE DATABASE job_hunter;"
```

### 6. Start the application

```bash
uvicorn api:app --reload
```

Open your browser at: **http://127.0.0.1:8000**

---

## How to Use

### From the Dashboard

1. Open **http://127.0.0.1:8000**
2. Go to **Run Agent**
3. Set your job limit (start with 1–3 for testing)
4. Toggle **Dry Run** ON if you just want to test without generating documents
5. Click **Start**
6. Watch live logs stream in the console
7. Go to **Jobs** and **Applications** to see results
8. Go to **Files** to download generated CVs and cover letters

### From the CLI

```bash
# Run with limit of 5 jobs
python agent.py --max 5

# Dry run (no document generation, no API cost for Claude generation)
python agent.py --max 3 --dry-run

# Top N by fit score
python agent.py --top 5
```

---

## Project Structure

```
job-hunter-agent/
├── agent.py              # Main orchestrator
├── api.py                # FastAPI server + WebSocket
├── config.py             # Configuration
├── index.html            # Frontend dashboard
├── requirements.txt
├── .env.example
│
├── tools/
│   ├── job_finder.py     # Tavily + Exa job search
│   ├── company_research.py  # Claude AI company analysis
│   ├── cv_customizer.py  # CV tailoring
│   ├── cover_letter.py   # Cover letter generation
│   └── tracker.py        # PostgreSQL database layer
│
└── output/               # Generated CVs + cover letters (gitignored)
```

---

## Configuration

Edit `config.py` to customize:

- Target roles (e.g. Software Engineer, Backend Developer, Data Engineer)
- Target locations (e.g. Bengaluru, Remote India)
- CV template path
- Output directory

---

## API Reference

The FastAPI server exposes the following endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Dashboard UI |
| GET | `/api/stats` | Aggregate stats |
| GET | `/api/jobs` | Job listings with filters |
| GET | `/api/applications` | Application history |
| GET | `/api/apply-today` | Today's applications |
| GET | `/api/files` | Generated files list |
| GET | `/api/files/{filename}` | Download a file |
| POST | `/api/run` | Start the agent |
| GET | `/api/run/status` | Current run status |
| WS | `/api/ws/logs` | Live log streaming |

---

## Cost Guide

This tool uses paid APIs. Here's a rough estimate per run:

| Jobs Processed | Estimated Cost |
|---------------|----------------|
| 1 job | ~$0.05–$0.15 |
| 5 jobs | ~$0.25–$0.75 |
| 10 jobs | ~$0.50–$1.50 |

**Tips to reduce cost:**
- Use **Dry Run** mode while testing
- Start with `--max 1` to verify pipeline
- Job search (Tavily + Exa) has its own free tier limits

---

## Roadmap

- [ ] Resume parser (auto-extract your base profile)
- [ ] Email notifications when new jobs are found
- [ ] Auto-apply to supported job boards
- [ ] Multi-user support
- [ ] Docker deployment
- [ ] PostgreSQL cloud deployment guide (Railway / Render)
- [ ] Smarter job filtering (reduce irrelevant results)
- [ ] Interview preparation notes per company

---

## Contributing

Contributions are welcome. This project is built for the community — especially freshers who can't afford expensive job coaching tools.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

Please open an issue first for major changes.

---

## Author

**Tanzil Ahmed**
- GitHub: [@Tanzil-Ahmed](https://github.com/Tanzil-Ahmed)

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgements

- [Anthropic](https://anthropic.com) for Claude AI
- [Tavily](https://tavily.com) for job search API
- [Exa](https://exa.ai) for semantic search
- [FastAPI](https://fastapi.tiangolo.com) for the backend framework

---

> Built with the belief that every job seeker deserves an unfair advantage.