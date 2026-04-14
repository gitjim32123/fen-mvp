import { supabase } from "./supabase";
import type { Conversation, Message } from "./types";

export async function getConversations(): Promise<Conversation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("conversations")
    .select("*, job:jobs(title), poster:profiles!poster_id(display_name), worker:profiles!worker_id(display_name)")
    .or(`poster_id.eq.${user.id},worker_id.eq.${user.id}`)
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

export async function sendMessage(conversationId: string, jobId: string, body: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("messages")
    .insert([{ conversation_id: conversationId, job_id: jobId, sender_id: user.id, body }])
    .select()
    .single();

  if (error) throw error;
  return data;
}
