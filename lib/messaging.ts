import { supabase } from "./supabase";
import type { Conversation, Message } from "./types";

export async function getConversations(): Promise<Conversation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("conversations")
    .select("*, job:jobs(title,status), poster:profiles!poster_id(display_name), worker:profiles!worker_id(display_name)")
    .or(`poster_id.eq.${user.id},worker_id.eq.${user.id}`)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getConversation(conversationId: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*, job:jobs(title,status), poster:profiles!poster_id(display_name), worker:profiles!worker_id(display_name)")
    .eq("id", conversationId)
    .single();

  if (error) throw error;
  return data;
}

export async function sendMessage(conversationId: string, jobId: string, body: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const conversation = await getConversation(conversationId) as Conversation & { job?: { status?: string } };
  const resolvedJobId = jobId || conversation.job_id;
  const jobStatus = conversation.job?.status;
  if (jobStatus === "cancelled" || jobStatus === "completed") {
    throw new Error("This conversation is read-only because the job is no longer active.");
  }
  if (conversation.is_archived) {
    throw new Error("This conversation has been archived and is read-only.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert([{ conversation_id: conversationId, job_id: resolvedJobId, sender_id: user.id, body }])
    .select()
    .single();

  if (error) throw error;
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .or(`poster_id.eq.${user.id},worker_id.eq.${user.id}`);
  return data;
}

export async function createOrOpenConversation(jobId: string, posterId: string, workerId: string) {
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("*")
    .eq("job_id", jobId)
    .eq("poster_id", posterId)
    .eq("worker_id", workerId)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("conversations")
    .insert([{ job_id: jobId, poster_id: posterId, worker_id: workerId }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export const createConversation = createOrOpenConversation;

export async function archiveConversation(conversationId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("conversations")
    .update({ is_archived: true })
    .eq("id", conversationId)
    .or(`poster_id.eq.${user.id},worker_id.eq.${user.id}`)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No archiveable conversation was found for your account.");
  return data;
}
