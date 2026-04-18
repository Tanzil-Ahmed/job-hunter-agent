import { useCallback, useEffect, useState } from "react";
import { fetchApplications } from "../api/client";
import type { Application } from "../types";

const STATUS_OPTIONS = ["", "applied", "interview", "offer", "rejected"];
const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
  applied: "text-[#e8e8f0]",
  interview: "text-[#7c6aff]",
  offer: "text-[#00d084]",
  rejected: "text-[#ff4d6a]",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (pageNum: number, statusFilter: string) => {
    setLoading(true);
    try {
      const data = await fetchApplications({
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setApps(data.applications);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(page, status); }, [page, status, load]);

  const handleStatusChange = (v: string) => { setStatus(v); setPage(0); };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex h-full flex-col gap-4 p-6 font-mono">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#e8e8f0]">Applications</h1>
        <span className="text-xs text-[#6b6b80]">{total} total</span>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-[#6b6b80]">Status:</label>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded border border-[#2a2a3a] bg-[#1a1a24] px-3 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:ring-1 focus:ring-[#7c6aff]"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "" ? "All" : s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-[#2a2a3a]">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-xs text-[#6b6b80]">Loading...</div>
        ) : apps.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-[#6b6b80]">No applications found.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="sticky top-0 border-b border-[#2a2a3a] bg-[#111118] text-[#6b6b80]">
                <th className="px-4 py-2 text-left">Job Title</th>
                <th className="px-4 py-2 text-left">Company</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Applied At</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr
                  key={app.id}
                  className="border-b border-[#2a2a3a] last:border-0 odd:bg-[#0a0a0f] even:bg-[#111118]"
                >
                  <td className="px-4 py-2 text-[#e8e8f0]">{app.job_title}</td>
                  <td className="px-4 py-2 text-[#6b6b80]">{app.company_name}</td>
                  <td className={`px-4 py-2 capitalize ${STATUS_COLORS[app.status] ?? "text-[#e8e8f0]"}`}>
                    {app.status}
                  </td>
                  <td className="px-4 py-2 text-[#6b6b80]">{formatDate(app.applied_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-[#6b6b80]">
        <span>Page {page + 1} of {totalPages}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded border border-[#2a2a3a] px-3 py-1 hover:text-[#e8e8f0] disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded border border-[#2a2a3a] px-3 py-1 hover:text-[#e8e8f0] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
