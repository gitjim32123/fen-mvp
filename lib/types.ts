export type JobStatus = "open" | "held" | "confirm_pending" | "in_progress" | "completed" | "cancelled";
export type Urgency = "Need now" | "Today" | "Flexible";
export type TransportMode = "walk" | "cycle" | "drive" | "public_transport" | "unspecified";
export type PlanTier = "free" | "worker_plus";
export type ApplicationStatus = "applied" | "rejected" | "selected" | "withdrawn";

export type Profile = {
  id: string;
  display_name: string;
  email: string;
  postcode: string;
  bio?: string;
  skills?: string;
  transport_mode: TransportMode;
  profile_photo_url?: string;
  plan_tier: PlanTier;
  completed_jobs_count: number;
  is_suspended: boolean;
  strike_count?: number;
};

export type Job = {
  id: string;
  poster_id: string;
  title: string;
  description: string;
  budget_gbp: number;
  postcode: string;
  postcode_district: string;
  category?: string;
  urgency: Urgency;
  preferred_start_at?: string;
  agreed_start_at?: string;
  status: JobStatus;
  accepted_worker_id?: string;
  tools_supplied: boolean;
  cancel_reason?: string;
  deleted_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  created_at: string;
  updated_at: string;
};

export type Application = {
  id: string;
  job_id: string;
  worker_id: string;
  message?: string;
  status: ApplicationStatus;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  job_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  job_id: string;
  poster_id: string;
  worker_id: string;
  is_archived: boolean;
  updated_at?: string;
  job?: {
    title?: string;
    status?: JobStatus;
    accepted_worker_id?: string | null;
  };
};
