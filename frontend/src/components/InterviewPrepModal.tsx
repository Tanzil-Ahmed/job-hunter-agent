import { useEffect, useRef, useState } from "react";
import { fetchInterviewPrep } from "../api/client";
import type { InterviewPrep, InterviewQuestion, Job } from "../types/index";

interface InterviewPrepModalProps {
  job: Job;
  onClose: () => void;
}

function QuestionItem({ item }: { item: InterviewQuestion }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(item.answer_template).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="rounded border border-[#2a2a3a] bg-[#0a0a0f]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-xs text-[#e8e8f0] hover:text-[#7c6aff]"
      >
        <span>{item.question}</span>
        <span className="shrink-0 text-[#6b6b80]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-[#2a2a3a] px-4 py-3">
          <div className="relative">
            <p className="border-l-2 border-[#7c6aff] pl-3 text-xs leading-5 text-[#6b6b80] whitespace-pre-wrap">
              {item.answer_template}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-0 top-0 rounded border border-[#2a2a3a] bg-[#1a1a24] px-2 py-0.5 text-[10px] text-[#6b6b80] hover:text-[#e8e8f0]"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[#7c6aff]">{title}</h3>
      {children}
    </section>
  );
}

export default function InterviewPrepModal({ job, onClose }: InterviewPrepModalProps) {
  const [prep, setPrep] = useState<InterviewPrep | null>(null);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchInterviewPrep(job.id);
        if (!cancelled) setPrep(data);
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
      <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#2a2a3a] bg-[#111118] font-mono">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#2a2a3a] px-6 py-4">
          <h2 className="text-sm font-bold text-[#e8e8f0]">
            Interview Prep — {job.company_name}
          </h2>
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
              Generating with Claude... this may take a moment.
            </div>
          ) : !prep || (prep.behavioral.length === 0 && prep.technical.length === 0) ? (
            <p className="text-xs text-[#ff4d6a]">Failed to generate prep material.</p>
          ) : (
            <div className="space-y-6">
              {prep.behavioral.length > 0 && (
                <Section title="Behavioral Questions">
                  {prep.behavioral.map((item, i) => (
                    <QuestionItem key={i} item={item} />
                  ))}
                </Section>
              )}

              {prep.technical.length > 0 && (
                <Section title="Technical Questions">
                  {prep.technical.map((item, i) => (
                    <QuestionItem key={i} item={item} />
                  ))}
                </Section>
              )}

              {prep.study_checklist.length > 0 && (
                <Section title="Study Checklist">
                  <ul className="space-y-1 pl-1">
                    {prep.study_checklist.map((topic, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-[#00d084]">
                        <span className="mt-0.5 shrink-0">•</span>
                        <span>{topic}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
