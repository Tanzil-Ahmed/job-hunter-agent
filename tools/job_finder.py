# tools/job_finder.py — CLEAN VERSION

import os
import re
import time
from datetime import datetime
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv
from exa_py import Exa
from tavily import TavilyClient

load_dotenv()

SEARCH_ROLES = [
    "Software Engineer",
    "Backend Developer",
    "Data Engineer"
]

SEARCH_LOCATIONS = [
    "Bengaluru",
    "Remote India"
]


class JobFinder:

    def __init__(self):
        self.tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        self.exa = Exa(api_key=os.getenv("EXA_API_KEY"))

    def search(self):
        jobs = []

        for role in SEARCH_ROLES:
            for loc in SEARCH_LOCATIONS:
                query = f"{role} job {loc}"

                print(f"[SEARCH] {query}")

                jobs += self._search_tavily(query)
                jobs += self._search_exa(query)

                time.sleep(0.2)

        return self._deduplicate(jobs)

    def _search_tavily(self, query):
        try:
            res = self.tavily.search(query=query, max_results=5)
            return [
                {
                    "title": r.get("title"),
                    "url": r.get("url"),
                    "company": self._infer_company(r.get("url", ""), r.get("title", "")),
                    "description": r.get("content")
                }
                for r in res.get("results", [])
            ]
        except Exception as e:
            print(f"[ERROR Tavily] {e}")
            return []

    def _search_exa(self, query):
        try:
            res = self.exa.search_and_contents(query=query, num_results=5)
            return [
                {
                    "title": r.title,
                    "url": r.url,
                    "company": self._infer_company(r.url or "", r.title or ""),
                    "description": (r.text or "")[:300]
                }
                for r in res.results
            ]
        except Exception as e:
            print(f"[ERROR Exa] {e}")
            return []

    def _infer_company(self, url: str, title: str) -> str:
        """
        Best-effort company name extraction from a job posting URL and title.
        Never returns an empty string.

        Priority:
          1. Known ATS platform URL patterns (Lever, Greenhouse, Ashby, etc.)
          2. Career/jobs subdomain  e.g. careers.atlassian.com → Atlassian
          3. "at Company" / "@ Company" suffix in the job title
          4. Company-owned domain with a careers path  e.g. stripe.com/jobs/...
          5. Domain base slug as final fallback
        """
        def _slug_to_name(slug: str) -> str:
            """'my-company-name' → 'My Company Name'"""
            return " ".join(w.capitalize() for w in re.split(r"[-_]+", slug) if w)

        if not url:
            if title:
                m = re.search(r"\bat\s+([A-Za-z][^\s,|@]{1,40})$", title.strip(), re.IGNORECASE)
                if m:
                    return m.group(1).strip().rstrip(".,")
            return "Unknown Company"

        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        host_parts = host.split(".")
        path_parts = [p for p in parsed.path.split("/") if p]

        _SKIP_SLUGS = {
            "jobs", "job", "careers", "career", "apply",
            "positions", "opening", "openings", "j", "o",
        }

        # ── 1. Known ATS platforms: company slug in URL path ─────────────
        # Each entry: domain fragment → index of company slug in path_parts
        ATS_PATH_IDX = {
            "lever.co":            0,  # jobs.lever.co/{company}/abc123
            "greenhouse.io":       0,  # boards.greenhouse.io/{company}/jobs/123
            "ashbyhq.com":         0,  # jobs.ashbyhq.com/{company}/abc
            "workable.com":        0,  # apply.workable.com/{company}/j/xxx
            "smartrecruiters.com": 0,  # jobs.smartrecruiters.com/{Company}/...
            "recruitee.com":       0,  # {company}.recruitee.com or recruitee.com/{company}
            "jobvite.com":         1,  # jobs.jobvite.com/companies/{company}/...
        }
        for domain_frag, idx in ATS_PATH_IDX.items():
            if domain_frag in host and len(path_parts) > idx:
                slug = path_parts[idx]
                if slug.lower() not in _SKIP_SLUGS:
                    return _slug_to_name(slug)

        # ATS platforms: company slug is the subdomain
        ATS_SUBDOMAIN_HOSTS = {"bamboohr.com", "breezy.hr", "icims.com"}
        _GENERIC_SUBDOMAINS = {
            "www", "jobs", "boards", "apply", "hire",
            "careers", "app", "secure", "portal",
        }
        for domain_frag in ATS_SUBDOMAIN_HOSTS:
            if domain_frag in host and host_parts[0] not in _GENERIC_SUBDOMAINS:
                return _slug_to_name(host_parts[0])

        # ── 2. Career/jobs subdomain  e.g. careers.atlassian.com ─────────
        CAREER_SUBDOMAINS = {
            "careers", "jobs", "job", "hiring", "work",
            "apply", "join", "talent", "recruit", "hr",
        }
        _CCSD_SKIP = {"co", "com", "net", "org", "in", "io"}
        if (len(host_parts) >= 3
                and host_parts[0] in CAREER_SUBDOMAINS
                and host_parts[1] not in _CCSD_SKIP):
            return _slug_to_name(host_parts[1])

        # ── 3. "at Company" / "@ Company" in title ───────────────────────
        _LOCATIONS = {
            "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad",
            "chennai", "pune", "remote", "india", "noida",
            "gurgaon", "gurugram", "kolkata", "ahmedabad",
        }
        if title:
            for pat in (r"\bat\s+([A-Za-z][^\s,|()\[\]]{1,40})$",
                        r"@\s*([A-Za-z][^\s,|()\[\]]{1,40})$"):
                m = re.search(pat, title.strip(), re.IGNORECASE)
                if m:
                    candidate = m.group(1).strip().rstrip(".,")
                    if candidate.lower() not in _LOCATIONS and len(candidate) > 1:
                        return candidate

        # ── 4. Company-owned domain with a careers-style path ────────────
        # e.g. stripe.com/jobs/... → Stripe
        CAREER_PATHS = {"jobs", "careers", "career", "join", "openings", "work"}
        if path_parts and path_parts[0].lower() in CAREER_PATHS:
            base = host_parts[0] if host_parts[0] != "www" else (
                host_parts[1] if len(host_parts) > 1 else ""
            )
            if base:
                return _slug_to_name(base)

        # ── 5. Domain slug fallback ───────────────────────────────────────
        # Skip known aggregator/board domains — they're not the company
        _AGGREGATORS = {
            "linkedin", "indeed", "naukri", "glassdoor", "monster",
            "timesjobs", "shine", "foundit", "instahyre", "cutshort",
            "wellfound", "angellist", "simplyhired", "ziprecruiter",
        }
        base = host_parts[0] if host_parts[0] != "www" else (
            host_parts[1] if len(host_parts) > 1 else ""
        )
        if base and base not in _AGGREGATORS:
            return _slug_to_name(base)

        # Aggregator URL with no other signal — use first meaningful path segment
        for part in path_parts:
            if part.lower() not in _SKIP_SLUGS and len(part) > 2:
                return _slug_to_name(part)

        return "Unknown Company"

    def _deduplicate(self, jobs):
        seen = set()
        unique = []

        for j in jobs:
            url = j.get("url")
            if url and url not in seen:
                seen.add(url)
                unique.append(j)

        print(f"[INFO] {len(unique)} unique jobs")

        return unique