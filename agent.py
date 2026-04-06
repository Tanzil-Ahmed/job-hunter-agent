import argparse
import sys
import traceback
from dotenv import load_dotenv

load_dotenv()

from tools.company_research import CompanyResearcher
from tools.cover_letter import CoverLetterWriter
from tools.cv_customizer import CVCustomizer
from tools.job_finder import JobFinder
from tools.tracker import JobTracker


class JobHunterAgent:

    def __init__(self, dry_run=False, max_jobs=None, top_n=None, roles=None, locations=None):
        self.dry_run = dry_run

        # Single source of truth for limit
        self.limit = max_jobs or top_n or 5

        if top_n and not max_jobs:
            mode_label = f"TOP-{top_n} BY FIT SCORE"
        elif dry_run:
            mode_label = "DRY RUN"
        else:
            mode_label = "FULL RUN"

        print("\n[START] Initialising Job Hunter Agent...")
        print(f"  Mode:      {mode_label}")
        print(f"  Job limit: {self.limit}")

        self.tracker = JobTracker()
        self.job_finder = JobFinder()
        self.researcher = CompanyResearcher(tracker=self.tracker)
        self.cv_customizer = CVCustomizer()
        self.cover_writer = CoverLetterWriter()

        self._stats = {
            "jobs_found": 0,
            "jobs_processed": 0,
            "applications_saved": 0,
            "errors": []
        }

    def run(self):
        print("\n[STEP 1] Finding jobs...")
        all_jobs = self.job_finder.search()
        jobs = all_jobs[:self.limit]

        if not jobs:
            print("[WARN] No jobs found")
            return self._stats

        self._stats["jobs_found"] = len(jobs)
        print(f"[INFO] Processing {len(jobs)} jobs")

        for idx, job in enumerate(jobs, 1):
            print(f"\n[{idx}/{len(jobs)}] {job.get('title')} @ {job.get('company')}")

            try:
                # Save to DB
                job_id = self.tracker.save_job({
                    "job_title": job.get("title"),
                    "company_name": job.get("company"),
                    "location": job.get("location"),
                    "job_url": job.get("url"),
                    "description": job.get("description"),
                })
                print(f"[DB] Saved job id={job_id}")

                # Research
                profile = self.researcher.research(
                    company_name=job.get("company"),
                    job_url=job.get("url"),
                    job_title=job.get("title")
                )

                # Generate (skip if dry run)
                if not self.dry_run:
                    cv_path = self.cv_customizer.customise(job, profile)
                    cover_path = self.cover_writer.write(job, profile, cv_path)
                    self.tracker.save_application(job_id=job_id, cv_path=str(cv_path),
                                                   cover_path=str(cover_path))

                self._stats["jobs_processed"] += 1
                self._stats["applications_saved"] += 1
                print("[OK] Done")

            except Exception as e:
                print(f"[ERROR] {e}")
                self._stats["errors"].append(str(e))

        print("\n[SUMMARY]", self._stats)
        return self._stats


def _parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--max", type=int)
    parser.add_argument("--top", type=int)
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    try:
        agent = JobHunterAgent(
            dry_run=args.dry_run,
            max_jobs=args.max,
            top_n=args.top
        )
        stats = agent.run()
        sys.exit(1 if stats["errors"] else 0)
    except Exception as e:
        print(f"[FATAL] {e}")
        traceback.print_exc()
        sys.exit(1)