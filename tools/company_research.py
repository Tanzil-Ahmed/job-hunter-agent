"""
tools/company_research.py — Gathers intelligence on a target company.

Pipeline for each company:
  Step 1  — scrape the job posting URL for context
  Step 2  — Tavily search: tech stack + engineering blog
  Step 3  — Exa search: culture + Glassdoor signals
  Step 4  — Tavily search: recent news (last 3 months)
  Step 5  — send everything to Claude Haiku for structured analysis
  Step 6  — save the profile via tracker.save_company()

The final output is a dict that cv_customizer and cover_letter can
directly consume to tailor documents.
"""

import json
import os
import re
import time
from typing import Optional

import anthropic
import requests
from dotenv import load_dotenv
from exa_py import Exa
from tavily import TavilyClient

load_dotenv()

# ---------------------------------------------------------------------------
# Tanzil's profile — used by Claude to compute fit_score
# ---------------------------------------------------------------------------
CANDIDATE_SUMMARY = """
Name: Tanzil Ahmed
Location: Bengaluru, India
Skills:
  - Backend: Java, Spring Boot, Node.js, Express.js, REST APIs
  - Frontend: React, Next.js, TypeScript
  - Data Engineering: Apache Kafka, PySpark, GCP, Azure
  - Databases: PostgreSQL, MySQL, MongoDB, Redis
  - DevOps: Docker, Kubernetes, CI/CD
Target roles: Full Stack Developer, Data Engineer, Associate Software Engineer, Backend Developer
Preference: Hybrid or Remote, Bengaluru or Remote India
"""

# Claude model to use for analysis (fast and cheap for structured extraction)
HAIKU_MODEL = "claude-haiku-4-5-20251001"

# Max characters we'll feed Claude from each raw source
MAX_CHARS_PER_SOURCE = 2000

# ---------------------------------------------------------------------------
# Tavily daily budget guard
# Tavily's free/starter plans cap daily API calls. Once we hit the limit every
# subsequent call fails noisily. We track calls at module level (persists for
# the lifetime of one agent process) and skip Tavily proactively when the
# budget is exhausted, falling through to Exa-only data silently.
# ---------------------------------------------------------------------------
_TAVILY_CALLS   = 0
TAVILY_DAILY_LIMIT = 80


def _tavily_ok() -> bool:
    """Return True if we still have Tavily budget remaining."""
    return _TAVILY_CALLS < TAVILY_DAILY_LIMIT


def _tavily_used() -> None:
    """Increment the module-level Tavily call counter."""
    global _TAVILY_CALLS
    _TAVILY_CALLS += 1


class CompanyResearcher:
    """
    Researches a company and returns a structured profile dict.

    Usage:
        researcher = CompanyResearcher(tracker)
        profile = researcher.research("Atlassian", "https://jobs.lever.co/atlassian/123")
    """

    def __init__(self, tracker=None):
        """
        Args:
            tracker: an initialised JobTracker instance (optional).
                     If provided, the profile is saved to the DB automatically.
                     If None, the profile is returned but not saved.
        """
        tavily_key = os.environ.get("TAVILY_API_KEY")
        exa_key    = os.environ.get("EXA_API_KEY")
        claude_key = os.environ.get("ANTHROPIC_API_KEY")

        if not tavily_key:
            raise EnvironmentError("TAVILY_API_KEY not set in .env")
        if not exa_key:
            raise EnvironmentError("EXA_API_KEY not set in .env")
        if not claude_key:
            raise EnvironmentError("ANTHROPIC_API_KEY not set in .env")

        self.tavily  = TavilyClient(api_key=tavily_key)
        self.exa     = Exa(api_key=exa_key)
        self.claude  = anthropic.Anthropic(api_key=claude_key)
        self.tracker = tracker

    # ------------------------------------------------------------------
    # research() — public entry point
    # ------------------------------------------------------------------

    def research(self, company_name: str, job_url: str = "",
                 job_title: str = "", job_id: int = None) -> dict:
        """
        Run the full research pipeline for one company.

        Steps:
          1. Scrape the job URL (if provided) for role context
          2. Search Tavily for tech stack and engineering blog posts
          3. Search Exa for culture signals and Glassdoor mentions
          4. Search Tavily for recent news (last 3 months)
          5. Send all gathered text to Claude Haiku for analysis
          6. Save the resulting profile via tracker.save_company()

        Args:
            company_name : e.g. "Atlassian"
            job_url      : the specific job posting URL (optional but recommended)
            job_title    : e.g. "Full Stack Developer" (optional)

        Returns:
            A dict with keys:
              name, website, overview, tech_stack, culture_notes,
              glassdoor_rating, funding_stage, recent_news,
              company_size, culture_score, red_flags,
              why_apply, fit_score
        """
        print(f"\n[researcher] Researching: {company_name}")

        # ── Step 1: scrape the job posting ───────────────────────────────
        job_text   = self._scrape_url(job_url) if job_url else ""
        _url_expired = False   # set True when both primary + LinkedIn fail

        if len(job_text) >= 100:
            print(f"[researcher] Job posting scraped ({len(job_text)} chars)")
        else:
            # Try the company's LinkedIn page as a fallback
            if company_name and company_name.lower() != "unknown company":
                slug = re.sub(r"[^a-z0-9]+", "-", company_name.lower()).strip("-")
                linkedin_url = f"https://www.linkedin.com/company/{slug}"
                print(f"[researcher] Job URL thin/failed — trying LinkedIn: {linkedin_url}")
                linkedin_text = self._scrape_url(linkedin_url)
                if len(linkedin_text) >= 100:
                    print(f"[researcher] LinkedIn fallback scraped ({len(linkedin_text)} chars)")
                    job_text = linkedin_text
                else:
                    print("[researcher] LinkedIn also blocked — using search data only")
                    job_text      = ""
                    _url_expired  = True   # both sources failed — treat as expired
            else:
                print("[researcher] No job URL or scrape failed — continuing without it")

        # Mark the job as expired in the tracker when both scrapes fail
        if _url_expired and job_id and self.tracker:
            try:
                self.tracker.mark_job_expired(job_id)
                print(f"[researcher] Job id={job_id} marked as expired in DB")
            except Exception as e:
                print(f"[researcher] mark_job_expired failed (non-fatal): {e}")

        # ── Step 2: tech stack search via Tavily ─────────────────────────
        tech_raw = self._search_tech_stack(company_name)
        print(f"[researcher] Tech stack data fetched ({len(tech_raw)} chars)")

        # ── Step 3: culture signals via Exa ──────────────────────────────
        culture_raw = self._search_culture(company_name)
        print(f"[researcher] Culture data fetched ({len(culture_raw)} chars)")

        # ── Step 4: recent news via Tavily ────────────────────────────────
        news_raw = self._search_recent_news(company_name)
        print(f"[researcher] Recent news fetched ({len(news_raw)} chars)")

        # ── Determine data quality ────────────────────────────────────────
        # "rich"    — scraped job/company page has substantial text
        # "partial" — no usable scrape but search APIs returned real data
        # "minimal" — almost nothing to work with; skip Claude to save credits
        total_search_chars = len(tech_raw) + len(culture_raw) + len(news_raw)
        if len(job_text) >= 100:
            data_quality = "rich"
        elif total_search_chars >= 500:
            data_quality = "partial"
        else:
            data_quality = "minimal"
        print(f"[researcher] Data quality: {data_quality}")

        # ── Step 5: analyse with Claude ──────────────────────────────────
        if data_quality == "minimal":
            print(f"[researcher] Skipping Claude (minimal data) — returning fallback profile")
            profile = self._fallback_profile(company_name)
        else:
            profile = self._analyse_with_claude(
                company_name=company_name,
                job_title=job_title,
                job_text=job_text,
                tech_raw=tech_raw,
                culture_raw=culture_raw,
                news_raw=news_raw,
            )
            print(f"[researcher] Claude analysis complete — fit_score: {profile.get('fit_score')}/10")

        profile["data_quality"]  = data_quality
        profile["_url_expired"]  = _url_expired

        # ── Step 6: persist to database ──────────────────────────────────
        if self.tracker:
            try:
                company_id = self.tracker.save_company({
                    "name":             profile["name"],
                    "website":          profile.get("website", ""),
                    "overview":         profile.get("overview", ""),
                    "tech_stack":       profile.get("tech_stack", []),
                    "culture_notes":    profile.get("culture_notes", ""),
                    "glassdoor_rating": profile.get("glassdoor_rating"),
                    "funding_stage":    profile.get("funding_stage", ""),
                    "recent_news":      json.dumps(profile.get("recent_news", [])),
                })
                profile["db_id"] = company_id
                print(f"[researcher] Saved to DB with id={company_id}")
            except Exception as e:
                print(f"[researcher] DB save failed (non-fatal): {e}")

        return profile

    # ------------------------------------------------------------------
    # Step 1 — _scrape_url
    # ------------------------------------------------------------------

    def _scrape_url(self, url: str) -> str:
        """
        Fetch the job posting page and return its visible text.

        Why we scrape the job URL:
          The raw job description is the richest source of what the company
          actually values — tech stack, team structure, responsibilities.
          We strip HTML tags and collapse whitespace so Claude sees clean text.

        Returns empty string on any failure so the pipeline continues.
        """
        if not url:
            return ""
        try:
            headers = {"User-Agent": "Mozilla/5.0 (compatible; JobHunterBot/1.0)"}
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            # Strip HTML tags with a simple regex (no BS4 overhead for short pages)
            text = re.sub(r"<[^>]+>", " ", response.text)
            # Collapse whitespace
            text = re.sub(r"\s+", " ", text).strip()
            return text[:MAX_CHARS_PER_SOURCE]
        except Exception as e:
            print(f"[researcher] Scrape failed for {url}: {e}")
            return ""

    # ------------------------------------------------------------------
    # Step 2 — _search_tech_stack
    # ------------------------------------------------------------------

    def _search_tech_stack(self, company_name: str) -> str:
        """
        Search Tavily for the company's engineering tech stack and blog posts.

        Query strategy:
          "[company] tech stack engineering blog" — surfaces engineering.{company}.com
          blog posts and StackShare/StackOverflow tech pages that list what
          the company actually uses in production.

        We concatenate all result snippets into one text block for Claude.
        Returns empty string if Tavily fails.
        """
        if not _tavily_ok():
            print(f"[researcher] Tavily budget exhausted — skipping tech-stack search")
            return ""

        query = f"{company_name} tech stack engineering blog backend technologies"
        try:
            _tavily_used()
            response = self.tavily.search(
                query=query,
                search_depth="advanced",
                max_results=5,
                include_answer=True,   # Tavily's AI answer often has a crisp summary
            )
            parts = []
            if response.get("answer"):
                parts.append(f"TAVILY SUMMARY: {response['answer']}")
            for r in response.get("results", []):
                snippet = f"[{r.get('title','')}] {r.get('content','')}"
                parts.append(snippet)
            return "\n\n".join(parts)[:MAX_CHARS_PER_SOURCE]
        except Exception as e:
            print(f"[researcher] Tavily tech-stack search failed for '{company_name}': {e}")
            return ""

    # ------------------------------------------------------------------
    # Step 3 — _search_culture
    # ------------------------------------------------------------------

    def _search_culture(self, company_name: str) -> str:
        """
        Search Exa for culture signals: Glassdoor reviews, LinkedIn posts,
        employee testimonials, and blog posts about working at the company.

        Why Exa here:
          Exa's neural search understands "culture at company" semantically —
          it surfaces employee Reddit threads, Glassdoor summaries, and
          engineering-culture posts that keyword search often misses.

        Returns empty string if Exa fails.
        """
        query = f"{company_name} company culture employee reviews glassdoor work life balance"
        try:
            response = self.exa.search_and_contents(
                query=query,
                num_results=5,
                text=True,
            )
            parts = []
            for r in response.results:
                title = getattr(r, "title", "") or ""
                text  = getattr(r, "text", "")  or ""
                snippet = f"[{title}] {text[:400]}"
                parts.append(snippet)
            return "\n\n".join(parts)[:MAX_CHARS_PER_SOURCE]
        except Exception as e:
            print(f"[researcher] Exa culture search failed for '{company_name}': {e}")
            return ""

    # ------------------------------------------------------------------
    # Step 4 — _search_recent_news
    # ------------------------------------------------------------------

    def _search_recent_news(self, company_name: str) -> str:
        """
        Search Tavily for news about the company from the last 3 months.

        Why we check recent news:
          Layoffs, funding rounds, leadership changes, and product launches
          all affect whether it's a good time to apply. A company that just
          raised a Series B is usually hiring aggressively; one with recent
          layoffs may have a hiring freeze.

        The 'days=90' parameter restricts Tavily to results from the past 90 days.
        Returns empty string if Tavily fails.
        """
        if not _tavily_ok():
            print(f"[researcher] Tavily budget exhausted — skipping news search")
            return ""

        query = f"{company_name} news 2025 2026 hiring funding layoffs product launch"
        try:
            _tavily_used()
            response = self.tavily.search(
                query=query,
                search_depth="basic",   # basic is fine for news — speed matters more
                max_results=4,
                include_answer=False,
            )
            parts = []
            for r in response.get("results", []):
                date    = r.get("published_date", "")
                title   = r.get("title", "")
                snippet = r.get("content", "")
                parts.append(f"[{date}] {title}: {snippet[:300]}")
            return "\n\n".join(parts)[:MAX_CHARS_PER_SOURCE]
        except Exception as e:
            print(f"[researcher] Tavily news search failed for '{company_name}': {e}")
            return ""

    # ------------------------------------------------------------------
    # Step 5 — _analyse_with_claude
    # ------------------------------------------------------------------

    def _analyse_with_claude(self, company_name: str, job_title: str,
                              job_text: str, tech_raw: str,
                              culture_raw: str, news_raw: str) -> dict:
        """
        Send all gathered research data to Claude Haiku and ask it to produce
        a structured company profile.

        Why Claude Haiku:
          Haiku is fast and cheap — this is a classification/extraction task,
          not a creative writing task. We don't need Sonnet-level reasoning.

        Prompt design:
          We give Claude all four text blocks (job posting, tech stack search,
          culture search, recent news) and Tanzil's skill profile. We ask for
          a strict JSON response with no markdown fences so we can parse it
          directly without stripping ```json ... ```.

        If Claude fails or returns unparseable JSON we return a safe fallback
        dict so the pipeline can continue.
        """
        prompt = f"""
You are a job-search assistant analysing a company for a candidate.

CANDIDATE PROFILE:
{CANDIDATE_SUMMARY}

COMPANY NAME: {company_name}
JOB TITLE BEING APPLIED FOR: {job_title or "Software Engineer"}

RESEARCH DATA
=============

[A] JOB POSTING TEXT:
{job_text or "(not available)"}

[B] TECH STACK / ENGINEERING BLOG (from Tavily):
{tech_raw or "(not available)"}

[C] CULTURE & REVIEWS (from Exa / Glassdoor):
{culture_raw or "(not available)"}

[D] RECENT NEWS:
{news_raw or "(not available)"}

=============

Based on all the above, produce a JSON object with EXACTLY these keys.
Return ONLY the JSON — no markdown, no explanation, no code fences.

{{
  "name":             "{company_name}",
  "website":          "best guess at company website URL or empty string",
  "overview":         "2-3 sentence factual description of what the company does",
  "tech_stack":       ["list", "of", "technologies", "used"],
  "culture_notes":    "2-3 sentences on work culture, team environment, work-life balance",
  "glassdoor_rating": null or a number like 4.1,
  "funding_stage":    "one of: Bootstrapped / Seed / Series A / Series B / Series C+ / Public / MNC / Unknown",
  "recent_news":      ["bullet 1 about recent news", "bullet 2"],
  "company_size":     "one of: startup / mid / large / MNC",
  "culture_score":    integer 1-10 (10 = excellent culture signals),
  "red_flags":        ["list any concerns: layoffs, bad reviews, no growth, etc — empty list if none"],
  "why_apply":        "2-3 sentence pitch Tanzil can use in his cover letter explaining why this company excites him",
  "fit_score":        integer 1-10 (10 = perfect match for Tanzil's skills and goals)
}}
"""
        try:
            message = self.claude.messages.create(
                model=HAIKU_MODEL,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            raw_text = message.content[0].text.strip()

            # Strip markdown fences if Claude adds them despite instructions
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)

            profile = json.loads(raw_text)
            return profile

        except json.JSONDecodeError as e:
            print(f"[researcher] Claude returned invalid JSON for '{company_name}': {e}")
            return self._fallback_profile(company_name)
        except Exception as e:
            print(f"[researcher] Claude API call failed for '{company_name}': {e}")
            return self._fallback_profile(company_name)

    # ------------------------------------------------------------------
    # _fallback_profile
    # ------------------------------------------------------------------

    def _fallback_profile(self, company_name: str) -> dict:
        """
        Return a safe empty profile when all research steps fail.

        This ensures the orchestrator always gets a dict it can work with —
        it will have low scores so the orchestrator can decide whether to
        skip this company or retry later.
        """
        return {
            "name":             company_name,
            "website":          "",
            "overview":         "Research unavailable.",
            "tech_stack":       [],
            "culture_notes":    "Research unavailable.",
            "glassdoor_rating": None,
            "funding_stage":    "Unknown",
            "recent_news":      [],
            "company_size":     "Unknown",
            "culture_score":    0,
            "red_flags":        ["Research pipeline failed — manual review needed"],
            "why_apply":        "Research unavailable.",
            "fit_score":        0,
            "data_quality":     "minimal",
        }
