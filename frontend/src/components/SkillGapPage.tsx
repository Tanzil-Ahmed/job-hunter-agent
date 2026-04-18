import { useEffect, useState } from "react";
import { fetchSkillGap } from "../api/client";
import type { SkillGapData, SkillGapItem } from "../types/index";

function SkillBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round((value / 10) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-right text-[10px] text-[#6b6b80]">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1a1a24]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-4 text-right text-[10px] text-[#6b6b80]">{value}</span>
    </div>
  );
}

function SkillRow({ item }: { item: SkillGapItem }) {
  const gap = item.demand_score - item.your_score;
  return (
    <div className="rounded border border-[#2a2a3a] bg-[#0a0a0f] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold text-[#e8e8f0]">{item.name}</span>
        {gap > 0 && (
          <span className="text-xs text-[#ff4d6a]">gap: {gap}</span>
        )}
      </div>
      <div className="space-y-1.5">
        <SkillBar label="Demand" value={item.demand_score} color="bg-[#ff4d6a]" />
        <SkillBar label="Yours" value={item.your_score} color="bg-[#00d084]" />
      </div>
    </div>
  );
}

export default function SkillGapPage() {
  const [data, setData] = useState<SkillGapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await fetchSkillGap();
        setData(result);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-sm text-[#6b6b80]">
        Analyzing your skill gaps...
      </div>
    );
  }

  const hasSkills = data && data.skills.length > 0;

  return (
    <div className="space-y-6 p-6 font-mono">
      <h1 className="text-lg font-bold text-[#e8e8f0]">Skill Gap Radar</h1>

      {/* Summary card */}
      {data?.summary && (
        <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-5">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-[#7c6aff]">AI Analysis</p>
          <p className="text-xs leading-5 text-[#6b6b80]">{data.summary}</p>
        </div>
      )}

      {!hasSkills ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-[#2a2a3a] text-xs text-[#6b6b80]">
          Run fit scores on more jobs to see skill gaps.
        </div>
      ) : (
        <>
          {/* Bar comparison grid */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.skills.map((item) => (
              <SkillRow key={item.name} item={item} />
            ))}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-lg border border-[#2a2a3a]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a3a] bg-[#111118] text-[#6b6b80]">
                  <th className="px-4 py-2 text-left">Skill</th>
                  <th className="px-4 py-2 text-center">Demand</th>
                  <th className="px-4 py-2 text-center">Yours</th>
                  <th className="px-4 py-2 text-center">Gap</th>
                  <th className="px-4 py-2 text-left">Learn</th>
                </tr>
              </thead>
              <tbody>
                {data.skills.map((item) => {
                  const gap = item.demand_score - item.your_score;
                  return (
                    <tr
                      key={item.name}
                      className="border-b border-[#2a2a3a] last:border-0 odd:bg-[#0a0a0f] even:bg-[#111118]"
                    >
                      <td className="px-4 py-2 font-bold text-[#e8e8f0]">{item.name}</td>
                      <td className="px-4 py-2 text-center text-[#ff4d6a]">{item.demand_score}</td>
                      <td className="px-4 py-2 text-center text-[#00d084]">{item.your_score}</td>
                      <td className={`px-4 py-2 text-center ${gap > 0 ? "text-[#ff4d6a]" : "text-[#00d084]"}`}>
                        {gap > 0 ? `+${gap}` : gap}
                      </td>
                      <td className="px-4 py-2">
                        {item.resource_url ? (
                          <a
                            href={item.resource_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#7c6aff] hover:text-[#e8e8f0]"
                          >
                            {item.resource_name ?? "Learn →"}
                          </a>
                        ) : (
                          <span className="text-[#6b6b80]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-[10px] text-[#6b6b80]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-[#ff4d6a]" /> Demand (job market)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-[#00d084]" /> Yours (current level)
            </span>
          </div>
        </>
      )}
    </div>
  );
}
