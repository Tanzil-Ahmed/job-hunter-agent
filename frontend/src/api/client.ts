import axios from "axios";

import type {
  Application,
  FileEntry,
  FitBreakdown,
  FollowUpEmail,
  GhostedJob,
  InterviewPrep,
  Job,
  RejectionPatterns,
  RejectionReason,
  Stats,
} from "../types";

type QueryParams = Record<string, string | number | boolean | undefined>;

export const apiClient = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

export async function fetchStats(): Promise<Stats> {
  const response = await apiClient.get<{ stats: Stats }>("/api/stats");
  return response.data.stats;
}

export async function fetchJobs(
  params?: QueryParams,
): Promise<{ jobs: Job[]; total: number }> {
  const response = await apiClient.get<{ jobs: Job[]; total: number }>("/api/jobs", {
    params,
  });

  return response.data;
}

export async function fetchApplications(
  params?: QueryParams,
): Promise<{ applications: Application[]; total: number }> {
  const response = await apiClient.get<{ applications: Application[]; total: number }>(
    "/api/applications",
    { params },
  );

  return response.data;
}

export async function updateJobStatus(jobId: number, status: string): Promise<Job> {
  const response = await apiClient.patch<{ job: Job }>(`/api/jobs/${jobId}/status`, {
    status,
  });

  return response.data.job;
}

export async function fetchFitBreakdown(jobId: number): Promise<FitBreakdown> {
  const response = await apiClient.get<{ fit_breakdown: FitBreakdown }>(
    `/api/jobs/${jobId}/fit-breakdown`,
  );

  return response.data.fit_breakdown;
}

export async function fetchInterviewPrep(jobId: number): Promise<InterviewPrep> {
  const response = await apiClient.get<{ interview_prep: InterviewPrep }>(
    `/api/jobs/${jobId}/interview-prep`,
  );
  return response.data.interview_prep;
}

export async function submitRejection(
  jobId: number,
  body: { text?: string; ghost?: boolean },
): Promise<RejectionReason> {
  const response = await apiClient.post<{ rejection_reason: RejectionReason }>(
    `/api/jobs/${jobId}/rejection`,
    body,
  );
  return response.data.rejection_reason;
}

export async function fetchRejectionPatterns(): Promise<RejectionPatterns> {
  const response = await apiClient.get<RejectionPatterns>("/api/rejection-patterns");
  return response.data;
}

export async function fetchApplyToday(): Promise<{ applications: Application[]; count: number; date: string }> {
  const response = await apiClient.get<{ applications: Application[]; count: number; date: string }>(
    "/api/apply-today",
  );
  return response.data;
}

export async function runAgent(body: { mode: string; limit: number; dry_run: boolean }): Promise<{ status: string; run_id: string }> {
  const response = await apiClient.post<{ status: string; run_id: string }>("/api/run", body);
  return response.data;
}

export async function fetchRunStatus(): Promise<{ status: string; run_id: string | null; last_10_lines: string[] }> {
  const response = await apiClient.get<{ status: string; run_id: string | null; last_10_lines: string[] }>(
    "/api/run/status",
  );
  return response.data;
}

export async function fetchFiles(): Promise<{ files: FileEntry[] }> {
  const response = await apiClient.get<{ files: FileEntry[] }>("/api/files");
  return response.data;
}

export async function fetchGhostedJobs(): Promise<{ ghosted_jobs: GhostedJob[]; total: number }> {
  const response = await apiClient.get<{ ghosted_jobs: GhostedJob[]; total: number }>("/api/ghost-detector");
  return response.data;
}

export async function generateFollowUp(jobId: number): Promise<FollowUpEmail> {
  const response = await apiClient.post<{ follow_up: FollowUpEmail }>(`/api/jobs/${jobId}/follow-up`);
  return response.data.follow_up;
}
