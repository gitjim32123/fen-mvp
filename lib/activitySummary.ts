import { getApplicationCountsForJobs, getMyApplications } from "./applications";
import { getMyPostedJobs } from "./jobs";
import { getConversationLifecycle, getConversations } from "./messaging";
import { supabase } from "./supabase";

export type ActivitySummary = {
  myJobsBadge: number;
  messagesBadge: number;
  pendingApplicants: number;
  workerActions: number;
  recentMessages: number;
};

const EMPTY_SUMMARY: ActivitySummary = {
  myJobsBadge: 0,
  messagesBadge: 0,
  pendingApplicants: 0,
  workerActions: 0,
  recentMessages: 0,
};

const RECENT_MESSAGE_WINDOW_MS = 1000 * 60 * 60 * 24;

export async function getActivitySummary(): Promise<ActivitySummary> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY_SUMMARY;

  const [postedJobs, applications, conversations] = await Promise.all([
    getMyPostedJobs(),
    getMyApplications(),
    getConversations(),
  ]);

  const openPostedJobIds = postedJobs
    .filter((job) => job.status === "open")
    .map((job) => job.id);
  const applicationCounts = await getApplicationCountsForJobs(openPostedJobIds).catch(() => ({}));
  const pendingApplicants = Object.values(applicationCounts).reduce((total, count) => total + count, 0);

  const workerActions = applications.filter((application) => {
    const job = (application as any).job;
    if (!job || job.accepted_worker_id !== user.id) return false;
    return job.status === "held" || job.status === "confirm_pending";
  }).length;

  const recentCutoff = Date.now() - RECENT_MESSAGE_WINDOW_MS;
  const recentMessages = conversations.filter((conversation) => {
    const updatedAt = (conversation as any).updated_at;
    const lifecycle = getConversationLifecycle(conversation, user.id);
    if (!updatedAt || conversation.is_archived) return false;
    if (!lifecycle.isActive) return false;
    return new Date(updatedAt).getTime() >= recentCutoff;
  }).length;

  return {
    myJobsBadge: pendingApplicants + workerActions,
    messagesBadge: recentMessages,
    pendingApplicants,
    workerActions,
    recentMessages,
  };
}
