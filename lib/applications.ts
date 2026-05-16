import { supabase } from "./supabase";
import type { Application } from "./types";
import { getProfileDisplayNames } from "./profiles";

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

  const existing = await getMyApplicationForJob(jobId);
  if (existing && existing.status !== "withdrawn") {
    if (existing.status === "selected") {
      throw new Error("This previous selected application cannot be reset from app code yet. Phase 2 needs a database/RLS helper before the same worker can reapply.");
    }
    throw new Error("You've already applied for this job.");
  }
  if (existing?.status === "withdrawn") {
    throw new Error("This previous application cannot be reopened yet. Try another open job for now.");
  }

  const canApply = await supabase.rpc("can_apply_to_job", { p_job_id: jobId });
  if (canApply.error) throw canApply.error;
  if (!canApply.data) {
    throw new Error("This job is no longer available for applications, or your application limit/profile status prevents applying.");
  }

  const write = supabase
    .from("applications")
    .insert([{ job_id: jobId, worker_id: user.id, message }])
    .select()
    .single();

  const { data, error } = await write;

  if (error) {
    if (error.code === "23505" || error.message?.toLowerCase().includes("duplicate")) {
      throw new Error("You've already applied for this job.");
    }
    throw error;
  }
  return data;
}

export async function getMyApplicationForJob(jobId: string): Promise<Application | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("job_id", jobId)
    .eq("worker_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function withdrawApplication(jobId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const existing = await getMyApplicationForJob(jobId);
  if (!existing) throw new Error("No application was found for this job.");
  if (existing.status !== "applied") {
    throw new Error("Only active applications can be withdrawn. Selected workers should use Leave Job.");
  }

  const { error } = await supabase.rpc("withdraw_worker_from_job", { p_job_id: jobId });

  if (error) throw error;
  const updated = await getMyApplicationForJob(jobId);
  if (!updated || updated.status !== "withdrawn") {
    throw new Error("Application withdrawal was not confirmed. This may be a database/RLS issue.");
  }
  return updated;
}

export async function getApplicationsForJob(jobId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from("applications")
    .select("*, worker:profiles!worker_id(display_name, completed_jobs_count)")
    .eq("job_id", jobId)
    .neq("status", "withdrawn");

  if (error) throw error;
  const rows = data ?? [];
  const missingNames = rows
    .filter((row: any) => !row.worker?.display_name)
    .map((row: any) => row.worker_id);
  if (missingNames.length === 0) return rows;

  const displayNames = await getProfileDisplayNames(missingNames);
  return rows.map((row: any) => ({
    ...row,
    worker: {
      ...(row.worker ?? {}),
      display_name: row.worker?.display_name || displayNames[row.worker_id] || "Applicant",
    },
  }));
}

export async function selectWorker(jobId: string, workerId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: currentJob, error: currentJobError } = await supabase
    .from("jobs")
    .select("poster_id,status")
    .eq("id", jobId)
    .single();
  if (currentJobError) throw currentJobError;
  if (currentJob?.poster_id !== user.id) throw new Error("Only the poster can accept an applicant.");
  if (currentJob?.status !== "open") throw new Error("Applications are already closed for this job.");

  const { error } = await supabase.rpc("select_worker_for_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
  });
  if (error) throw error;

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id,status,accepted_worker_id")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) throw jobError;
  if (!job) throw new Error("Worker selection could not be verified. This may be a permissions/RLS issue.");
  if (job.status !== "held" || job.accepted_worker_id !== workerId) {
    throw new Error("Worker was not selected. This may be a database/RLS issue.");
  }

  const { data: verifiedJob, error: verifyError } = await supabase
    .from("jobs")
    .select("id,status,accepted_worker_id")
    .eq("id", jobId)
    .maybeSingle();

  if (verifyError) throw verifyError;
  if (verifiedJob?.status !== "held" || verifiedJob?.accepted_worker_id !== workerId) {
    throw new Error("Worker was not selected. This may be a database/RLS issue.");
  }

  return job;
}

export async function getApplicationCountsForJobs(jobIds: string[]): Promise<Record<string, number>> {
  if (jobIds.length === 0) return {};
  const { data, error } = await supabase
    .from("applications")
    .select("job_id")
    .in("job_id", jobIds)
    .eq("status", "applied");

  if (error) throw error;
  return (data ?? []).reduce<Record<string, number>>((acc, row: any) => {
    acc[row.job_id] = (acc[row.job_id] || 0) + 1;
    return acc;
  }, {});
}

export async function reopenApplicationsForJob(jobId: string, workerId?: string) {
  throw new Error(
    "Reopening previous applications needs a Phase 2 database/RLS helper. The job can reopen, but old application rows cannot be reset safely from app code yet."
  );
}

export async function getMyApplications(): Promise<Application[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("applications")
    .select("*, job:jobs(id,title,budget_gbp,status,urgency,postcode,postcode_district,poster_id,accepted_worker_id,agreed_start_at)")
    .eq("worker_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
