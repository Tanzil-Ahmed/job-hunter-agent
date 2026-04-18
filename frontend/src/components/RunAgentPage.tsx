import { useEffect, useRef, useState } from "react";
import { runAgent } from "../api/client";

type Mode = "full" | "search" | "apply" | "research";

const MODE_OPTIONS: Array<{ value: Mode; label: string }> = [
  { value: "full", label: "Full" },
  { value: "search", label: "Search Only" },
  { value: "apply", label: "Apply Only" },
  { value: "research", label: "Research Only" },
];

const STATUS_BADGE: Record<string, string> = {
  idle: "border-[#2a2a3a] text-[#6b6b80]",
  running: "border-[#7c6aff] text-[#7c6aff]",
  complete: "border-[#00d084] text-[#00d084]",
  error: "border-[#ff4d6a] text-[#ff4d6a]",
};

interface RunAgentPageProps {
  agentStatus: string;
  onStatusChange: (status: string) => void;
}

export default function RunAgentPage({ agentStatus, onStatusChange }: RunAgentPageProps) {
  const [mode, setMode] = useState<Mode>("full");
  const [limit, setLimit] = useState(5);
  const [dryRun, setDryRun] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [lines]);

  // Connect WebSocket
  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/api/ws/logs");
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as { type?: string; status?: string };
        if (parsed.type === "heartbeat") {
          if (parsed.status) onStatusChange(parsed.status);
          return;
        }
      } catch {
        // not JSON — treat as log line
      }
      setLines((prev) => [...prev, e.data]);
    };

    ws.onerror = () => onStatusChange("error");

    return () => ws.close();
  }, [onStatusChange]);

  const handleStart = async () => {
    try {
      await runAgent({ mode, limit, dry_run: dryRun });
      onStatusChange("running");
    } catch {
      onStatusChange("error");
    }
  };

  const handleClear = () => setLines([]);

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (!Number.isNaN(v) && v > 0) setLimit(v);
  };

  return (
    <div className="flex h-full flex-col gap-5 p-6 font-mono">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#e8e8f0]">Run Agent</h1>
        <span
          className={`rounded border px-3 py-1 text-xs uppercase ${STATUS_BADGE[agentStatus] ?? STATUS_BADGE.idle}`}
        >
          {agentStatus}
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-[#2a2a3a] bg-[#111118] p-4">
        {/* Mode */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#6b6b80]">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rounded border border-[#2a2a3a] bg-[#1a1a24] px-3 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:ring-1 focus:ring-[#7c6aff]"
          >
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Limit */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#6b6b80]">Job limit</label>
          <input
            type="number"
            min={1}
            value={limit}
            onChange={handleLimitChange}
            className="w-20 rounded border border-[#2a2a3a] bg-[#1a1a24] px-3 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:ring-1 focus:ring-[#7c6aff]"
          />
        </div>

        {/* Dry run */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#6b6b80]">Dry run</label>
          <button
            type="button"
            onClick={() => setDryRun((v) => !v)}
            className={`w-12 rounded border px-2 py-1.5 text-xs transition-colors ${
              dryRun
                ? "border-[#7c6aff] bg-[#7c6aff] text-white"
                : "border-[#2a2a3a] bg-[#1a1a24] text-[#6b6b80]"
            }`}
          >
            {dryRun ? "ON" : "OFF"}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleStart}
            disabled={agentStatus === "running"}
            className="rounded bg-[#7c6aff] px-4 py-1.5 text-xs text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded border border-[#2a2a3a] px-4 py-1.5 text-xs text-[#6b6b80] hover:text-[#e8e8f0]"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Console */}
      <div
        ref={consoleRef}
        className="flex-1 overflow-y-auto rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-4 text-xs leading-5 text-[#00d084]"
        style={{ minHeight: "240px" }}
      >
        {lines.length === 0 ? (
          <span className="text-[#6b6b80]">Console output will appear here...</span>
        ) : (
          lines.map((line, i) => (
            <div key={i}>{line}</div>
          ))
        )}
      </div>
    </div>
  );
}
