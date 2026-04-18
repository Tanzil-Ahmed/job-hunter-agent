import { useEffect, useState } from "react";
import { fetchGhostedJobs, submitRejection } from "../api/client";
import type { GhostedJob } from "../types/index";
import FollowUpModal from "./FollowUpModal";

export default function GhostDetectorCard() {
  const [jobs, setJobs] = useState<GhostedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [followUpJob, setFollowUpJob] = useState<GhostedJob | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchGhostedJobs();
        setJobs(data.ghosted_jobs);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleMarkGhosted = async (job: GhostedJob) => {
    setMarkingId(job.id);
    try {
      await submitRejection(job.id, { ghost: true });
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <>
      {followUpJob && (
        <FollowUpModal job={followUpJob} onClose={() => setFollowUpJob(null)} />
      )}

      <section className="rounded-lg border border-[#2a2a3a] bg-[#111118] p-5 font-mono">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#e8e8f0]">Ghost Detector</h2>
          {!loading && jobs.length > 0 && (
            <span className="rounded border border-[#ff4d6a] bg-[#1a1a24] px-2 py-0.5 text-xs text-[#ff4d6a]">
              {jobs.length} ghosted
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-[#6b6b80]">Loading...</p>
        ) : jobs.length === 0 ? (
          <p className="text-xs text-[#6b6b80]">No ghosted applications detected.</p>
        ) : (
          <div className="space-y-2">
            <p className="mb-3 text-xs text-[#6b6b80]">
              {jobs.length} application{jobs.length !== 1 ? "s" : ""} with no response (7+ days)
            </p>
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between gap-3 rounded border border-[#2a2a3a] bg-[#0a0a0f] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#e8e8f0]" title={job.job_title}>
                    {job.job_title}
                  </p>
                  <p className="mt-0.5 text-xs text-[#6b6b80]">
                    {job.company_name} · {job.days_since_applied}d ago
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setFollowUpJob(job)}
                    className="text-xs text-[#7c6aff] hover:text-[#e8e8f0]"
                  >
                    Follow Up
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMarkGhosted(job)}
                    disabled={markingId === job.id}
                    className="text-xs text-[#6b6b80] hover:text-[#e8e8f0] disabled:opacity-40"
                  >
                    {markingId === job.id ? "Saving..." : "Mark Ghosted"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
