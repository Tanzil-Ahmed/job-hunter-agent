import { useEffect, useState } from "react";
import { fetchFiles } from "../api/client";
import type { FileEntry } from "../types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function fileIcon(name: string): string {
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".docx")) return "DOC";
  if (name.endsWith(".txt")) return "TXT";
  return "FILE";
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchFiles();
        setFiles(data.files);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 p-6 font-mono">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#e8e8f0]">Files</h1>
        <span className="text-xs text-[#6b6b80]">{files.length} file{files.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-xs text-[#6b6b80]">Loading...</div>
      ) : files.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-[#2a2a3a] text-xs text-[#6b6b80]">
          No generated files yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#2a2a3a]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2a2a3a] bg-[#111118] text-[#6b6b80]">
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Filename</th>
                <th className="px-4 py-2 text-left">Size</th>
                <th className="px-4 py-2 text-left">Modified</th>
                <th className="px-4 py-2 text-left">Download</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr
                  key={f.name}
                  className="border-b border-[#2a2a3a] last:border-0 odd:bg-[#0a0a0f] even:bg-[#111118]"
                >
                  <td className="px-4 py-2">
                    <span className="rounded border border-[#2a2a3a] bg-[#1a1a24] px-1.5 py-0.5 text-[10px] text-[#7c6aff]">
                      {fileIcon(f.name)}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-[#e8e8f0]" title={f.name}>
                    {f.name}
                  </td>
                  <td className="px-4 py-2 text-[#6b6b80]">{formatSize(f.size)}</td>
                  <td className="px-4 py-2 text-[#6b6b80]">{formatDate(f.modified)}</td>
                  <td className="px-4 py-2">
                    <a
                      href={`http://127.0.0.1:8000/api/files/${encodeURIComponent(f.name)}`}
                      download={f.name}
                      className="text-[#7c6aff] hover:text-[#e8e8f0]"
                    >
                      ↓ Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
