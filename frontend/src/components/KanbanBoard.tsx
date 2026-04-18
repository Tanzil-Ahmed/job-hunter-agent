import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { fetchJobs, updateJobStatus } from "../api/client";
import type { Job } from "../types/index";
import FitScoreModal from "./FitScoreModal";

type BoardStatus = "found" | "applied" | "interview" | "offer" | "rejected";
type FilterType = "all" | "tech" | "non-tech" | "internship";

const STATUS_ORDER: BoardStatus[] = ["found", "applied", "interview", "offer", "rejected"];

const STATUS_LABELS: Record<BoardStatus, string> = {
  found: "Found",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

const STATUS_BADGE_CLASSES: Record<BoardStatus, string> = {
  found: "bg-[#1a1a24] text-[#7c6aff] border border-[#2a2a3a]",
  applied: "bg-[#1a1a24] text-[#00d084] border border-[#2a2a3a]",
  interview: "bg-[#1a1a24] text-[#e8e8f0] border border-[#2a2a3a]",
  offer: "bg-[#1a1a24] text-[#00d084] border border-[#2a2a3a]",
  rejected: "bg-[#1a1a24] text-[#6b6b80] border border-[#2a2a3a]",
};

const TECH_KEYWORDS = [
  "engineer",
  "developer",
  "software",
  "frontend",
  "backend",
  "full stack",
  "data",
  "machine learning",
  "ai",
  "devops",
  "cloud",
  "qa",
  "security",
  "it",
  "product",
  "ux",
  "ui",
  "design",
];

const INTERNSHIP_KEYWORDS = ["intern", "internship", "placement", "co-op", "graduate"];

type BoardColumns = Record<BoardStatus, Job[]>;

function emptyColumns(): BoardColumns {
  return {
    found: [],
    applied: [],
    interview: [],
    offer: [],
    rejected: [],
  };
}

function isBoardStatus(value: string): value is BoardStatus {
  return STATUS_ORDER.includes(value as BoardStatus);
}

function groupJobsByStatus(jobs: Job[]): BoardColumns {
  const grouped = emptyColumns();

  for (const job of jobs) {
    const normalized = job.status.toLowerCase();
    if (isBoardStatus(normalized)) {
      grouped[normalized].push({ ...job, status: normalized });
    }
  }

  return grouped;
}

function isTechRole(title: string): boolean {
  const lower = title.toLowerCase();
  return TECH_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function isInternshipRole(title: string): boolean {
  const lower = title.toLowerCase();
  return INTERNSHIP_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function matchesFilter(job: Job, filter: FilterType): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "internship") {
    return isInternshipRole(job.job_title);
  }

  if (filter === "tech") {
    return isTechRole(job.job_title) && !isInternshipRole(job.job_title);
  }

  return !isTechRole(job.job_title) && !isInternshipRole(job.job_title);
}

function formatDaysAgo(discoveredAt: string): string {
  const discovered = new Date(discoveredAt);
  const now = new Date();
  const ms = now.getTime() - discovered.getTime();
  const days = Number.isNaN(ms) ? 0 : Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  return `${days}d ago`;
}

function getJobById(columns: BoardColumns, id: number): Job | undefined {
  for (const status of STATUS_ORDER) {
    const found = columns[status].find((job) => job.id === id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function getJobStatus(columns: BoardColumns, id: number): BoardStatus | undefined {
  for (const status of STATUS_ORDER) {
    if (columns[status].some((job) => job.id === id)) {
      return status;
    }
  }
  return undefined;
}

function moveJob(columns: BoardColumns, jobId: number, toStatus: BoardStatus): BoardColumns {
  const updated = emptyColumns();

  let movingJob: Job | undefined;
  for (const status of STATUS_ORDER) {
    updated[status] = columns[status].filter((job) => {
      if (job.id === jobId) {
        movingJob = job;
        return false;
      }
      return true;
    });
  }

  if (!movingJob) {
    return columns;
  }

  updated[toStatus] = [{ ...movingJob, status: toStatus }, ...updated[toStatus]];
  return updated;
}

function SortableJobCard({ job, onCardClick }: { job: Job; onCardClick: (job: Job) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `job-${job.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onCardClick(job)}
      className={`cursor-pointer rounded-md border border-[#2a2a3a] bg-[#1a1a24] p-3 font-mono ${
        isDragging ? "opacity-70" : "opacity-100"
      }`}
    >
      <p className="truncate text-sm font-bold text-[#e8e8f0]" title={job.job_title}>
        {job.job_title}
      </p>
      <p className="mt-1 text-xs text-[#6b6b80]">{job.company_name}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-[#6b6b80]">{formatDaysAgo(job.discovered_at)}</span>
        <span
          className={`rounded px-2 py-1 text-[10px] uppercase tracking-wide ${
            STATUS_BADGE_CLASSES[job.status as BoardStatus] ?? STATUS_BADGE_CLASSES.found
          }`}
        >
          {job.status}
        </span>
      </div>
      {job.job_url ? (
        <a
          href={job.job_url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 inline-block text-xs text-[#7c6aff] hover:text-[#e8e8f0]"
        >
          Apply →
        </a>
      ) : null}
    </article>
  );
}

function Column({
  status,
  jobs,
  onCardClick,
}: {
  status: BoardStatus;
  jobs: Job[];
  onCardClick: (job: Job) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-${status}`,
  });

  return (
    <section
      ref={setNodeRef}
      className="flex min-h-[280px] flex-col rounded-lg border border-[#2a2a3a] bg-[#111118] p-3 font-mono"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm text-[#e8e8f0]">{STATUS_LABELS[status]}</h3>
        <span className="rounded bg-[#1a1a24] px-2 py-1 text-xs text-[#6b6b80]">{jobs.length}</span>
      </div>
      <SortableContext items={jobs.map((job) => `job-${job.id}`)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          {jobs.length === 0 ? (
            <p className="mt-3 text-center text-xs text-[#6b6b80]">No jobs</p>
          ) : (
            jobs.map((job) => <SortableJobCard key={job.id} job={job} onCardClick={onCardClick} />)
          )}
        </div>
      </SortableContext>
    </section>
  );
}

interface KanbanBoardProps {
  filterOverride?: { status?: string; company?: string; order_by?: string };
}

export default function KanbanBoard({ filterOverride }: KanbanBoardProps = {}) {
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<BoardColumns>(emptyColumns());
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const data = await fetchJobs({
          limit: 200,
          ...(filterOverride?.status ? { status: filterOverride.status } : {}),
          ...(filterOverride?.company ? { company: filterOverride.company } : {}),
          ...(filterOverride?.order_by ? { order_by: filterOverride.order_by } : {}),
        });
        setColumns(groupJobsByStatus(data.jobs));
      } finally {
        setLoading(false);
      }
    };

    void loadJobs();
  }, []);

  const filteredColumns = useMemo<BoardColumns>(() => {
    const filtered = emptyColumns();
    for (const status of STATUS_ORDER) {
      filtered[status] = columns[status].filter((job) => matchesFilter(job, filter));
    }
    return filtered;
  }, [columns, filter]);

  const activeJob = activeJobId ? getJobById(columns, activeJobId) : undefined;

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith("job-")) {
      setActiveJobId(Number(id.replace("job-", "")));
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over || !event.active.id) {
      return;
    }

    const activeId = String(event.active.id);
    if (!activeId.startsWith("job-")) {
      return;
    }

    const jobId = Number(activeId.replace("job-", ""));
    const currentStatus = getJobStatus(columns, jobId);
    if (!currentStatus) {
      return;
    }

    const overId = String(event.over.id);
    const targetStatus = overId.startsWith("column-")
      ? (overId.replace("column-", "") as BoardStatus)
      : getJobStatus(columns, Number(overId.replace("job-", "")));

    if (!targetStatus || targetStatus === currentStatus) {
      return;
    }

    setColumns((prev) => moveJob(prev, jobId, targetStatus));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    setActiveJobId(null);

    if (!activeId.startsWith("job-") || !overId) {
      return;
    }

    const jobId = Number(activeId.replace("job-", ""));
    const beforeColumns = columns;
    const prevStatus = getJobStatus(beforeColumns, jobId);

    const targetStatus = overId.startsWith("column-")
      ? (overId.replace("column-", "") as BoardStatus)
      : getJobStatus(columns, Number(overId.replace("job-", "")));

    if (!prevStatus || !targetStatus || prevStatus === targetStatus) {
      return;
    }

    try {
      await updateJobStatus(jobId, targetStatus);
    } catch {
      setColumns(beforeColumns);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] font-mono text-[#e8e8f0]">
        Loading jobs...
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-[#0a0a0f] p-4 font-mono">
      {selectedJob && (
        <FitScoreModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "all", label: "All" },
            { id: "tech", label: "Tech" },
            { id: "non-tech", label: "Non-tech" },
            { id: "internship", label: "Internship" },
          ] as Array<{ id: FilterType; label: string }>
        ).map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => setFilter(pill.id)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === pill.id
                ? "border-[#7c6aff] bg-[#1a1a24] text-[#7c6aff]"
                : "border-[#2a2a3a] bg-[#111118] text-[#6b6b80]"
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {STATUS_ORDER.map((status) => (
            <Column key={status} status={status} jobs={filteredColumns[status]} onCardClick={setSelectedJob} />
          ))}
        </div>

        <DragOverlay>
          {activeJob ? (
            <div className="w-[260px]">
              <SortableJobCard job={activeJob} onCardClick={() => undefined} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
