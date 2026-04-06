# tools/job_finder.py — CLEAN VERSION

import os
import re
import time
from datetime import datetime

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
                    "company": "",
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
                    "company": "",
                    "description": (r.text or "")[:300]
                }
                for r in res.results
            ]
        except Exception as e:
            print(f"[ERROR Exa] {e}")
            return []

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