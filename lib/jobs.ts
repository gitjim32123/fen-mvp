import { supabase } from "./supabase";
import type { Job } from "./types";

export async function getJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .is("deleted_at", null)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getJobsNearby(postcode?: string): Promise<Job[]> {
  let query = supabase
    .from("jobs")
    .select("*")
    .is("deleted_at", null)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (postcode) {
    query = query.ilike("postcode_district", `${postcode.split(" ")[0]}%`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
}

export async function getJob(id: string): Promise<Job> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function postJob(formData: {
  title: string;
  description: string;
  budget_gbp: number;
  postcode: string;
  category?: string;
  urgency: string;
  tools_supplied?: boolean;
  preferred_start_at?: string;
  lat?: number | null;
  lng?: number | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const postcode = formData.postcode.trim().toUpperCase() || "AREA NOT PROVIDED";
  const postcodeDistrict = postcode.includes("→")
    ? postcode.split("→")[0].trim().split(" ")[0]
    : postcode.split(" ")[0];

  const { data, error } = await supabase
    .from("jobs")
    .insert([{
      title: formData.title,
      description: formData.description,
      budget_gbp: formData.budget_gbp,
      postcode,
      postcode_district: postcodeDistrict || postcode,
      category: formData.category,
      urgency: formData.urgency,
      tools_supplied: formData.tools_supplied,
      preferred_start_at: formData.preferred_start_at,
      lat: formData.lat ?? null,
      lng: formData.lng ?? null,
      poster_id: user.id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJobDetails(
  id: string,
  updates: {
    title: string;
    description: string;
    budget_gbp: number;
    category?: string;
    postcode?: string;
  }
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const postcode = updates.postcode?.trim().toUpperCase() || "AREA NOT PROVIDED";
  const postcodeDistrict = postcode === "AREA NOT PROVIDED" ? "AREA" : postcode.split(" ")[0] || postcode;

  const { data, error } = await supabase
    .from("jobs")
    .update({
      title: updates.title.trim(),
      description: updates.description.trim(),
      budget_gbp: updates.budget_gbp,
      category: updates.category?.trim() || null,
      postcode,
      postcode_district: postcodeDistrict,
    })
    .eq("id", id)
    .eq("poster_id", user.id)
    .eq("status", "open")
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function cancelJob(id: string, reason: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: "cancelled",
      cancel_reason: reason,
      accepted_worker_id: null,
      preferred_start_at: null,
      agreed_start_at: null,
    })
    .eq("id", id)
    .eq("poster_id", user.id)
    .in("status", ["open", "held", "confirm_pending", "in_progress"])
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No job was updated. This may be a permissions/RLS issue.");
  return data;
}

export async function removeJob(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "cancelled", deleted_at: new Date().toISOString(), cancel_reason: "Removed by poster" })
    .eq("id", id)
    .eq("poster_id", user.id)
    .in("status", ["open", "cancelled", "completed"])
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No job was updated. This may be a permissions/RLS issue.");
  return data;
}

export async function reopenJob(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "open", accepted_worker_id: null, preferred_start_at: null, agreed_start_at: null, cancel_reason: null })
    .eq("id", id)
    .eq("poster_id", user.id)
    .eq("status", "cancelled")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("This job cannot be reopened from its current state.");
  return data;
}

export async function leaveAcceptedJob(id: string, workerId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== workerId) throw new Error("Not signed in as the selected worker.");

  const { data: currentJob, error: currentJobError } = await supabase
    .from("jobs")
    .select("id,status,accepted_worker_id")
    .eq("id", id)
    .maybeSingle();

  if (currentJobError) throw currentJobError;
  if (!currentJob || currentJob.accepted_worker_id !== workerId) {
    throw new Error("You are not the selected worker for this job.");
  }
  if (!["held", "confirm_pending", "in_progress"].includes(currentJob.status)) {
    throw new Error("This job cannot be left from its current state.");
  }

  const { data: result, error } = await supabase.rpc("withdraw_worker_from_job", { p_job_id: id });
  if (error) throw error;
  if (result !== "reopened") {
    throw new Error("The job was not reopened after leaving. This may be a database/RLS issue.");
  }

  const { data, error: reloadError } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (reloadError) throw reloadError;
  if (!data) throw new Error("The job was reopened, but could not be reloaded.");
  return data;
}

export async function proposeJobStartTime(id: string, startTime: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "confirm_pending", preferred_start_at: startTime, agreed_start_at: null })
    .eq("id", id)
    .eq("poster_id", user.id)
    .in("status", ["held", "confirm_pending"])
    .select("id,status,preferred_start_at,agreed_start_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No job was updated. This may be a permissions/RLS issue.");
  return data;
}

export async function confirmJobStartTime(id: string, workerId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== workerId) throw new Error("Not signed in as the selected worker.");

  const { data: job, error } = await supabase
    .from("jobs")
    .select("id,status,accepted_worker_id")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!job || job.accepted_worker_id !== workerId || job.status !== "confirm_pending") {
    throw new Error("This start time cannot be confirmed from the current job state.");
  }

  const { data, error: rpcError } = await supabase.rpc("confirm_job_start_time", { p_job_id: id });
  if (rpcError) throw rpcError;
  const confirmed = Array.isArray(data) ? data[0] : data;
  if (!confirmed || confirmed.status !== "in_progress") {
    throw new Error("Start time confirmation was not applied. This may be a database/RLS issue.");
  }
  return confirmed;
}

export async function completeJob(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: currentJob, error: currentJobError } = await supabase
    .from("jobs")
    .select("id,poster_id,status")
    .eq("id", id)
    .maybeSingle();

  if (currentJobError) throw currentJobError;
  if (!currentJob) throw new Error("Job not found.");
  if (currentJob.poster_id !== user.id) {
    throw new Error("Completing a job as the worker needs a Phase 2 database/RLS helper. Ask the poster to complete it for now.");
  }
  if (currentJob.status !== "in_progress") {
    throw new Error("This job can only be completed once it is in progress.");
  }

  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "completed" })
    .eq("id", id)
    .eq("poster_id", user.id)
    .eq("status", "in_progress")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No job was completed. This may be a database/RLS issue.");
  return data;
}

export async function getMyPostedJobs(): Promise<Job[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("poster_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function clearOldPostedJobs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("jobs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("poster_id", user.id)
    .is("deleted_at", null)
    .in("status", ["completed", "cancelled"])
    .select("id");

  if (error) throw error;
  const count = data?.length ?? 0;
  return count;
}
