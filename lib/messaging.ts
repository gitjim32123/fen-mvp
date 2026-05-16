import { supabase } from "./supabase";
import type { Conversation, Message } from "./types";
import { getProfileDisplayNames } from "./profiles";

const ACTIVE_CHAT_STATUSES = new Set(["held", "confirm_pending", "in_progress"]);

export type ConversationLifecycle = {
  isParticipant: boolean;
  isActive: boolean;
  isHistorical: boolean;
  reason: string;
  label: string;
};

export function getConversationLifecycle(conversation: Conversation | null | undefined, currentUserId?: string | null): ConversationLifecycle {
  if (!conversation) {
    return {
      isParticipant: false,
      isActive: false,
      isHistorical: true,
      reason: "Conversation not found.",
      label: "Unavailable",
    };
  }

  const status = conversation.job?.status;
  const acceptedWorkerId = conversation.job?.accepted_worker_id;
  const isParticipant = !!currentUserId && (conversation.poster_id === currentUserId || conversation.worker_id === currentUserId);

  if (!isParticipant) {
    return {
      isParticipant,
      isActive: false,
      isHistorical: true,
      reason: "This conversation is only available to its job poster and selected helper.",
      label: "Private",
    };
  }
  if (conversation.is_archived) {
    return {
      isParticipant,
      isActive: false,
      isHistorical: true,
      reason: "This conversation has been archived and is read-only.",
      label: "Archived",
    };
  }
  if (status === "completed") {
    return {
      isParticipant,
      isActive: false,
      isHistorical: true,
      reason: "This job is completed. This conversation is kept for your records.",
      label: "Completed - read only",
    };
  }
  if (status === "cancelled") {
    return {
      isParticipant,
      isActive: false,
      isHistorical: true,
      reason: "This job was cancelled. Any new arrangement requires a new agreement.",
      label: "Cancelled - read only",
    };
  }
  if (!status || !ACTIVE_CHAT_STATUSES.has(status)) {
    return {
      isParticipant,
      isActive: false,
      isHistorical: true,
      reason: "This conversation is historical because the job is not currently assigned.",
      label: "Historical - read only",
    };
  }
  if (!acceptedWorkerId || acceptedWorkerId !== conversation.worker_id) {
    return {
      isParticipant,
      isActive: false,
      isHistorical: true,
      reason: "This conversation is historical because this helper is no longer selected for the job.",
      label: "Historical - read only",
    };
  }

  return {
    isParticipant,
    isActive: true,
    isHistorical: false,
    reason: "Conversation active.",
    label: "Active",
  };
}

async function fillConversationDisplayNames<T extends Conversation & { poster?: { display_name?: string } | null; worker?: { display_name?: string } | null }>(rows: T[]): Promise<T[]> {
  const missingIds = rows.flatMap((conversation) => {
    const ids: string[] = [];
    if (!conversation.poster?.display_name) ids.push(conversation.poster_id);
    if (!conversation.worker?.display_name) ids.push(conversation.worker_id);
    return ids;
  });
  if (missingIds.length === 0) return rows;

  const displayNames = await getProfileDisplayNames(missingIds);
  return rows.map((conversation) => ({
    ...conversation,
    poster: {
      ...(conversation.poster ?? {}),
      display_name: conversation.poster?.display_name || displayNames[conversation.poster_id] || "Poster",
    },
    worker: {
      ...(conversation.worker ?? {}),
      display_name: conversation.worker?.display_name || displayNames[conversation.worker_id] || "Worker",
    },
  }));
}

export async function getConversations(): Promise<Conversation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("conversations")
    .select("*, job:jobs(title,status,accepted_worker_id), poster:profiles!poster_id(display_name), worker:profiles!worker_id(display_name)")
    .or(`poster_id.eq.${user.id},worker_id.eq.${user.id}`)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return fillConversationDisplayNames((data ?? []) as any);
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
    .select("*, job:jobs(title,status,accepted_worker_id), poster:profiles!poster_id(display_name), worker:profiles!worker_id(display_name)")
    .eq("id", conversationId)
    .single();

  if (error) throw error;
  const [filled] = await fillConversationDisplayNames([data as any]);
  return filled;
}

export async function sendMessage(conversationId: string, jobId: string, body: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const conversation = await getConversation(conversationId);
  const resolvedJobId = jobId || conversation.job_id;
  const lifecycle = getConversationLifecycle(conversation, user.id);
  if (!lifecycle.isActive) {
    throw new Error(lifecycle.reason);
  }

  const { data, error } = await supabase
    .from("messages")
    .insert([{ conversation_id: conversationId, job_id: resolvedJobId, sender_id: user.id, body }])
    .select()
    .single();

  if (error) throw error;
  const { error: activityError } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .or(`poster_id.eq.${user.id},worker_id.eq.${user.id}`);
  if (activityError) {
    return { ...data, activity_warning: activityError.message };
  }
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

export async function archiveInactiveConversations() {
  const { data, error } = await supabase.rpc("archive_inactive_conversations");
  if (error) throw error;
  return Number(data ?? 0);
}
