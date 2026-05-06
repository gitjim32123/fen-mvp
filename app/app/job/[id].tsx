import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  cancelJob,
  confirmJobStartTime,
  getJob,
  leaveAcceptedJob,
  proposeJobStartTime,
  reopenJob,
} from "../../../lib/jobs";
import {
  applyToJob,
  getApplicationsForJob,
  reopenApplicationsForJob,
  selectWorker,
} from "../../../lib/applications";
import { createOrOpenConversation } from "../../../lib/messaging";
import {
  REPORT_REASONS,
  getReportCount,
  hasReported,
  submitReport,
} from "../../../lib/reports";
import { supabase } from "../../../lib/supabase";
import type { Job } from "../../../lib/types";

function toStatusLabel(status?: string) {
  switch (status) {
    case "open":
      return "Open";
    case "held":
      return "Held";
    case "confirm_pending":
      return "Confirm pending";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Open";
  }
}

function formatBudget(value?: number | string) {
  if (typeof value === "number") return `£${value}`;
  if (typeof value === "string" && value.trim()) return `£${value}`;
  return "Budget not set";
}

function formatAppliedAt(value?: string) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString();
}

function formatStartTime(value?: string) {
  if (!value) return "Not agreed yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getApplyErrorMessage(error: any) {
  const message = String(error?.message || "");
  if (error?.code === "23505" || message.toLowerCase().includes("duplicate")) {
    return "You've already applied for this job.";
  }
  if (message.toLowerCase().includes("limit") || message.toLowerCase().includes("unavailable")) {
    return "This job is no longer available for applications.";
  }
  return message || "Something went wrong.";
}

function getStatusHelp(status?: string) {
  switch (status) {
    case "open":
      return "Open for applications.";
    case "held":
      return "A helper has been selected and messages are open.";
    case "confirm_pending":
      return "A start time has been proposed and is waiting for worker confirmation.";
    case "in_progress":
      return "The agreed work is in progress.";
    case "completed":
      return "This job has been completed.";
    case "cancelled":
      return "This job has been cancelled and applications are closed.";
    default:
      return "Open for applications.";
  }
}

export default function JobDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const jobId = useMemo(() => {
    if (Array.isArray(params.id)) return params.id[0];
    return params.id;
  }, [params.id]);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [reportCount, setReportCount] = useState(0);
  const [reportModalReason, setReportModalReason] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptingWorkerId, setAcceptingWorkerId] = useState<string | null>(null);
  const [showApplications, setShowApplications] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [updatingStartTime, setUpdatingStartTime] = useState(false);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!jobId) {
        setErrorText("Job not found.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorText(null);

        const data = await getJob(jobId);
        if (!active) return;

        setJob(data);
        setStartTime(data.agreed_start_at || data.preferred_start_at || "");

        const { data: { user } } = await supabase.auth.getUser();
        if (active) setCurrentUserId(user?.id ?? null);

        if (user?.id && data.poster_id === user.id) {
          const jobApplications = await getApplicationsForJob(jobId);
          if (active) setApplications(jobApplications);
        }

        const count = await getReportCount(jobId);
        if (active) setReportCount(count);
      } catch (error: any) {
        if (!active) return;
        setErrorText(error?.message || "Could not load this job.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [jobId]);

  const areaText = (job as any)?.postcode_district || job?.postcode || "Area not available";
  const selectedApplication = applications.find((app) => app.worker_id === job?.accepted_worker_id);
  const selectedWorkerName =
    selectedApplication?.worker?.display_name ||
    (currentUserId === job?.accepted_worker_id ? "you" : "Selected helper");
  const isPoster = currentUserId === job?.poster_id;
  const isAcceptedWorker = currentUserId === job?.accepted_worker_id;
  const canManageStartTime =
    isPoster &&
    !!job?.accepted_worker_id &&
    job?.status !== "cancelled" &&
    job?.status !== "completed";
  const canConfirmStartTime =
    isAcceptedWorker &&
    job?.status === "confirm_pending" &&
    !!job?.agreed_start_at;

  async function handleApply() {
    if (!jobId) return;

    try {
      setApplying(true);
      await applyToJob(jobId);
      Alert.alert(
        "Applied!",
        "The poster has been notified. They'll reach out if interested.",
        [{ text: "OK", onPress: () => router.replace("/app/my-jobs") }]
      );
    } catch (err: any) {
      Alert.alert("Could not apply", getApplyErrorMessage(err));
    } finally {
      setApplying(false);
    }
  }

  async function loadApplications() {
    if (!jobId || !currentUserId || job?.poster_id !== currentUserId) return;
    try {
      setApplicationsLoading(true);
      setApplicationsError(null);
      const data = await getApplicationsForJob(jobId);
      setApplications(data);
    } catch (err: any) {
      console.log("Could not load applications", err?.message);
      setApplicationsError(err?.message || "Could not load applications.");
    } finally {
      setApplicationsLoading(false);
    }
  }

  async function handleAcceptWorker(workerId: string, workerName: string) {
    if (!jobId || !currentUserId) return;
    Alert.alert(
      "Accept this applicant?",
      `You are choosing ${workerName || "this person"} for this job. This will let you message each other to arrange the details.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            try {
              setAccepting(true);
              setAcceptingWorkerId(workerId);
              await selectWorker(jobId, workerId);
              const conversation = await createOrOpenConversation(jobId, currentUserId, workerId);
              const data = await getJob(jobId);
              setJob(data);
              setStartTime(data.agreed_start_at || data.preferred_start_at || "");
              await loadApplications();
              setShowApplications(false);
              Alert.alert("Worker accepted!", "You can now message each other to finalise the job.", [
                { text: "Open messages", onPress: () => router.push(`/app/messages/${conversation.id}`) },
              ]);
            } catch (err: any) {
              Alert.alert("Could not accept", err?.message || "Something went wrong.");
            } finally {
              setAccepting(false);
              setAcceptingWorkerId(null);
            }
          },
        },
      ]
    );
  }

  function handleCancelJob() {
    if (!jobId || job?.status === "cancelled") return;
    Alert.alert(
      "Cancel this job?",
      "This will close the job for new applicants. If you've already accepted someone, please message them first.",
      [
        { text: "Keep job", style: "cancel" },
        {
          text: "Cancel job",
          style: "destructive",
          onPress: async () => {
            try {
              setCancelling(true);
              await cancelJob(jobId, "Cancelled by poster");
              const data = await getJob(jobId);
              setJob(data);
              setStartTime(data.agreed_start_at || data.preferred_start_at || "");
              Alert.alert("Job cancelled", "This job is no longer open.");
            } catch (err: any) {
              Alert.alert("Could not cancel", err?.message || "Something went wrong.");
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  }

  function handleLeaveJob() {
    if (!jobId || !currentUserId || job?.accepted_worker_id !== currentUserId) return;
    Alert.alert(
      "Leave this job?",
      "This will remove you from the job. The poster will be notified.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              setCancelling(true);
              await leaveAcceptedJob(jobId, currentUserId);
              await reopenApplicationsForJob(jobId, currentUserId);
              const data = await getJob(jobId);
              setJob(data);
              setStartTime(data.agreed_start_at || data.preferred_start_at || "");
              Alert.alert("Left job", "You have been removed from this job.");
            } catch (err: any) {
              Alert.alert("Could not leave", err?.message || "Something went wrong.");
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  }

  function handleReport() {
    const buttons: { text: string; style?: "cancel" }[] = REPORT_REASONS.map((r) => ({ text: r }));
    buttons.push({ text: "Cancel", style: "cancel" as const });

    Alert.alert(
      "Report this job",
      "Why are you reporting this?",
      buttons.map((b) => ({
        ...b,
        onPress: b.text === "Cancel" ? undefined : () => handleReportReason(b.text),
      }))
    );
  }

  function handleReopenJob() {
    if (!jobId || currentUserId !== job?.poster_id) return;
    const isHeldReopen = job?.status === "held";
    if (job?.status !== "cancelled" && !isHeldReopen) return;
    Alert.alert(
      isHeldReopen ? "Reopen applications?" : "Reopen this job?",
      "This will make the job visible to applicants again and clear any accepted worker.",
      [
        { text: isHeldReopen ? "Keep selected" : "Keep cancelled", style: "cancel" },
        {
          text: "Reopen",
          onPress: async () => {
            try {
              setCancelling(true);
              await reopenJob(jobId);
              await reopenApplicationsForJob(jobId);
              const data = await getJob(jobId);
              setJob(data);
              setStartTime(data.agreed_start_at || data.preferred_start_at || "");
              await loadApplications();
              Alert.alert("Job reopened", "This job is open for applications again.");
            } catch (err: any) {
              Alert.alert("Could not reopen", err?.message || "Something went wrong.");
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  }

  async function handleProposeStartTime() {
    if (!jobId || !canManageStartTime || !startTime.trim()) return;
    try {
      setUpdatingStartTime(true);
      await proposeJobStartTime(jobId, startTime.trim());
      const data = await getJob(jobId);
      setJob(data);
      setStartTime(data.agreed_start_at || "");
      Alert.alert("Start time proposed", "The worker can now confirm the start time.");
    } catch (err: any) {
      Alert.alert("Could not update start time", err?.message || "Something went wrong.");
    } finally {
      setUpdatingStartTime(false);
    }
  }

  async function handleConfirmStartTime() {
    if (!jobId || !currentUserId || !canConfirmStartTime) return;
    try {
      setUpdatingStartTime(true);
      await confirmJobStartTime(jobId, currentUserId);
      const data = await getJob(jobId);
      setJob(data);
      setStartTime(data.agreed_start_at || "");
      Alert.alert("Start time confirmed", "This job is now marked as in progress.");
    } catch (err: any) {
      Alert.alert("Could not confirm start time", err?.message || "Something went wrong.");
    } finally {
      setUpdatingStartTime(false);
    }
  }

  async function handleOpenConversation(workerId?: string) {
    if (!jobId || !job?.poster_id || !workerId) return;
    try {
      const conversation = await createOrOpenConversation(jobId, job.poster_id, workerId);
      router.push(`/app/messages/${conversation.id}`);
    } catch (err: any) {
      Alert.alert("Could not open messages", err?.message || "Something went wrong.");
    }
  }

  function handleReportReason(reason: string) {
    setReportModalReason(reason);
    setReportDetails("");
  }

  async function submitJobReport() {
    if (!jobId || !reportModalReason) return;

    try {
      setSubmittingReport(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Sign in required", "You must be signed in to report a job.");
        return;
      }

      const alreadyReported = await hasReported(jobId, user.id);
      if (alreadyReported) {
        Alert.alert("Already reported", "You've already reported this job.");
        return;
      }

      await submitReport({
        jobId,
        reporterId: user.id,
        reason: reportModalReason,
        details: reportDetails.trim() || undefined,
      });

      setReportCount((c) => c + 1);
      setReportModalReason(null);
      Alert.alert("Thanks", "This has been reported and will be reviewed.");
    } catch (err: any) {
      if (err?.message?.includes("duplicate") || err?.code === "23505") {
        Alert.alert("Already reported", "You've already reported this job.");
      } else {
        Alert.alert("Could not submit report", err?.message || "Something went wrong.");
      }
    } finally {
      setSubmittingReport(false);
    }
  }

  function handleImageError(index: number) {
    setImageErrors((prev) => ({ ...prev, [index]: true }));
  }

  if (loading) {
    return (
      <>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#B56CFF" />
          <Text style={styles.loadingText}>Loading job…</Text>
        </View>
      </>
    );
  }

  if (errorText || !job) {
    return (
      <>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not open this job</Text>
          <Text style={styles.errorText}>{errorText || "This job is not available."}</Text>
          <Pressable style={styles.btn} onPress={() => router.back()}>
            <Text style={styles.btnText}>Go back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const images: string[] = (job as any)?.images || [];
  const validImages = images.filter((uri, i) => !!uri && !imageErrors[i]);

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>

        {validImages.length > 0 &&
          (validImages.length === 1 ? (
            <Image
              source={{ uri: validImages[0] }}
              style={styles.detailImage}
              resizeMode="cover"
              onError={() => handleImageError(images.indexOf(validImages[0]))}
            />
          ) : (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.imageScroll}
            >
              {validImages.map((uri, i) => (
                <Image
                  key={`${uri}-${i}`}
                  source={{ uri }}
                  style={styles.detailImage}
                  resizeMode="cover"
                  onError={() => handleImageError(images.indexOf(uri))}
                />
              ))}
            </ScrollView>
          ))}

        <View style={styles.heroCard}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{job.title}</Text>
            <Text style={styles.budget}>{formatBudget((job as any)?.budget_gbp)}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{toStatusLabel((job as any)?.status)}</Text>
          </View>
          <Text style={styles.statusHelp}>{getStatusHelp((job as any)?.status)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Job details</Text>
          <Text style={styles.bodyText}>{job.description}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>At a glance</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Urgency</Text>
            <Text style={styles.detailValue}>{(job as any)?.urgency || "Not set"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Area</Text>
            <Text style={styles.detailValue}>{areaText}</Text>
          </View>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Privacy</Text>
          <Text style={styles.noticeText}>
            Exact address details are not shown here. Only safe area info is visible until
            someone is chosen.
          </Text>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Safety &amp; platform notice</Text>
          <Text style={styles.noticeText}>
            FEN connects people — it does not provide, guarantee, or supervise the work. You
            are responsible for your own safety and any arrangements you make. FEN does not
            process payments in MVP; any money is agreed directly between users. FEN is not
            liable for disputes, losses, or cancellations between users.
          </Text>
        </View>

        {reportCount >= 3 && (
          <View style={styles.flaggedBanner}>
            <Text style={styles.flaggedText}>This job has been flagged for review</Text>
          </View>
        )}

        {(job as any)?.status === "cancelled" && (
          <View style={styles.cancelledCard}>
            <Text style={styles.cancelledTitle}>Job cancelled</Text>
            <Text style={styles.cancelledText}>
              {job.cancel_reason || "This job is no longer open for applications or arrangements."}
            </Text>
          </View>
        )}

        {isPoster && job.accepted_worker_id && (
          <View style={styles.acceptedCard}>
            <Text style={styles.acceptedTitle}>Selected helper: {selectedWorkerName}</Text>
            <Text style={styles.acceptedText}>{getStatusHelp((job as any)?.status)}</Text>
            <Pressable style={styles.btn} onPress={() => handleOpenConversation(job.accepted_worker_id)}>
              <Text style={styles.btnText}>Open Messages</Text>
            </Pressable>
          </View>
        )}

        {(isPoster || isAcceptedWorker) && job.accepted_worker_id && (job as any)?.status !== "cancelled" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Start time</Text>
            <Text style={styles.bodyText}>
              {job.status === "confirm_pending"
                ? `Pending confirmation: ${formatStartTime(job.agreed_start_at)}`
                : job.status === "in_progress"
                  ? `Confirmed: ${formatStartTime(job.agreed_start_at)}`
                  : `Current plan: ${formatStartTime(job.agreed_start_at || job.preferred_start_at)}`}
            </Text>

            {canManageStartTime && (
              <>
                <TextInput
                  style={styles.startInput}
                  placeholder="e.g. Today 6pm or 2026-05-07 18:00"
                  placeholderTextColor="#8D79AF"
                  value={startTime}
                  onChangeText={setStartTime}
                  editable={!updatingStartTime}
                />
                <Pressable
                  style={[styles.secondaryButton, (!startTime.trim() || updatingStartTime) && styles.secondaryButtonDisabled]}
                  onPress={handleProposeStartTime}
                  disabled={!startTime.trim() || updatingStartTime}
                >
                  {updatingStartTime ? (
                    <ActivityIndicator size="small" color="#E7D9FF" />
                  ) : (
                    <Text style={styles.secondaryButtonText}>Propose start time</Text>
                  )}
                </Pressable>
              </>
            )}

            {canConfirmStartTime && (
              <Pressable
                style={[styles.btn, updatingStartTime && styles.btnDisabled]}
                onPress={handleConfirmStartTime}
                disabled={updatingStartTime}
              >
                {updatingStartTime ? (
                  <ActivityIndicator size="small" color="#140E1D" />
                ) : (
                  <Text style={styles.btnText}>Confirm start time</Text>
                )}
              </Pressable>
            )}
          </View>
        )}

        {isPoster && (
          <Pressable
            style={styles.btn}
            onPress={() => {
              loadApplications();
              setShowApplications(true);
            }}
          >
            <Text style={styles.btnText}>View applications ({applications.length})</Text>
          </Pressable>
        )}

        {isAcceptedWorker && (
          <View style={styles.acceptedCard}>
            <Text style={styles.acceptedTitle}>You are the accepted helper</Text>
            <Text style={styles.acceptedText}>{getStatusHelp((job as any)?.status)}</Text>
            <Pressable style={styles.btn} onPress={() => handleOpenConversation(currentUserId)}>
              <Text style={styles.btnText}>Open Messages</Text>
            </Pressable>
          </View>
        )}

        {!isPoster && !isAcceptedWorker && (
          <Pressable
            style={[styles.btn, ((job as any)?.status !== "open" || applying) && styles.btnDisabled]}
            disabled={(job as any)?.status !== "open" || applying}
            onPress={handleApply}
          >
            {applying ? (
              <ActivityIndicator size="small" color="#140E1D" />
            ) : (
              <Text style={styles.btnText}>
                {(job as any)?.status === "open" ? "Apply for this job" : "Applications closed"}
              </Text>
            )}
          </Pressable>
        )}

        {isPoster && (job as any)?.status === "cancelled" && (
          <Pressable style={styles.btn} onPress={handleReopenJob} disabled={cancelling}>
            <Text style={styles.btnText}>{cancelling ? "Processing..." : "Reopen job"}</Text>
          </Pressable>
        )}

        {isPoster && (job as any)?.status === "held" && (
          <Pressable style={styles.secondaryButton} onPress={handleReopenJob} disabled={cancelling}>
            <Text style={styles.secondaryButtonText}>{cancelling ? "Processing..." : "Reopen applications"}</Text>
          </Pressable>
        )}

        {(isPoster || isAcceptedWorker) && (job as any)?.status !== "cancelled" && (
          <Pressable style={styles.cancelButton} onPress={isPoster ? handleCancelJob : handleLeaveJob} disabled={cancelling}>
            <Text style={styles.cancelButtonText}>{cancelling ? "Processing..." : isPoster ? "Cancel job" : "Leave job"}</Text>
          </Pressable>
        )}

        <Pressable style={styles.reportBtn} onPress={handleReport}>
          <Text style={styles.reportBtnText}>Report this job</Text>
        </Pressable>
      </ScrollView>

      {showApplications && (
        <Modal
          transparent
          visible
          animationType="fade"
          onRequestClose={() => setShowApplications(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Applications</Text>

              {applicationsLoading ? (
                <ActivityIndicator size="small" color="#B56CFF" />
              ) : applicationsError ? (
                <Text style={styles.errorText}>{applicationsError}</Text>
              ) : applications.length === 0 ? (
                <Text style={styles.emptyText}>No applications yet.</Text>
              ) : (
                <ScrollView style={styles.applicationsList}>
                  {applications.map((application) => {
                    const workerName = application.worker?.display_name || "Applicant";
                    const isSelected = application.status === "selected" || application.worker_id === job.accepted_worker_id;
                    const isAcceptingThisWorker = acceptingWorkerId === application.worker_id;
                    return (
                      <View key={application.id} style={styles.applicationCard}>
                        <View style={styles.applicationHeader}>
                          <View>
                            <Text style={styles.applicationName}>{workerName}</Text>
                            <Text style={styles.applicationMeta}>
                              {formatAppliedAt(application.created_at)}
                              {application.worker?.completed_jobs_count != null
                                ? ` - ${application.worker.completed_jobs_count} completed`
                                : ""}
                            </Text>
                          </View>
                          {isSelected ? <Text style={styles.alreadySelected}>Selected</Text> : null}
                        </View>

                        {application.message ? (
                          <Text style={styles.applicationMessage}>{application.message}</Text>
                        ) : null}

                        {isSelected ? (
                          <Pressable style={styles.acceptButton} onPress={() => handleOpenConversation(application.worker_id)}>
                            <Text style={styles.acceptButtonText}>Open Messages</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={[styles.acceptButton, accepting && styles.btnDisabled]}
                            onPress={() => handleAcceptWorker(application.worker_id, workerName)}
                            disabled={accepting || (job as any)?.status === "cancelled"}
                          >
                            {isAcceptingThisWorker ? (
                              <ActivityIndicator size="small" color="#140E1D" />
                            ) : (
                              <Text style={styles.acceptButtonText}>
                                {(job as any)?.status === "cancelled" ? "Job cancelled" : "Accept"}
                              </Text>
                            )}
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}

              <Pressable style={styles.modalCancel} onPress={() => setShowApplications(false)}>
                <Text style={styles.modalCancelText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {reportModalReason && (
        <Modal
          transparent
          visible
          animationType="fade"
          onRequestClose={() => setReportModalReason(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Report: {reportModalReason}</Text>

              <Text style={styles.modalLabel}>Extra details (optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Add any extra information…"
                placeholderTextColor="#8D79AF"
                multiline
                textAlignVertical="top"
                value={reportDetails}
                onChangeText={setReportDetails}
                editable={!submittingReport}
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalCancel}
                  onPress={() => setReportModalReason(null)}
                  disabled={submittingReport}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[styles.modalSubmit, submittingReport && styles.modalSubmitDisabled]}
                  onPress={submitJobReport}
                  disabled={submittingReport}
                >
                  {submittingReport ? (
                    <ActivityIndicator size="small" color="#140E1D" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Submit report</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0E0A14",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: "#0E0A14",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: "#CBB8F1",
    marginTop: 12,
    fontSize: 15,
  },
  errorTitle: {
    color: "#E7D9FF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    color: "#CBB8F1",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  backBtn: {
    marginBottom: 16,
  },
  backBtnText: {
    color: "#B56CFF",
    fontSize: 15,
    fontWeight: "700",
  },
  imageScroll: {
    marginBottom: 12,
  },
  detailImage: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 16,
    backgroundColor: "#1A1025",
    marginRight: 10,
  },
  heroCard: {
    backgroundColor: "#171024",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#231A33",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  title: {
    color: "#E7D9FF",
    fontSize: 20,
    fontWeight: "800",
    flex: 1,
    marginRight: 8,
  },
  budget: {
    color: "#B56CFF",
    fontSize: 18,
    fontWeight: "800",
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#20172E",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    color: "#E7D9FF",
    fontSize: 12,
    fontWeight: "700",
  },
  statusHelp: {
    color: "#CBB8F1",
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: "#171024",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#231A33",
  },
  sectionTitle: {
    color: "#B56CFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  bodyText: {
    color: "#CBB8F1",
    fontSize: 15,
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#231A33",
  },
  detailLabel: {
    color: "#A590C9",
    fontSize: 13,
    fontWeight: "700",
  },
  detailValue: {
    color: "#E7D9FF",
    fontSize: 13,
    fontWeight: "700",
  },
  noticeCard: {
    backgroundColor: "#20172E",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#5B3A87",
  },
  noticeTitle: {
    color: "#E7D9FF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  noticeText: {
    color: "#CBB8F1",
    fontSize: 14,
    lineHeight: 20,
  },
  btn: {
    backgroundColor: "#B56CFF",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: {
    backgroundColor: "#2A1E3D",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    opacity: 0.5,
  },
  btnText: {
    color: "#140E1D",
    fontSize: 16,
    fontWeight: "800",
  },
  flaggedBanner: {
    backgroundColor: "#2B1E0A",
    borderWidth: 1,
    borderColor: "#7A4A1E",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  flaggedText: {
    color: "#FFB347",
    fontSize: 13,
    fontWeight: "700",
  },
  reportBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  reportBtnText: {
    color: "#A590C9",
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#171024",
    borderWidth: 1,
    borderColor: "#3A2B52",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 380,
    gap: 12,
  },
  modalTitle: {
    color: "#E7D9FF",
    fontSize: 17,
    fontWeight: "800",
  },
  modalLabel: {
    color: "#A590C9",
    fontSize: 13,
    fontWeight: "700",
  },
  modalInput: {
    backgroundColor: "#0E0A14",
    borderWidth: 1,
    borderColor: "#3A2B52",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#E7D9FF",
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
  },
  startInput: {
    backgroundColor: "#0E0A14",
    borderWidth: 1,
    borderColor: "#3A2B52",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#E7D9FF",
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#6E46A3",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: "#E7D9FF",
    fontSize: 15,
    fontWeight: "800",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#3A2B52",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: {
    color: "#A590C9",
    fontSize: 15,
    fontWeight: "700",
  },
  modalSubmit: {
    flex: 1,
    backgroundColor: "#B56CFF",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
modalSubmitDisabled: {
    opacity: 0.5,
  },
  modalSubmitText: {
    color: "#140E1D",
    fontSize: 15,
    fontWeight: "800",
  },
  applicationsList: {
    maxHeight: 300,
  },
  applicationCard: {
    backgroundColor: "#0E0A14",
    borderWidth: 1,
    borderColor: "#3A2B52",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  applicationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  applicationName: {
    color: "#E7D9FF",
    fontSize: 15,
    fontWeight: "800",
  },
  applicationMeta: {
    color: "#A590C9",
    fontSize: 12,
  },
  applicationMessage: {
    color: "#CBB8F1",
    fontSize: 14,
    marginBottom: 10,
  },
  alreadySelected: {
    color: "#B56CFF",
    fontSize: 13,
    fontWeight: "700",
  },
  acceptButton: {
    backgroundColor: "#B56CFF",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  acceptButtonText: {
    color: "#140E1D",
    fontSize: 14,
    fontWeight: "800",
  },
  acceptedCard: {
    backgroundColor: "#20172E",
    borderWidth: 1,
    borderColor: "#5B3A87",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  acceptedTitle: {
    color: "#E7D9FF",
    fontSize: 16,
    fontWeight: "800",
  },
  acceptedText: {
    color: "#CBB8F1",
    fontSize: 14,
  },
  cancelledCard: {
    backgroundColor: "#2B161B",
    borderWidth: 1,
    borderColor: "#8E4656",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  cancelledTitle: {
    color: "#FFD8DE",
    fontSize: 16,
    fontWeight: "800",
  },
  cancelledText: {
    color: "#FFB0B0",
    fontSize: 14,
    lineHeight: 20,
  },
  cancelButton: {
    backgroundColor: "#2B161B",
    borderWidth: 1,
    borderColor: "#8E4656",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  cancelButtonText: {
    color: "#FFB0B0",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyText: {
    color: "#A590C9",
    fontSize: 14,
    textAlign: "center",
    marginVertical: 20,
  },
});
