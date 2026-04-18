import { useEffect, useRef, useState } from "react";
import { fetchFitBreakdown } from "../api/client";
import type { FitBreakdown, Job } from "../types/index";

interface FitScoreModalProps {
  job: Job;
  onClose: () => void;
}

const BAR_LABELS: Array<{ key: keyof Omit<FitBreakdown, "missing">; label: string }> = [
  { key: "skills", label: "Skills Match" },
  { key: "location", label: "Location" },
  { key: "culture", label: "Culture Fit" },
  { key: "seniority", label: "Seniority" },
];

export default function FitScoreModal({ job, onClose }: FitScoreModalProps) {
  const [breakdown, setBreakdown] = useState<FitBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchFitBreakdown(job.id);
        if (!cancelled) setBreakdown(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      <div className="relative w-full max-w-md rounded-xl border border-[#2a2a3a] bg-[#111118] p-6 font-mono">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-[#6b6b80] hover:text-[#e8e8f0]"
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="mb-5 text-sm font-bold text-[#e8e8f0]">
          Fit Score — {job.company_name}
        </h2>

        {loading ? (
          <p className="text-xs text-[#6b6b80]">Loading...</p>
        ) : breakdown ? (
          <>
            <div className="space-y-3">
              {BAR_LABELS.map(({ key, label }) => {
                const value = breakdown[key] as number;
                const pct = Math.round((value / 10) * 100);
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between text-xs text-[#6b6b80]">
                      <span>{label}</span>
                      <span className="text-[#e8e8f0]">{value}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#1a1a24]">
                      <div
                        className="h-full rounded-full bg-[#7c6aff]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {breakdown.missing.length > 0 && (
              <div className="mt-5">
                <p className="text-xs text-[#6b6b80]">Missing skills:</p>
                <p className="mt-1 text-xs text-[#ff4d6a]">
                  {breakdown.missing.join(", ")}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-[#ff4d6a]">Failed to load breakdown.</p>
        )}
      </div>
    </div>
  );
}
