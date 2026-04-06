"""
regen_covers.py — One-off script to regenerate cover letters for the 5 April 1st jobs.

Reads company profiles from the DB, builds job dicts from the APPLY_TODAY file,
calls CoverLetterWriter for each, then updates the APPLY_TODAY file.
"""

import os
import re
from datetime import date
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

from tools.cover_letter import CoverLetterWriter

OUTPUT_DIR     = Path("output")
APPLY_TODAY    = OUTPUT_DIR / "APPLY_TODAY_2026-04-01.txt"

# ---------------------------------------------------------------------------
# Jobs to regenerate — sourced from APPLY_TODAY_2026-04-01.txt
# ---------------------------------------------------------------------------
JOBS = [
    {
        "title":    "Senior Software Engineer x Careernet Diversity Career Fair",
        "company":  "Recruitingprograms",
        "url":      "http://job-boards.greenhouse.io/recruitingprograms/jobs/6647740",
        "location": "Bengaluru",
        "cv_file":  "cv_recruitingprograms_senior_software_engineer_x_car_2026-04-01.docx",
    },
    {
        "title":    "Job Application for Software Engineer II - Pulsar Team at Bloomreach",
        "company":  "Bloomreach",
        "url":      "https://job-boards.greenhouse.io/bloomreach/jobs/7686588",
        "location": "Bengaluru",
        "cv_file":  "cv_bloomreach_job_application_for_software_e_2026-04-01.docx",
    },
    {
        "title":    "Staff Software Engineer - Platform and Infrastructure - Bengaluru",
        "company":  "Samsara",
        "url":      "https://job-boards.greenhouse.io/samsara/jobs/7266287",
        "location": "Bengaluru",
        "cv_file":  "cv_samsara_staff_software_engineer_platfo_2026-04-01.docx",
    },
    {
        "title":    "Rackspace - Data Ops / Data Engineer II - IN - Lever",
        "company":  "Rackspace",
        "url":      "https://jobs.lever.co/rackspace/55470a9e-eb53-4c73-8d94-1ba3ab6c4e35/apply",
        "location": "Bengaluru",
        "cv_file":  "cv_rackspace_rackspace_data_ops_data_engine_2026-04-01.docx",
    },
    {
        "title":    "Job Application for Software Engineer (SWE3) (India) at Karat",
        "company":  "Karat",
        "url":      "http://job-boards.greenhouse.io/karat/jobs/8482352002",
        "location": "Bengaluru",
        "cv_file":  "cv_karat_job_application_for_software_e_2026-04-01.docx",
    },
]


def fetch_company_profiles() -> dict:
    """
    Pull company rows from the DB for all 5 companies.
    Returns a dict keyed by company name (case-insensitive).
    """
    db_url = os.environ["DATABASE_URL"]
    conn   = psycopg2.connect(db_url)
    names  = [j["company"] for j in JOBS]

    sql = """
    SELECT id, name, website, overview, tech_stack, culture_notes,
           glassdoor_rating, funding_stage, recent_news
    FROM   companies
    WHERE  name = ANY(%s);
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, (names,))
        rows = cur.fetchall()
    conn.close()

    profiles = {}
    for row in rows:
        d = dict(row)
        # Enrich with fields cover_letter expects that aren't stored in the DB
        d.setdefault("company_size",  "unknown")
        d.setdefault("fit_score",     "?")
        d.setdefault("why_apply",     "")
        d.setdefault("red_flags",     [])
        profiles[d["name"].lower()] = d
    return profiles


def fetch_job_descriptions() -> dict:
    """
    Pull description from the jobs table for each URL.
    Returns a dict keyed by job_url.
    """
    db_url = os.environ["DATABASE_URL"]
    conn   = psycopg2.connect(db_url)
    urls   = [j["url"] for j in JOBS]

    sql = "SELECT job_url, description FROM jobs WHERE job_url = ANY(%s);"
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, (urls,))
        rows = cur.fetchall()
    conn.close()

    return {r["job_url"]: r["description"] or "" for r in rows}


def update_apply_today(cover_map: dict) -> None:
    """
    Replace every 'Cover Letter: (none)' line in APPLY_TODAY with the
    actual filename from cover_map {company_lower: filename}.
    """
    text = APPLY_TODAY.read_text(encoding="utf-8")

    # Walk through each job block and substitute the cover letter line
    def replacer(m):
        company_line = m.group(1)
        # Extract company name from "Company:      Recruitingprograms"
        company = re.search(r"Company:\s+(.+)", company_line)
        if not company:
            return m.group(0)
        key = company.group(1).strip().lower()
        filename = cover_map.get(key, "(none)")
        return m.group(0).replace("Cover Letter: (none)", f"Cover Letter: {filename}")

    # Replace each (none) by finding the nearest Company: line above it
    lines   = text.splitlines()
    result  = []
    last_company = ""
    for line in lines:
        m = re.match(r"Company:\s+(.+)", line)
        if m:
            last_company = m.group(1).strip().lower()
        if line.strip() == "Cover Letter: (none)" and last_company in cover_map:
            line = f"Cover Letter: {cover_map[last_company]}"
        result.append(line)

    APPLY_TODAY.write_text("\n".join(result), encoding="utf-8")
    print(f"\n[update] APPLY_TODAY updated → {APPLY_TODAY.name}")


def main():
    print("=" * 60)
    print("  Regenerating cover letters for April 1st jobs")
    print("=" * 60)

    print("\n[db] Fetching company profiles...")
    profiles = fetch_company_profiles()
    print(f"     Found profiles for: {list(profiles.keys())}")

    print("\n[db] Fetching job descriptions...")
    descriptions = fetch_job_descriptions()

    writer    = CoverLetterWriter()
    cover_map = {}   # company_name_lower -> generated filename

    for i, job in enumerate(JOBS, 1):
        print(f"\n[{i}/5] {job['company']} — {job['title'][:55]}")

        profile  = profiles.get(job["company"].lower(), {})
        cv_path  = OUTPUT_DIR / job["cv_file"]

        # Attach description from DB
        job_dict = {
            **job,
            "description": descriptions.get(job["url"], ""),
        }

        if not cv_path.exists():
            print(f"       WARNING: CV file not found: {cv_path.name} — skipping")
            continue

        try:
            cover_path = writer.write(job_dict, profile, cv_path)
            cover_map[job["company"].lower()] = cover_path.name
            print(f"       Saved: {cover_path.name}")
        except Exception as e:
            print(f"       ERROR: {e}")

    update_apply_today(cover_map)

    print("\n" + "=" * 60)
    print(f"  Done — {len(cover_map)}/5 cover letters generated")
    print("=" * 60)


if __name__ == "__main__":
    main()
