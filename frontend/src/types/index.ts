export interface Job {
  id: number;
  job_title: string;
  company_name: string;
  location?: string;
  job_url?: string;
  status: string;
  discovered_at: string;
  fit_score?: number;
  fit_breakdown?: FitBreakdown;
}

export interface FitBreakdown {
  skills: number;
  location: number;
  culture: number;
  seniority: number;
  missing: string[];
}

export interface Application {
  id: number;
  job_id: number;
  job_title: string;
  company_name: string;
  status: string;
  applied_at: string;
}

export interface Stats {
  total_jobs: number;
  applied_today: number;
  total_applications: number;
  total_companies: number;
  success_rate: number;
}

export interface FileEntry {
  name: string;
  size: number;
  modified: string;
}

export interface InterviewQuestion {
  question: string;
  answer_template: string;
}

export interface InterviewPrep {
  behavioral: InterviewQuestion[];
  technical: InterviewQuestion[];
  study_checklist: string[];
}
