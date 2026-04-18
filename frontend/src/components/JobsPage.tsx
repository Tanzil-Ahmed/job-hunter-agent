import { useState } from "react";
import KanbanBoard from "./KanbanBoard";

const STATUS_OPTIONS = ["", "found", "applied", "interview", "offer", "rejected"];
const SORT_OPTIONS = [
  { value: "discovered_at", label: "Discovered" },
  { value: "updated_at", label: "Updated" },
  { value: "job_title", label: "Title" },
  { value: "company_name", label: "Company" },
];

export default function JobsPage() {
  const [status, setStatus] = useState("");
  const [company, setCompany] = useState("");
  const [orderBy, setOrderBy] = useState("discovered_at");
  const [queryKey, setQueryKey] = useState(0);

  const handleSearch = () => setQueryKey((k) => k + 1);

  return (
    <div className="flex h-full flex-col gap-4 p-6 font-mono">
      <h1 className="text-lg font-bold text-[#e8e8f0]">Jobs</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[#2a2a3a] bg-[#111118] p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#6b6b80]">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border border-[#2a2a3a] bg-[#1a1a24] px-3 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:ring-1 focus:ring-[#7c6aff]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === "" ? "All statuses" : s}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#6b6b80]">Company</label>
          <input
            type="text"
            placeholder="Filter company..."
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="rounded border border-[#2a2a3a] bg-[#1a1a24] px-3 py-1.5 text-xs text-[#e8e8f0] placeholder-[#6b6b80] focus:outline-none focus:ring-1 focus:ring-[#7c6aff]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#6b6b80]">Sort by</label>
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value)}
            className="rounded border border-[#2a2a3a] bg-[#1a1a24] px-3 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:ring-1 focus:ring-[#7c6aff]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleSearch}
          className="rounded bg-[#7c6aff] px-4 py-1.5 text-xs text-white hover:opacity-80"
        >
          Search
        </button>
      </div>

      {/* Kanban — key prop forces remount on search */}
      <div className="flex-1 overflow-auto">
        <KanbanBoard key={queryKey} filterOverride={{ status, company, order_by: orderBy }} />
      </div>
    </div>
  );
}
