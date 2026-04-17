import { supabase } from "./supabase";

export const REPORT_REASONS = [
  "Business advertising",
  "Spam / repeated posts",
  "Misleading or false information",
  "Inappropriate content",
  "Other",
];

export async function submitReport({
  jobId,
  reporterId,
  reason,
  details,
}: {
  jobId: string;
  reporterId: string;
  reason: string;
  details?: string;
}) {
  const { error } = await supabase
    .from("reports")
    .insert([{ job_id: jobId, reporter_id: reporterId, reason, details: details || null }]);

  if (error) throw error;
}

export async function hasReported(jobId: string, reporterId: string): Promise<boolean> {
  const { data } = await supabase
    .from("reports")
    .select("id")
    .eq("job_id", jobId)
    .eq("reporter_id", reporterId)
    .maybeSingle();

  return !!data;
}

export async function getReportCount(jobId: string): Promise<number> {
  const { count } = await supabase
    .from("reports")
    .select("id", { count: "exact" })
    .eq("job_id", jobId);

  return count ?? 0;
}
