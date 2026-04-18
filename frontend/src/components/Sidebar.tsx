type Page = "dashboard" | "run-agent" | "jobs" | "applications" | "files" | "settings";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: Page) => void;
  agentStatus: string;
}

const NAV_ITEMS: Array<{ id: Page; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "run-agent", label: "Run Agent" },
  { id: "jobs", label: "Jobs" },
  { id: "applications", label: "Applications" },
  { id: "files", label: "Files" },
  { id: "settings", label: "Settings" },
];

const STATUS_DOT: Record<string, string> = {
  running: "bg-[#00d084] animate-pulse",
  complete: "bg-[#00d084]",
  error: "bg-[#ff4d6a]",
  idle: "bg-[#6b6b80]",
};

export default function Sidebar({ activePage, onNavigate, agentStatus }: SidebarProps) {
  const dotClass = STATUS_DOT[agentStatus] ?? STATUS_DOT.idle;

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-[#2a2a3a] bg-[#111118] font-mono">
      {/* Brand */}
      <div className="border-b border-[#2a2a3a] px-5 py-5">
        <p className="text-sm font-bold text-[#7c6aff]">Job Hunter AI</p>
        <p className="mt-0.5 text-xs text-[#6b6b80]">Navigation Console</p>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
              activePage === item.id
                ? "bg-[#7c6aff] text-white"
                : "text-[#6b6b80] hover:bg-[#1a1a24] hover:text-[#e8e8f0]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Status */}
      <div className="border-t border-[#2a2a3a] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
          <span className="text-xs capitalize text-[#6b6b80]">Agent: {agentStatus}</span>
        </div>
      </div>
    </aside>
  );
}
