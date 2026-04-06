"""
tools/tracker.py — Persists job application state and history.
PostgreSQL only. No SQLite fallback.
"""

import os
from datetime import date, datetime
from typing import Optional

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

STATUS_FOUND = "found"
STATUS_RESEARCHED = "researched"
STATUS_APPLIED = "applied"
STATUS_INTERVIEW = "interview"
STATUS_OFFER = "offer"
STATUS_REJECTED = "rejected"
STATUS_WITHDRAWN = "withdrawn"
STATUS_EXPIRED = "expired"


class JobTracker:

    def __init__(self):
        db_url = os.environ.get("DATABASE_URL")

        if not db_url:
            raise EnvironmentError(
                "DATABASE_URL is not set. Add it to your .env file.\n"
                "Example: DATABASE_URL=postgresql://postgres:password@localhost:5432/job_hunter"
            )

        try:
            self.conn = psycopg2.connect(db_url)
            self.conn.autocommit = False
            self._create_schema()
            print("[DB] Connected to PostgreSQL")
        except psycopg2.Error as e:
            raise ConnectionError(f"Could not connect to database: {e}") from e

    def _create_schema(self):
        sql = """
        CREATE TABLE IF NOT EXISTS jobs (
            id          SERIAL PRIMARY KEY,
            job_title   TEXT,
            company_name TEXT,
            location    TEXT,
            job_url     TEXT UNIQUE,
            description TEXT,
            source      TEXT,
            status      TEXT DEFAULT 'found',
            posted_date DATE,
            discovered_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at  TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS companies (
            id           SERIAL PRIMARY KEY,
            name         TEXT UNIQUE,
            industry     TEXT,
            size         TEXT,
            tech_stack   TEXT,
            notes        TEXT,
            created_at   TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS applications (
            id           SERIAL PRIMARY KEY,
            job_id       INTEGER REFERENCES jobs(id),
            company_id   INTEGER REFERENCES companies(id),
            status       TEXT DEFAULT 'applied',
            applied_at   TIMESTAMPTZ DEFAULT NOW(),
            cv_path      TEXT,
            cover_path   TEXT,
            notes        TEXT,
            updated_at   TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS logs (
            id           SERIAL PRIMARY KEY,
            run_id       TEXT,
            level        TEXT,
            message      TEXT,
            created_at   TIMESTAMPTZ DEFAULT NOW()
        );
        """
        with self.conn.cursor() as cur:
            cur.execute(sql)
        self.conn.commit()

    def save_job(self, job: dict) -> int:
        sql = """
        INSERT INTO jobs (job_title, company_name, location, job_url, description, source)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (job_url) DO UPDATE SET updated_at = NOW()
        RETURNING id;
        """
        try:
            with self.conn.cursor() as cur:
                cur.execute(sql, (
                    job.get("job_title"),
                    job.get("company_name"),
                    job.get("location"),
                    job.get("job_url"),
                    job.get("description"),
                    job.get("source", "unknown"),
                ))
                row_id = cur.fetchone()[0]
            self.conn.commit()
            return row_id
        except psycopg2.Error:
            self.conn.rollback()
            raise

    def save_company(self, company: dict) -> int:
        sql = """
        INSERT INTO companies (name, industry, size, tech_stack, notes)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (name) DO UPDATE SET notes = EXCLUDED.notes
        RETURNING id;
        """
        try:
            with self.conn.cursor() as cur:
                cur.execute(sql, (
                    company.get("name"),
                    company.get("industry"),
                    company.get("size"),
                    company.get("tech_stack"),
                    company.get("notes"),
                ))
                row_id = cur.fetchone()[0]
            self.conn.commit()
            return row_id
        except psycopg2.Error:
            self.conn.rollback()
            raise

    def save_application(self, job_id: int, company_id: int = None,
                         cv_path: str = None, cover_path: str = None) -> int:
        sql = """
        INSERT INTO applications (job_id, company_id, cv_path, cover_path)
        VALUES (%s, %s, %s, %s)
        RETURNING id;
        """
        try:
            with self.conn.cursor() as cur:
                cur.execute(sql, (job_id, company_id, cv_path, cover_path))
                row_id = cur.fetchone()[0]
            self.conn.commit()
            return row_id
        except psycopg2.Error:
            self.conn.rollback()
            raise

    def job_exists(self, job_url: str) -> bool:
        with self.conn.cursor() as cur:
            cur.execute("SELECT 1 FROM jobs WHERE job_url = %s", (job_url,))
            return cur.fetchone() is not None

    def mark_job_expired(self, job_id: int):
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    "UPDATE jobs SET status = 'expired', updated_at = NOW() WHERE id = %s",
                    (job_id,)
                )
            self.conn.commit()
        except psycopg2.Error:
            self.conn.rollback()
            raise

    def get_pending_jobs(self) -> list:
        with self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM jobs WHERE status = 'found' ORDER BY discovered_at DESC")
            return [dict(r) for r in cur.fetchall()]

    def save_daily_report(self, run_id: str, summary: dict) -> int:
        sql = """
        INSERT INTO logs (run_id, level, message)
        VALUES (%s, 'INFO', %s)
        RETURNING id;
        """
        try:
            with self.conn.cursor() as cur:
                cur.execute(sql, (run_id, str(summary)))
                row_id = cur.fetchone()[0]
            self.conn.commit()
            return row_id
        except psycopg2.Error:
            self.conn.rollback()
            raise

    def close(self):
        if self.conn:
            self.conn.close()