import { useEffect, useState } from "react";
import { fetchRejectionPatterns } from "../api/client";
import type { RejectionPatterns } from "../types/index";

const CATEGORY_COLORS: Record<string, string> = {
  skills_gap: "bg-[#ff4d6a]",
  overqualified: "bg-[#ffd166]",
  culture_fit: "bg-[#7c6aff]",
  timing: "bg-[#00d084]",
  ghost: "bg-[#6b6b80]",
  other: "bg-[#e8e8f0]",
};

const CATEGORY_LABELS: Record<string, string> = {
  skills_gap: "Skills Gap",
  overqualified: "Overqualified",
  culture_fit: "Culture Fit",
  timing: "Timing",
  ghost: "Ghosted",
  other: "Other",
};

export default function RejectionPatternsCard() {
  const [data, setData] = useState<RejectionPatterns | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await fetchRejectionPatterns();
        setData(result);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <section className="rounded-lg border border-[#2a2a3a] bg-[#111118] p-5 font-mono">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#e8e8f0]">Rejection Patterns</h2>
        {data && data.total > 0 && (
          <span className="text-xs text-[#6b6b80]">{data.total} rejection{data.total !== 1 ? "s" : ""}</span>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-[#6b6b80]">Loading...</p>
      ) : !data || data.total === 0 ? (
        <p className="text-xs text-[#6b6b80]">No rejections recorded yet.</p>
      ) : (
        <div className="space-y-4">
          {/* Category bars */}
          <div className="space-y-2">
            {Object.entries(data.by_category)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => {
                const pct = Math.round((count / data.total) * 100);
                const fillClass = CATEGORY_COLORS[cat] ?? "bg-[#e8e8f0]";
                return (
                  <div key={cat}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-[#6b6b80]">{CATEGORY_LABELS[cat] ?? cat}</span>
                      <span className="text-[#e8e8f0]">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#1a1a24]">
                      <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Meta-analysis insight box */}
          {data.meta_analysis && (
            <div className="rounded border border-[#2a2a3a] bg-[#0a0a0f] px-4 py-3 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-[#7c6aff]">AI Insight</p>
              <p className="text-xs text-[#e8e8f0]">
                <span className="text-[#6b6b80]">Top reason: </span>
                {data.meta_analysis.top_reason}
              </p>
              <p className="text-xs text-[#6b6b80]">{data.meta_analysis.pattern}</p>
              <p className="text-xs text-[#00d084]">{data.meta_analysis.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
