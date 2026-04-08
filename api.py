import os
import json
import threading
import datetime
import pathlib
import logging
import queue
import uuid
import subprocess
import asyncio

from typing import Optional

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────
# CONFIG
# ─────────────────────────────
BASE_DIR = pathlib.Path(__file__).parent.resolve()
DATABASE_URL = os.environ.get("DATABASE_URL")
PYTHON_EXEC = os.sys.executable  # portable — uses whatever python runs this file

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

# ─────────────────────────────
# DB HELPERS
# ─────────────────────────────
def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

# ─────────────────────────────
# APP
# ─────────────────────────────
app = FastAPI()
router = APIRouter()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────
# STARTUP — ensure schema exists
# ─────────────────────────────
@app.on_event("startup")
def startup():
    """
    Delegate schema creation to JobTracker — it is the single source of truth.
    We open and immediately close a tracker just to run _create_schema().
    """
    if not DATABASE_URL:
        logger.error("DATABASE_URL not set — skipping schema init")
        return
    try:
        from tools.tracker import JobTracker
        tracker = JobTracker()
        tracker.close()
        logger.info("PostgreSQL schema ready")
    except Exception as e:
        logger.error(f"DB startup error: {e}")

# ─────────────────────────────
# ROOT
# ─────────────────────────────
@app.get("/")
def serve_ui():
    return FileResponse(str(BASE_DIR / "index.html"))

# ─────────────────────────────
# STATS
# ─────────────────────────────
@router.get("/stats")
def get_stats():
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS count FROM jobs")
            total_jobs = cur.fetchone()["count"]

            cur.execute("""
                SELECT COUNT(*) AS count FROM jobs
                WHERE discovered_at::date = CURRENT_DATE
            """)
            applied_today = cur.fetchone()["count"]

            cur.execute("SELECT COUNT(*) AS count FROM applications")
            total_applications = cur.fetchone()["count"]

            cur.execute("SELECT COUNT(*) AS count FROM companies")
            total_companies = cur.fetchone()["count"]

        conn.close()
        return {
            "stats": {
                "total_jobs": total_jobs,
                "applied_today": applied_today,
                "total_applications": total_applications,
                "total_companies": total_companies,
                "success_rate": 0
            }
        }
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return {"stats": {"total_jobs": 0, "applied_today": 0,
                          "total_applications": 0, "total_companies": 0,
                          "success_rate": 0}}

# ─────────────────────────────
# APPLY TODAY
# ─────────────────────────────
@router.get("/apply-today")
def apply_today():
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT j.job_title, j.company_name, j.job_url, j.status,
                       a.applied_at, a.status AS app_status
                FROM applications a
                JOIN jobs j ON a.job_id = j.id
                WHERE a.applied_at::date = CURRENT_DATE
                ORDER BY a.applied_at DESC
            """)
            rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return {"applications": rows, "count": len(rows),
                "date": datetime.date.today().isoformat()}
    except Exception as e:
        logger.error(f"apply-today error: {e}")
        return {"applications": [], "count": 0,
                "date": datetime.date.today().isoformat()}

# ─────────────────────────────
# JOBS
# ─────────────────────────────
@router.get("/jobs")
def get_jobs(
    limit: int = 20,
    offset: int = 0,
    status: Optional[str] = None,
    company: Optional[str] = None,
    order_by: str = "discovered_at",
    desc: bool = True
):
    try:
        conn = get_conn()
        filters = []
        values = []

        if status:
            filters.append("status = %s")
            values.append(status)
        if company:
            filters.append("company_name ILIKE %s")
            values.append(f"%{company}%")

        where = ("WHERE " + " AND ".join(filters)) if filters else ""
        direction = "DESC" if desc else "ASC"
        safe_order = order_by if order_by in ("discovered_at", "updated_at", "job_title", "company_name") else "discovered_at"

        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT * FROM jobs {where}
                ORDER BY {safe_order} {direction}
                LIMIT %s OFFSET %s
            """, values + [limit, offset])
            jobs = [dict(r) for r in cur.fetchall()]

            cur.execute(f"SELECT COUNT(*) AS count FROM jobs {where}", values)
            total = cur.fetchone()["count"]

        conn.close()
        return {"jobs": jobs, "total": total, "limit": limit, "offset": offset}
    except Exception as e:
        logger.error(f"Jobs error: {e}")
        return {"jobs": [], "total": 0, "limit": limit, "offset": offset}

# ─────────────────────────────
# APPLICATIONS
# ─────────────────────────────
@router.get("/applications")
def get_applications(limit: int = 20, offset: int = 0, status: Optional[str] = None):
    try:
        conn = get_conn()
        filters = []
        values = []

        if status:
            filters.append("a.status = %s")
            values.append(status)

        where = ("WHERE " + " AND ".join(filters)) if filters else ""

        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT a.*, j.job_title, j.company_name, j.job_url
                FROM applications a
                JOIN jobs j ON a.job_id = j.id
                {where}
                ORDER BY a.applied_at DESC
                LIMIT %s OFFSET %s
            """, values + [limit, offset])
            apps = [dict(r) for r in cur.fetchall()]

            cur.execute(f"""
                SELECT COUNT(*) AS count FROM applications a {where}
            """, values)
            total = cur.fetchone()["count"]

        conn.close()
        return {"applications": apps, "total": total}
    except Exception as e:
        logger.error(f"Applications error: {e}")
        return {"applications": [], "total": 0}

# ─────────────────────────────
# FILES
# ─────────────────────────────
@router.get("/files")
def list_files():
    output_dir = BASE_DIR / "output"
    if not output_dir.exists():
        return {"files": []}
    files = []
    for f in sorted(output_dir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file() and f.suffix in (".docx", ".txt", ".pdf"):
            files.append({
                "name": f.name,
                "size": f.stat().st_size,
                "modified": datetime.datetime.fromtimestamp(f.stat().st_mtime).isoformat()
            })
    return {"files": files}

@router.get("/files/{filename}")
def get_file(filename: str):
    target = (BASE_DIR / "output" / filename).resolve()
    if not str(target).startswith(str(BASE_DIR / "output")):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid path")
    if not target.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(target))

# ─────────────────────────────
# RUN STATE
# ─────────────────────────────
RUN_STATE = {
    "status": "idle",
    "run_id": None,
    "logs": [],
    "queue": queue.Queue()
}

# ─────────────────────────────
# AGENT RUNNER
# ─────────────────────────────
def run_agent_process(run_id: str, limit: int, dry_run: bool):
    RUN_STATE["status"] = "running"
    RUN_STATE["run_id"] = run_id
    RUN_STATE["logs"] = []

    cmd = [PYTHON_EXEC, "agent.py", "--max", str(limit)]
    if dry_run:
        cmd.append("--dry-run")

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=BASE_DIR,
        bufsize=1,
        env={**os.environ}
    )

    for line in iter(process.stdout.readline, ''):
        clean = line.strip()
        if clean:
            RUN_STATE["logs"].append(clean)
            RUN_STATE["queue"].put(clean)

    process.stdout.close()
    process.wait()
    RUN_STATE["status"] = "complete"

# ─────────────────────────────
# RUN ENDPOINT
# ─────────────────────────────
class RunRequest(BaseModel):
    mode: str = "full"
    limit: Optional[int] = 5
    dry_run: bool = False

@router.post("/run")
def run_agent(req: RunRequest):
    if RUN_STATE["status"] == "running":
        return {"status": "already_running", "run_id": RUN_STATE["run_id"]}

    run_id = str(uuid.uuid4())
    limit = req.limit or 5

    thread = threading.Thread(
        target=run_agent_process,
        args=(run_id, limit, req.dry_run),
        daemon=True
    )
    thread.start()

    return {"status": "running", "run_id": run_id}

# ─────────────────────────────
# RUN STATUS
# ─────────────────────────────
@router.get("/run/status")
def run_status():
    return {
        "status": RUN_STATE["status"],
        "run_id": RUN_STATE["run_id"],
        "last_10_lines": RUN_STATE["logs"][-10:]
    }

# ─────────────────────────────
# WEBSOCKET
# ─────────────────────────────
@router.websocket("/ws/logs")
async def websocket_logs(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            while not RUN_STATE["queue"].empty():
                msg = RUN_STATE["queue"].get()
                await ws.send_text(msg)
            await ws.send_text(json.dumps({
                "type": "heartbeat",
                "status": RUN_STATE["status"]
            }))
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass

# ─────────────────────────────
# INCLUDE ROUTER
# ─────────────────────────────
app.include_router(router, prefix="/api")

# ─────────────────────────────
# ENTRY
# ─────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)