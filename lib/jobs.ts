import { supabase } from "./supabase";
import type { Job } from "./types";

export type ImageUploadResult = {
  urls: string[];
  failedCount: number;
};

function getStoragePath(userId: string, sessionId: string, index: number): string {
  return `${userId}/${sessionId}/${index}`;
}

export async function uploadJobImages(
  uris: string[],
  sessionId: string,
  userId: string
): Promise<ImageUploadResult> {
  const urls: string[] = [];
  let failedCount = 0;

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    const path = getStoragePath(userId, sessionId, i);

    try {
      const response = await fetch(uri);
      if (!response.ok) {
        failedCount++;
        continue;
      }
      const blob = await response.blob();
      if (blob.size === 0) {
        failedCount++;
        continue;
      }
      const { error: uploadError } = await supabase.storage
        .from("job-images")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });

      if (uploadError) {
        failedCount++;
        continue;
      }
      const { data } = supabase.storage.from("job-images").getPublicUrl(path);
      if (data?.publicUrl) {
        urls.push(data.publicUrl);
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  return { urls, failedCount };
}

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
  urgency: string;
  tools_supplied?: boolean;
  preferred_start_at?: string;
  images?: string[];
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("jobs")
    .insert([{ ...formData, poster_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function cancelJob(id: string, reason: string) {
  const { error } = await supabase
    .from("jobs")
    .update({ status: "cancelled", cancel_reason: reason })
    .eq("id", id);

  if (error) throw error;
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
