"""
tools/tracker.py — Persists job application state and history.
PostgreSQL only. No SQLite fallback.

This module is the SINGLE SOURCE OF TRUTH for the database schema.
api.py delegates schema creation here on startup — do not duplicate
CREATE TABLE statements elsewhere.
"""

import json
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
            id               SERIAL PRIMARY KEY,
            name             TEXT UNIQUE,
            website          TEXT,
            overview         TEXT,
            tech_stack       TEXT,          -- JSON-encoded list e.g. '["Java","Kafka"]'
            culture_notes    TEXT,
            glassdoor_rating NUMERIC,
            funding_stage    TEXT,
            recent_news      TEXT,          -- JSON-encoded list of bullet strings
            company_size     TEXT,
            culture_score    INTEGER,
            red_flags        TEXT,          -- JSON-encoded list of concern strings
            why_apply        TEXT,
            fit_score        INTEGER,
            data_quality     TEXT,
            created_at       TIMESTAMPTZ DEFAULT NOW(),
            updated_at       TIMESTAMPTZ DEFAULT NOW()
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
        def _to_json(val):
            """Serialize lists to JSON strings; pass through strings/None unchanged."""
            if isinstance(val, list):
                return json.dumps(val)
            return val  # already a string (pre-encoded) or None

        sql = """
        INSERT INTO companies (
            name, website, overview, tech_stack, culture_notes,
            glassdoor_rating, funding_stage, recent_news,
            company_size, culture_score, red_flags, why_apply,
            fit_score, data_quality, updated_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (name) DO UPDATE SET
            website          = EXCLUDED.website,
            overview         = EXCLUDED.overview,
            tech_stack       = EXCLUDED.tech_stack,
            culture_notes    = EXCLUDED.culture_notes,
            glassdoor_rating = EXCLUDED.glassdoor_rating,
            funding_stage    = EXCLUDED.funding_stage,
            recent_news      = EXCLUDED.recent_news,
            company_size     = EXCLUDED.company_size,
            culture_score    = EXCLUDED.culture_score,
            red_flags        = EXCLUDED.red_flags,
            why_apply        = EXCLUDED.why_apply,
            fit_score        = EXCLUDED.fit_score,
            data_quality     = EXCLUDED.data_quality,
            updated_at       = NOW()
        RETURNING id;
        """
        try:
            with self.conn.cursor() as cur:
                cur.execute(sql, (
                    company.get("name"),
                    company.get("website"),
                    company.get("overview"),
                    _to_json(company.get("tech_stack")),
                    company.get("culture_notes"),
                    company.get("glassdoor_rating"),
                    company.get("funding_stage"),
                    _to_json(company.get("recent_news")),
                    company.get("company_size"),
                    company.get("culture_score"),
                    _to_json(company.get("red_flags")),
                    company.get("why_apply"),
                    company.get("fit_score"),
                    company.get("data_quality"),
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