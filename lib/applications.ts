import { supabase } from "./supabase";
import type { Application } from "./types";

export async function applyToJob(jobId: string, message?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("poster_id, status")
    .eq("id", jobId)
    .single();
  if (jobError) throw jobError;
  if (job?.poster_id === user.id) throw new Error("You can't apply to your own job.");
  if (job?.status !== "open") throw new Error("This job is no longer open for applications.");

  const canApply = await supabase.rpc("can_apply_to_job", { p_job_id: jobId });
  if (!canApply.data) throw new Error("This job is no longer available for applications.");

  const { data, error } = await supabase
    .from("applications")
    .insert([{ job_id: jobId, worker_id: user.id, message }])
    .select()
    .single();

  if (error) {
    if (error.code === "23505" || error.message?.toLowerCase().includes("duplicate")) {
      throw new Error("You've already applied for this job.");
    }
    throw error;
  }
  return data;
}

export async function getApplicationsForJob(jobId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from("applications")
    .select("*, worker:profiles!worker_id(display_name, completed_jobs_count)")
    .eq("job_id", jobId);

  if (error) throw error;
  return data ?? [];
}

export async function selectWorker(jobId: string, workerId: string) {
  const { error } = await supabase.rpc("select_worker_for_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
  });
  if (error) throw error;
}

export async function reopenApplicationsForJob(jobId: string, workerId?: string) {
  let query = supabase
    .from("applications")
    .update({ status: "applied" })
    .eq("job_id", jobId);

  if (workerId) {
    query = query.eq("worker_id", workerId);
  } else {
    query = query.eq("status", "selected");
  }

  const { error } = await query;
  if (error) throw error;
}

export async function getMyApplications(): Promise<Application[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("applications")
    .select("*, job:jobs(title, budget_gbp, status, urgency)")
    .eq("worker_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
