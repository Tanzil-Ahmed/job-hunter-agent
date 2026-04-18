import { useEffect, useRef, useState } from "react";
import { generateFollowUp } from "../api/client";
import type { FollowUpEmail, GhostedJob } from "../types/index";

interface FollowUpModalProps {
  job: GhostedJob;
  onClose: () => void;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded border border-[#2a2a3a] bg-[#1a1a24] px-3 py-1 text-xs text-[#6b6b80] hover:text-[#e8e8f0]"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

export default function FollowUpModal({ job, onClose }: FollowUpModalProps) {
  const [email, setEmail] = useState<FollowUpEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await generateFollowUp(job.id);
        if (!cancelled) setEmail(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
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
      <div className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#2a2a3a] bg-[#111118] font-mono">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#2a2a3a] px-6 py-4">
          <div>
            <h2 className="text-sm font-bold text-[#e8e8f0]">Follow-Up Email</h2>
            <p className="mt-0.5 text-xs text-[#6b6b80]">{job.company_name} — {job.job_title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#6b6b80] hover:text-[#e8e8f0]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-xs text-[#6b6b80]">
              Generating follow-up email...
            </div>
          ) : error || !email ? (
            <p className="text-xs text-[#ff4d6a]">Failed to generate email. Please try again.</p>
          ) : (
            <div className="space-y-4">
              {/* Subject */}
              <div className="rounded border border-[#2a2a3a] bg-[#0a0a0f] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[#7c6aff]">Subject</span>
                  <CopyButton text={email.subject} label="Copy Subject" />
                </div>
                <p className="text-xs text-[#e8e8f0]">{email.subject}</p>
              </div>

              {/* Body */}
              <div className="rounded border border-[#2a2a3a] bg-[#0a0a0f] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[#7c6aff]">Body</span>
                  <CopyButton text={email.body} label="Copy Body" />
                </div>
                <p className="whitespace-pre-wrap text-xs leading-5 text-[#6b6b80]">{email.body}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
