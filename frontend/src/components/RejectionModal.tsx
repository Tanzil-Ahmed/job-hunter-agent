import { useRef, useState } from "react";
import { submitRejection } from "../api/client";
import type { Job, RejectionReason } from "../types/index";

interface RejectionModalProps {
  job: Job;
  onClose: () => void;
  onSubmitted: () => void;
}

type Tab = "paste" | "ghost";

const CATEGORY_COLORS: Record<string, string> = {
  skills_gap: "text-[#ff4d6a] border-[#ff4d6a]",
  overqualified: "text-[#ffd166] border-[#ffd166]",
  culture_fit: "text-[#7c6aff] border-[#7c6aff]",
  timing: "text-[#00d084] border-[#00d084]",
  ghost: "text-[#6b6b80] border-[#6b6b80]",
  other: "text-[#e8e8f0] border-[#e8e8f0]",
};

const CATEGORY_LABELS: Record<string, string> = {
  skills_gap: "Skills Gap",
  overqualified: "Overqualified",
  culture_fit: "Culture Fit",
  timing: "Timing",
  ghost: "Ghosted",
  other: "Other",
};

export default function RejectionModal({ job, onClose, onSubmitted }: RejectionModalProps) {
  const [tab, setTab] = useState<Tab>("paste");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RejectionReason | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleSubmit = async (ghost: boolean) => {
    setLoading(true);
    try {
      const reason = await submitRejection(job.id, ghost ? { ghost: true } : { text });
      setResult(reason);
      onSubmitted();
    } finally {
      setLoading(false);
    }
  };

  const colorClass = result ? (CATEGORY_COLORS[result.category] ?? CATEGORY_COLORS.other) : "";
  const confidencePct = result ? Math.round(result.confidence * 100) : 0;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      <div className="relative w-full max-w-md rounded-xl border border-[#2a2a3a] bg-[#111118] p-6 font-mono">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-[#6b6b80] hover:text-[#e8e8f0]"
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="mb-4 text-sm font-bold text-[#e8e8f0]">
          Rejection — {job.company_name}
        </h2>

        {result ? (
          /* Result view */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={`rounded border px-2 py-1 text-xs uppercase ${colorClass}`}>
                {CATEGORY_LABELS[result.category] ?? result.category}
              </span>
              <span className="text-xs text-[#6b6b80]">{confidencePct}% confidence</span>
            </div>
            <div className="rounded border border-[#2a2a3a] bg-[#0a0a0f] px-4 py-3">
              <p className="text-xs leading-5 text-[#6b6b80]">{result.explanation}</p>
            </div>
            {/* Confidence bar */}
            <div>
              <div className="mb-1 text-[10px] text-[#6b6b80]">Confidence</div>
              <div className="h-1.5 w-full rounded-full bg-[#1a1a24]">
                <div
                  className="h-full rounded-full bg-[#7c6aff]"
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded bg-[#1a1a24] py-2 text-xs text-[#6b6b80] hover:text-[#e8e8f0]"
            >
              Close
            </button>
          </div>
        ) : (
          /* Input view */
          <>
            {/* Tabs */}
            <div className="mb-4 flex gap-1 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-1">
              {(["paste", "ghost"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded py-1.5 text-xs transition-colors ${
                    tab === t
                      ? "bg-[#1a1a24] text-[#e8e8f0]"
                      : "text-[#6b6b80] hover:text-[#e8e8f0]"
                  }`}
                >
                  {t === "paste" ? "Paste Rejection" : "Mark as Ghosted"}
                </button>
              ))}
            </div>

            {tab === "paste" ? (
              <div className="space-y-3">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste the rejection email here..."
                  rows={6}
                  className="w-full resize-none rounded border border-[#2a2a3a] bg-[#0a0a0f] px-3 py-2 text-xs text-[#e8e8f0] placeholder-[#6b6b80] focus:outline-none focus:ring-1 focus:ring-[#7c6aff]"
                />
                <button
                  type="button"
                  onClick={() => void handleSubmit(false)}
                  disabled={loading || !text.trim()}
                  className="w-full rounded bg-[#ff4d6a] py-2 text-xs text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Analysing..." : "Analyse Rejection"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#6b6b80]">
                  Mark this application as ghosted — no response received.
                </p>
                <button
                  type="button"
                  onClick={() => void handleSubmit(true)}
                  disabled={loading}
                  className="w-full rounded border border-[#6b6b80] py-2 text-xs text-[#6b6b80] hover:border-[#e8e8f0] hover:text-[#e8e8f0] disabled:opacity-40"
                >
                  {loading ? "Saving..." : "Mark as Ghosted"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
