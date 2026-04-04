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
