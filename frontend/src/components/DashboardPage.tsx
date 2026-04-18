import { useEffect, useState } from "react";
import { fetchApplyToday, fetchStats } from "../api/client";
import type { Application, Stats } from "../types";
import RejectionPatternsCard from "./RejectionPatternsCard";

function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const steps = 30;
    const increment = target / steps;
    const interval = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { setValue(target); clearInterval(timer); }
      else { setValue(Math.floor(current)); }
    }, interval);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

interface StatCardProps { label: string; value: number; suffix?: string; accent?: boolean }

function StatCard({ label, value, suffix = "", accent = false }: StatCardProps) {
  const displayed = useCountUp(value);
  return (
    <div className="rounded-lg border border-[#2a2a3a] bg-[#111118] p-5">
      <p className="text-xs text-[#6b6b80]">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent ? "text-[#7c6aff]" : "text-[#e8e8f0]"}`}>
        {displayed}{suffix}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayApps, setTodayApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t] = await Promise.all([fetchStats(), fetchApplyToday()]);
        setStats(s);
        setTodayApps(t.applications);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#6b6b80]">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 font-mono">
      <h1 className="text-lg font-bold text-[#e8e8f0]">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total Jobs" value={stats?.total_jobs ?? 0} />
        <StatCard label="Applied Today" value={stats?.applied_today ?? 0} accent />
        <StatCard label="Applications" value={stats?.total_applications ?? 0} />
        <StatCard label="Interview Rate" value={stats?.success_rate ?? 0} suffix="%" accent />
      </div>

      {/* Applied today */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-[#e8e8f0]">Applied Today</h2>
        {todayApps.length === 0 ? (
          <p className="text-xs text-[#6b6b80]">No applications today.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#2a2a3a]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a3a] bg-[#111118] text-[#6b6b80]">
                  <th className="px-4 py-2 text-left">Job Title</th>
                  <th className="px-4 py-2 text-left">Company</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {todayApps.map((app, i) => (
                  <tr
                    key={app.id ?? i}
                    className="border-b border-[#2a2a3a] last:border-0 odd:bg-[#0a0a0f] even:bg-[#111118]"
                  >
                    <td className="px-4 py-2 text-[#e8e8f0]">{app.job_title}</td>
                    <td className="px-4 py-2 text-[#6b6b80]">{app.company_name}</td>
                    <td className="px-4 py-2">
                      <span className="rounded border border-[#2a2a3a] bg-[#1a1a24] px-2 py-0.5 text-[10px] uppercase text-[#00d084]">
                        {app.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RejectionPatternsCard />
    </div>
  );
}
