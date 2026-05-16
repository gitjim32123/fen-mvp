import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { cancelJob, clearOldPostedJobs, completeJob, getMyPostedJobs, leaveAcceptedJob, removeJob } from "../../lib/jobs";
import { getApplicationCountsForJobs, getMyApplications, withdrawApplication } from "../../lib/applications";
import { createOrOpenConversation } from "../../lib/messaging";
import { supabase } from "../../lib/supabase";
import type { Job, Application } from "../../lib/types";
import StatusChip from "../../components/jobs/StatusChip";
import { SignInRequired } from "../../components/ui/Premium";
import { confirmAction } from "../../lib/confirmAction";

function toStatusLabel(status: Job["status"] | Application["status"]) {
  switch (status) {
    case "open": return "Open";
    case "held": return "Held";
    case "confirm_pending": return "Confirm pending";
    case "in_progress": return "In progress";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    case "applied": return "Applied";
    case "rejected": return "Rejected";
    case "selected": return "Selected";
    case "withdrawn": return "Withdrawn";
    default: return "Open";
  }
}

function JobRow({
  title,
  budget,
  status,
  jobId,
  isPosted,
  applicants = 0,
  rawStatus,
  busy,
  onCancel,
  onRemove,
  onWithdraw,
  onLeave,
  onOpenChat,
  onComplete,
}: {
  title: string;
  budget: string;
  status: string;
  jobId: string;
  isPosted: boolean;
  applicants?: number;
  rawStatus?: string;
  busy?: boolean;
  onCancel?: () => void;
  onRemove?: () => void;
  onWithdraw?: () => void;
  onLeave?: () => void;
  onOpenChat?: () => void;
  onComplete?: () => void;
}) {
  const canCancel = isPosted && ["open", "held", "confirm_pending", "in_progress"].includes(rawStatus || "");
  const canRemove = isPosted && ["open", "cancelled", "completed"].includes(rawStatus || "");
  return (
    <View style={styles.card}>
      <View style={styles.rowTop}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBudget}>{budget}</Text>
      </View>
      <StatusChip label={status as any} />
      {isPosted ? <Text style={styles.applicantText}>{applicants} applicant{applicants === 1 ? "" : "s"}</Text> : null}
      <Text style={styles.statusHelp}>{status === "Open" ? "Open jobs can be edited or cancelled before a helper is selected." : "Open the job for next safe action."}</Text>
      <Pressable style={styles.actionButton} onPress={() => router.push(`/app/job/${jobId}`)}>
        <Text style={styles.actionButtonText}>{isPosted ? "Manage job" : "View details"}</Text>
      </Pressable>
      {onOpenChat ? (
        <Pressable style={styles.actionButton} onPress={onOpenChat} disabled={busy}>
          <Text style={styles.actionButtonText}>{busy ? "Opening..." : "Open chat"}</Text>
        </Pressable>
      ) : null}
      {onComplete ? (
        <Pressable style={styles.actionButton} onPress={onComplete} disabled={busy}>
          <Text style={styles.actionButtonText}>{busy ? "Processing..." : "Complete job"}</Text>
        </Pressable>
      ) : null}
      {canCancel ? (
        <Pressable style={styles.cancelButton} onPress={onCancel} disabled={busy}>
          <Text style={styles.cancelButtonText}>{busy ? "Processing..." : "Cancel job"}</Text>
        </Pressable>
      ) : null}
      {canRemove ? (
        <Pressable style={styles.removeButton} onPress={onRemove} disabled={busy}>
          <Text style={styles.removeButtonText}>{busy ? "Processing..." : "Remove from list"}</Text>
        </Pressable>
      ) : null}
      {onWithdraw ? (
        <Pressable style={styles.removeButton} onPress={onWithdraw} disabled={busy}>
          <Text style={styles.removeButtonText}>{busy ? "Processing..." : "Withdraw application"}</Text>
        </Pressable>
      ) : null}
      {onLeave ? (
        <Pressable style={styles.cancelButton} onPress={onLeave} disabled={busy}>
          <Text style={styles.cancelButtonText}>{busy ? "Processing..." : "Leave job"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function MyJobsScreen() {
  const [postedJobs, setPostedJobs] = useState<Job[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [applicationCounts, setApplicationCounts] = useState<Record<string, number>>({});
  const [clearingOld, setClearingOld] = useState(false);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const activePostedJobs = postedJobs.filter((job) => !["completed", "cancelled"].includes(job.status));
  const appliedActiveJobs = appliedJobs.filter((app) => app.status === "applied" && !["completed", "cancelled"].includes((app as any).job?.status));
  const selectedActiveJobs = appliedJobs.filter((app) => {
    const job = (app as any).job;
    return job?.accepted_worker_id === currentUserId && !["completed", "cancelled"].includes(job?.status);
  });
  const oldPostedJobs = postedJobs.filter((job) => ["completed", "cancelled"].includes(job.status));
  const oldAppliedJobs = appliedJobs.filter((app) => {
    const job = (app as any).job;
    return ["completed", "cancelled"].includes(job?.status) || ["withdrawn", "rejected"].includes(app.status);
  });

  const loadJobs = useCallback(async (active = true, showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      setErrorText(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setCurrentUserId(null);
        setPostedJobs([]);
        setAppliedJobs([]);
        setApplicationCounts({});
        return;
      }
      setCurrentUserId(user.id);
      const [posted, applied] = await Promise.all([
        getMyPostedJobs(),
        getMyApplications(),
      ]);
      if (!active) return;
      const counts = await getApplicationCountsForJobs(posted.map((job) => job.id)).catch(() => ({}));
      if (!active) return;
      setPostedJobs(posted);
      setAppliedJobs(applied);
      setApplicationCounts(counts);
    } catch (err: any) {
      if (!active) return;
      setErrorText(err?.message || "Could not load your jobs.");
    } finally {
      if (active) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadJobs(active);
    return () => { active = false; };
  }, [loadJobs]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadJobs(active, false);
      return () => { active = false; };
    }, [loadJobs])
  );

  function handleClearOldJobs() {
    confirmAction({
      title: "Clear old posted jobs?",
      message: "Only completed and cancelled posted jobs will be hidden. Active jobs will stay visible.",
      confirmText: "Clear",
      onConfirm: async () => {
        try {
          setClearingOld(true);
          const cleared = await clearOldPostedJobs();
          await loadJobs(true, false);
          if (cleared === 0) {
            setActionMessage({ type: "error", text: "No old posted jobs to clear." });
            Alert.alert("No old posted jobs to clear", "No old posted jobs to clear.");
            return;
          }
          const message = cleared === 1 ? "1 old posted job cleared" : `${cleared} old posted jobs cleared`;
          setActionMessage({ type: "success", text: message });
          Alert.alert("Old posted jobs cleared", message);
        } catch (err: any) {
          console.log("Could not clear old posted jobs", err);
          const message = err?.message || "Something went wrong.";
          setActionMessage({ type: "error", text: message });
          Alert.alert("Could not clear old posted jobs", message);
        } finally {
          setClearingOld(false);
        }
      },
    });
  }

  function handleCancelPostedJob(job: Job) {
    confirmAction({
      title: "Cancel this job?",
      message: "This marks the job cancelled and closes applications. You can reopen it from the job detail page.",
      confirmText: "Cancel job",
      cancelText: "Keep job",
      destructive: true,
      onConfirm: async () => {
        try {
          setBusyJobId(job.id);
          await cancelJob(job.id, "Cancelled by poster");
          await loadJobs(true, false);
          setActionMessage({ type: "success", text: "Job cancelled." });
          Alert.alert("Job cancelled", "This job is now cancelled.");
        } catch (err: any) {
          console.log("Could not cancel job from My Jobs", err);
          const message = err?.message || "Something went wrong.";
          setActionMessage({ type: "error", text: message });
          Alert.alert("Could not cancel job", message);
        } finally {
          setBusyJobId(null);
        }
      },
    });
  }

  function handleRemovePostedJob(job: Job) {
    confirmAction({
      title: "Remove this job?",
      message: "Only open, completed, or cancelled jobs can be removed from your list. Active selected jobs should be cancelled first.",
      confirmText: "Remove",
      cancelText: "Keep job",
      destructive: true,
      onConfirm: async () => {
        try {
          setBusyJobId(job.id);
          await removeJob(job.id);
          await loadJobs(true, false);
          setActionMessage({ type: "success", text: "Job removed from your list." });
          Alert.alert("Job removed", "This job has been hidden from your list.");
        } catch (err: any) {
          console.log("Could not remove job from My Jobs", err);
          const message = err?.message || "Something went wrong.";
          setActionMessage({ type: "error", text: message });
          Alert.alert("Could not remove job", message);
        } finally {
          setBusyJobId(null);
        }
      },
    });
  }

  function handleWithdrawApplication(app: Application) {
    confirmAction({
      title: "Withdraw application?",
      message: "This cancels your active application for this job.",
      confirmText: "Withdraw",
      cancelText: "Keep application",
      onConfirm: async () => {
        try {
          setBusyJobId(app.job_id);
          await withdrawApplication(app.job_id);
          await loadJobs(true, false);
          setActionMessage({ type: "success", text: "Application withdrawn." });
          Alert.alert("Application withdrawn", "Your application has been cancelled.");
        } catch (err: any) {
          const message = err?.message || "Something went wrong.";
          setActionMessage({ type: "error", text: message });
          Alert.alert("Could not withdraw", message);
        } finally {
          setBusyJobId(null);
        }
      },
    });
  }

  function handleLeaveSelectedJob(app: Application) {
    if (!currentUserId) {
      setActionMessage({ type: "error", text: "You need to be signed in to leave this job." });
      return;
    }
    confirmAction({
      title: "Leave this job?",
      message: "Leaving before completion returns the job to open.",
      confirmText: "Leave",
      cancelText: "Stay",
      destructive: true,
      onConfirm: async () => {
        try {
          setBusyJobId(app.job_id);
          await leaveAcceptedJob(app.job_id, currentUserId);
          await loadJobs(true, false);
          setActionMessage({ type: "success", text: "You left the job and it has been reopened." });
          Alert.alert("Left job", "The job has been reopened.");
        } catch (err: any) {
          const message = err?.message || "Something went wrong.";
          setActionMessage({ type: "error", text: message });
          Alert.alert("Could not leave", message);
        } finally {
          setBusyJobId(null);
        }
      },
    });
  }

  async function handleOpenChat(app: Application) {
    const job = (app as any).job;
    if (!currentUserId || !job?.id || !job?.poster_id || !job?.accepted_worker_id) {
      setActionMessage({ type: "error", text: "Could not open chat because this selected job is missing conversation details." });
      return;
    }
    try {
      setBusyJobId(app.job_id);
      const conversation = await createOrOpenConversation(job.id, job.poster_id, job.accepted_worker_id);
      router.push(`/app/messages/${conversation.id}`);
    } catch (err: any) {
      const message = err?.message || "Could not open chat.";
      setActionMessage({ type: "error", text: message });
      Alert.alert("Could not open chat", message);
    } finally {
      setBusyJobId(null);
    }
  }

  async function handleOpenPostedChat(job: Job) {
    if (!job.id || !job.poster_id || !job.accepted_worker_id) {
      setActionMessage({ type: "error", text: "Could not open chat because this job has no selected worker." });
      return;
    }
    try {
      setBusyJobId(job.id);
      const conversation = await createOrOpenConversation(job.id, job.poster_id, job.accepted_worker_id);
      router.push(`/app/messages/${conversation.id}`);
    } catch (err: any) {
      const message = err?.message || "Could not open chat.";
      setActionMessage({ type: "error", text: message });
      Alert.alert("Could not open chat", message);
    } finally {
      setBusyJobId(null);
    }
  }

  function handleCompleteActiveJob(job: Job) {
    confirmAction({
      title: "Complete this job?",
      message: "This marks the job completed and moves it out of active jobs.",
      confirmText: "Complete",
      cancelText: "Keep active",
      onConfirm: async () => {
        try {
          setBusyJobId(job.id);
          await completeJob(job.id);
          await loadJobs(true, false);
          setActionMessage({ type: "success", text: "Job completed." });
          Alert.alert("Job completed", "This job has moved to completed/cancelled history.");
        } catch (err: any) {
          const message = err?.message || "Could not complete this job.";
          setActionMessage({ type: "error", text: message });
          Alert.alert("Could not complete job", message);
        } finally {
          setBusyJobId(null);
        }
      },
    });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B56CFF" />
        <Text style={styles.loadingText}>Loading your jobs…</Text>
      </View>
    );
  }

  if (!currentUserId) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <SignInRequired title="Sign in to view your jobs" text="My Jobs shows jobs you posted, applied for, and selected work. Sign in to see your dashboard." />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My Jobs</Text>
      <Text style={styles.subtitle}>Track posted jobs and jobs you have applied for with clear status labels.</Text>
      <Pressable style={styles.clearButton} onPress={handleClearOldJobs} disabled={clearingOld}>
        <Text style={styles.clearButtonText}>{clearingOld ? "Clearing..." : "Clear old posted jobs"}</Text>
      </Pressable>
      <Pressable style={styles.clearButton} onPress={() => loadJobs(true, false)} disabled={!!busyJobId || clearingOld}>
        <Text style={styles.clearButtonText}>Refresh jobs</Text>
      </Pressable>

      {errorText ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : null}

      {actionMessage ? (
        <View style={actionMessage.type === "success" ? styles.successBox : styles.errorBox}>
          <Text style={actionMessage.type === "success" ? styles.successText : styles.errorText}>{actionMessage.text}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Posted by me</Text>
      <View style={styles.group}>
        {activePostedJobs.length === 0 ? (
          <Text style={styles.emptyText}>No posted jobs yet.</Text>
        ) : (
          activePostedJobs.map((job) => (
            <JobRow
              key={job.id}
              title={job.title}
              budget={`£${job.budget_gbp}`}
              status={toStatusLabel(job.status)}
              jobId={job.id}
              isPosted
              applicants={applicationCounts[job.id] || 0}
              rawStatus={job.status}
              busy={busyJobId === job.id}
              onCancel={() => handleCancelPostedJob(job)}
              onRemove={() => handleRemovePostedJob(job)}
              onOpenChat={job.accepted_worker_id ? () => handleOpenPostedChat(job) : undefined}
              onComplete={job.status === "in_progress" ? () => handleCompleteActiveJob(job) : undefined}
            />
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Applied for</Text>
      <View style={styles.group}>
        {appliedActiveJobs.length === 0 ? (
          <Text style={styles.emptyText}>No applications yet.</Text>
        ) : (
          appliedActiveJobs.map((app) => {
            const job = (app as any).job;
            return (
              <JobRow
                key={app.id}
                title={job?.title || "Unknown job"}
                budget={job?.budget_gbp ? `£${job.budget_gbp}` : "—"}
                status={toStatusLabel(app.status)}
                jobId={app.job_id}
                isPosted={false}
                busy={busyJobId === app.job_id}
                onWithdraw={() => handleWithdrawApplication(app)}
              />
            );
          })
        )}
      </View>

      <Text style={styles.sectionTitle}>Selected / active</Text>
      <View style={styles.group}>
        {selectedActiveJobs.length === 0 ? (
          <Text style={styles.emptyText}>No selected jobs yet.</Text>
        ) : (
          selectedActiveJobs.map((app) => {
            const job = (app as any).job;
            return (
              <JobRow
                key={`selected-${app.id}`}
                title={job?.title || "Unknown job"}
                budget={job?.budget_gbp ? `£${job.budget_gbp}` : "—"}
                status={toStatusLabel(job?.status || app.status)}
                jobId={app.job_id}
                isPosted={false}
                busy={busyJobId === app.job_id}
                onOpenChat={() => handleOpenChat(app)}
                onLeave={job?.status !== "completed" && job?.status !== "cancelled" ? () => handleLeaveSelectedJob(app) : undefined}
              />
            );
          })
        )}
      </View>

      <Text style={styles.sectionTitle}>Completed / cancelled</Text>
      <View style={styles.group}>
        {oldPostedJobs.length === 0 && oldAppliedJobs.length === 0 ? (
          <Text style={styles.emptyText}>No completed or cancelled jobs.</Text>
        ) : (
          <>
            {oldPostedJobs.map((job) => (
              <JobRow
                key={`old-${job.id}`}
                title={job.title}
                budget={`£${job.budget_gbp}`}
                status={toStatusLabel(job.status)}
                jobId={job.id}
                isPosted
                applicants={applicationCounts[job.id] || 0}
                rawStatus={job.status}
                busy={busyJobId === job.id}
                onRemove={() => handleRemovePostedJob(job)}
              />
            ))}
            {oldAppliedJobs.map((app) => {
              const job = (app as any).job;
              return (
                <JobRow
                  key={`old-app-${app.id}`}
                  title={job?.title || "Unknown job"}
                  budget={job?.budget_gbp ? `£${job.budget_gbp}` : "-"}
                  status={toStatusLabel(job?.status || app.status)}
                  jobId={app.job_id}
                  isPosted={false}
                  busy={busyJobId === app.job_id}
                />
              );
            })}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0E0A14",
  },
  content: {
    padding: 20,
    paddingBottom: 110,
    gap: 14,
  },
  title: {
    color: "#E7D9FF",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 8,
  },
  subtitle: {
    color: "#CBB8F1",
    fontSize: 16,
    lineHeight: 23,
  },
  sectionTitle: {
    color: "#E7D9FF",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 8,
  },
  group: {
    gap: 12,
  },
  card: {
    backgroundColor: "#171024",
    borderWidth: 1,
    borderColor: "#231A33",
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    color: "#E7D9FF",
    fontSize: 17,
    fontWeight: "800",
  },
  cardBudget: {
    color: "#B56CFF",
    fontSize: 17,
    fontWeight: "800",
  },
  applicantText: {
    color: "#B56CFF",
    fontSize: 13,
    fontWeight: "800",
  },
  statusHelp: {
    color: "#A590C9",
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    backgroundColor: "#2A1E3D",
    borderColor: "#6E46A3",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },
  actionButtonText: {
    color: "#E7D9FF",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
  },
  cancelButton: {
    backgroundColor: "#2B161B",
    borderColor: "#8E4656",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: "#FFD8DE",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
  },
  removeButton: {
    backgroundColor: "#171024",
    borderColor: "#3A2B52",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },
  removeButtonText: {
    color: "#CBB8F1",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
  },
  clearButton: {
    backgroundColor: "#171024",
    borderColor: "#3A2B52",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  clearButtonText: {
    color: "#CBB8F1",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
  },
  centered: {
    flex: 1,
    backgroundColor: "#0E0A14",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#CBB8F1",
    fontSize: 15,
    marginTop: 12,
  },
  errorBox: {
    backgroundColor: "#2B161B",
    borderColor: "#8E4656",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  errorText: {
    color: "#FFD8DE",
    fontSize: 14,
    lineHeight: 20,
  },
  successBox: {
    backgroundColor: "#102619",
    borderColor: "#2F7A45",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  successText: {
    color: "#C8F7D2",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  emptyText: {
    color: "#CBB8F1",
    fontSize: 14,
    fontStyle: "italic",
  },
});
