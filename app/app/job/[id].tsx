import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  cancelJob,
  completeJob,
  confirmJobStartTime,
  type CommitmentSnapshotInput,
  getJob,
  leaveAcceptedJob,
  proposeJobStartTime,
  removeJob,
  reopenJob,
  updateJobDetails,
} from "../../../lib/jobs";
import {
  applyToJob,
  getApplicationsForJob,
  getMyApplicationForJob,
  selectWorker,
  withdrawApplication,
} from "../../../lib/applications";
import { getProfile } from "../../../lib/auth";
import {
  calculateCommitmentWindowStart,
  COMMITMENT_ESTIMATE_VERSION,
  estimateMiles,
  formatDistanceRange,
  formatTravelTimeRange,
  geocodePostcodeArea,
  getTravelMinutesRange,
  getTravelEstimateUnavailableText,
} from "../../../lib/geocoding";
import { createOrOpenConversation } from "../../../lib/messaging";
import { hasReported, submitReport } from "../../../lib/reports";
import { supabase } from "../../../lib/supabase";
import { getProfileTravelArea } from "../../../lib/profiles";
import type { Application, Job } from "../../../lib/types";
import { EmptyState, FeedbackNotice, LoadingState, SignInRequired } from "../../../components/ui/Premium";
import { normalizeCategory } from "../../../lib/categories";
import { confirmAction } from "../../../lib/confirmAction";
import { formatPostcodeAreaLabel, isValidPostcodeDistrict, normalizePostcodeDistrict } from "../../../lib/postcodeDistricts";

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

const DATE_CHIPS = [
  { label: "Today", offset: 0 },
  { label: "Tomorrow", offset: 1 },
  { label: "In 2 days", offset: 2 },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const minutes = 8 * 60 + index * 15;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});

function buildStartTime(offset: number, time: string) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const [hour, minute] = time.split(":").map(Number);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function normalizeId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sameId(left: unknown, right: unknown) {
  const leftId = normalizeId(left);
  const rightId = normalizeId(right);
  return !!leftId && !!rightId && leftId === rightId;
}

function hasCompleteCommitmentSnapshot(job: Job) {
  const windowStart = job.commitment_window_starts_at ? new Date(job.commitment_window_starts_at) : null;
  const travelMax = job.commitment_travel_minutes_max;
  return (
    !!windowStart &&
    !Number.isNaN(windowStart.getTime()) &&
    typeof travelMax === "number" &&
    Number.isFinite(travelMax) &&
    travelMax > 0 &&
    !!normalizePostcodeDistrict(job.commitment_worker_outcode) &&
    !!normalizePostcodeDistrict(job.commitment_job_outcode) &&
    !!String(job.commitment_transport_mode || "").trim() &&
    !!String(job.commitment_estimate_version || "").trim()
  );
}

function hasPartialCommitmentSnapshot(job: Job) {
  return !!(
    job.commitment_window_starts_at ||
    job.commitment_travel_minutes_max != null ||
    job.commitment_worker_outcode ||
    job.commitment_job_outcode ||
    job.commitment_transport_mode ||
    job.commitment_estimate_version
  );
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptingWorkerId, setAcceptingWorkerId] = useState<string | null>(null);
  const [showApplications, setShowApplications] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [startDateOffset, setStartDateOffset] = useState(0);
  const [startClockTime, setStartClockTime] = useState("18:00");
  const [updatingStartTime, setUpdatingStartTime] = useState(false);
  const [completingJob, setCompletingJob] = useState(false);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [showEditJob, setShowEditJob] = useState(false);
  const [savingJob, setSavingJob] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPostcode, setEditPostcode] = useState("");
  const [myApplication, setMyApplication] = useState<Application | null>(null);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [withdrawingApplication, setWithdrawingApplication] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [feedbackJobId, setFeedbackJobId] = useState<string | null>(null);
  const [travelEstimateText, setTravelEstimateText] = useState<string>(getTravelEstimateUnavailableText());
  const [commitmentWindow, setCommitmentWindow] = useState<{
    startsAt: Date | null;
    note: string;
  }>({
    startsAt: null,
    note: "Travel estimate unavailable, using a default commitment window.",
  });
  const [openingConversation, setOpeningConversation] = useState(false);
  const [reportingJob, setReportingJob] = useState(false);

  const resetFeedback = useCallback(() => {
    setApplyMessage(null);
    setApplyError(null);
    setActionMessage(null);
    setFeedbackJobId(null);
    setApplicationsError(null);
    setShowApplications(false);
  }, []);

  const markFeedbackForCurrentJob = useCallback(() => {
    setFeedbackJobId(jobId || null);
    setApplyMessage(null);
    setApplyError(null);
    setActionMessage(null);
    setApplicationsError(null);
    setShowApplications(false);
  }, [jobId]);

  const loadJobState = useCallback(async (active = true, showSpinner = true, clearFeedback = false) => {
    if (!jobId) {
      setErrorText("Job not found.");
      setLoading(false);
      return;
    }

    try {
      if (showSpinner) setLoading(true);
      if (clearFeedback) resetFeedback();
      setErrorText(null);
      setTravelEstimateText(getTravelEstimateUnavailableText());
      setCommitmentWindow({
        startsAt: null,
        note: "Travel estimate unavailable, using a default commitment window.",
      });

      const data = await getJob(jobId);
      if (!active) return;

      setJob(data);
      setStartTime(data.agreed_start_at || data.preferred_start_at || "");
      setEditTitle(data.title || "");
      setEditDescription(data.description || "");
      setEditBudget(String(data.budget_gbp ?? ""));
      setEditCategory(data.category || "");
      setEditPostcode(normalizePostcodeDistrict((data as any).postcode_district) || normalizePostcodeDistrict(data.postcode) || "");

      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      const loadedUserId = normalizeId(user?.id);
      const loadedPosterId = normalizeId(data.poster_id);
      setCurrentUserId(loadedUserId || null);

      if (sameId(loadedUserId, loadedPosterId)) {
        const jobApplications = await getApplicationsForJob(jobId);
        if (!active) return;
        setApplications(jobApplications);
        setMyApplication(null);
      } else if (loadedUserId) {
        const application = await getMyApplicationForJob(jobId).catch(() => null);
        if (!active) return;
        setMyApplication(application);
        setApplications([]);
      } else {
        setMyApplication(null);
        setApplications([]);
      }

      const agreedStartTime = data.agreed_start_at || null;
      const acceptedWorkerId = normalizeId(data.accepted_worker_id);
      const safeJobPostcode = normalizePostcodeDistrict((data as any).postcode_district) || normalizePostcodeDistrict(data.postcode);
      if (agreedStartTime && hasCompleteCommitmentSnapshot(data)) {
        const storedWindowStart = new Date(data.commitment_window_starts_at as string);
        setCommitmentWindow({
          startsAt: storedWindowStart,
          note: "Based on the selected helper's approximate travel from their profile area when the time was confirmed. No live location or exact address is used.",
        });
      } else if (agreedStartTime && acceptedWorkerId && safeJobPostcode) {
        if (hasPartialCommitmentSnapshot(data)) {
          console.warn("Incomplete commitment snapshot found; using legacy fallback estimate.");
        }
        try {
          const workerProfile = await getProfileTravelArea(acceptedWorkerId);
          const [workerPoint, jobPoint] = await Promise.all([
            workerProfile.postcode ? geocodePostcodeArea(workerProfile.postcode) : Promise.resolve(null),
            geocodePostcodeArea(safeJobPostcode),
          ]);
          if (!active) return;
          if (workerPoint && jobPoint) {
            const miles = estimateMiles(workerPoint, jobPoint);
            const range = getTravelMinutesRange(miles, workerProfile.transport_mode);
            setCommitmentWindow({
              startsAt: calculateCommitmentWindowStart(agreedStartTime, range.maximum),
              note: "Based on the selected helper's approximate travel from their profile area. No live location or exact address is used.",
            });
          } else {
            setCommitmentWindow({
              startsAt: calculateCommitmentWindowStart(agreedStartTime),
              note: "Travel estimate unavailable, using a default commitment window.",
            });
          }
        } catch {
          if (!active) return;
          setCommitmentWindow({
            startsAt: calculateCommitmentWindowStart(agreedStartTime),
            note: "Travel estimate unavailable, using a default commitment window.",
          });
        }
      }

      if (loadedUserId && !sameId(loadedUserId, loadedPosterId)) {
        const profile = await getProfile().catch(() => null);
        const profilePostcode = profile?.postcode?.trim();
        if (safeJobPostcode) {
          const [profilePoint, toPoint] = await Promise.all([
            profilePostcode ? geocodePostcodeArea(profilePostcode) : Promise.resolve(null),
            geocodePostcodeArea(safeJobPostcode),
          ]).catch(() => [null, null, null]);
          const fromPoint = profilePoint;
          if (active && fromPoint && toPoint) {
            const miles = estimateMiles(fromPoint, toPoint);
            const mode = profile?.transport_mode || "unspecified";
            setTravelEstimateText(`${formatDistanceRange(miles)} from your profile area. ${formatTravelTimeRange(miles, mode)}. Based on postcode areas, not an exact route.`);
          }
        }
      }
    } catch (error: any) {
      if (!active) return;
      setErrorText(error?.message || "Could not load this job.");
    } finally {
      if (active) setLoading(false);
    }
  }, [jobId, resetFeedback]);

  useEffect(() => {
    let active = true;
    loadJobState(active, true, true);
    return () => {
      active = false;
    };
  }, [loadJobState]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadJobState(active, false, true);
      return () => {
        active = false;
      };
    }, [loadJobState])
  );

  useEffect(() => {
    let active = true;
    const timer = setInterval(() => {
      loadJobState(active, false, true);
    }, 6000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loadJobState]);

  const areaText = formatPostcodeAreaLabel((job as any)?.postcode_district, job?.postcode);
  const activeApplications = applications.filter((application) => application.status === "applied");
  const currentUserKey = normalizeId(currentUserId);
  const posterId = normalizeId(job?.poster_id);
  const acceptedWorkerId = normalizeId(job?.accepted_worker_id);
  const isSignedIn = !!currentUserKey;
  const isPoster = sameId(currentUserKey, posterId);
  const isAcceptedWorker = sameId(currentUserKey, acceptedWorkerId);
  const isSelectedWorker = isAcceptedWorker;
  const hasSelectedWorker = !!acceptedWorkerId;
  const selectedApplication = applications.find((app) => sameId(app.worker_id, acceptedWorkerId));
  const selectedWorkerName =
    selectedApplication?.worker?.display_name ||
    (sameId(currentUserKey, acceptedWorkerId) ? "you" : "Selected helper");
  const hasApplied = myApplication?.status === "applied";
  const applicationWithdrawn = myApplication?.status === "withdrawn";
  const applicationsClosed = job?.status !== "open";
  const isCompletedJob = job?.status === "completed";
  const isCancelledJob = job?.status === "cancelled";
  const canProposeStartTime =
    isPoster &&
    hasSelectedWorker &&
    job?.status === "held";
  const canChangeStartTimeProposal =
    isPoster &&
    hasSelectedWorker &&
    job?.status === "confirm_pending";
  const canManageStartTime = canProposeStartTime || canChangeStartTimeProposal;
  const canConfirmStartTime =
    isAcceptedWorker &&
    job?.status === "confirm_pending" &&
    !!(job?.preferred_start_at || job?.agreed_start_at);
  const canEditJob = isPoster && job?.status === "open";
  const lifecycleHelp =
    job?.status === "confirm_pending"
      ? isAcceptedWorker
        ? "The poster proposed a start time. Confirm it when you're ready."
        : "Waiting for the selected worker to confirm the proposed start time."
      : job?.status === "in_progress"
        ? "This job has started."
        : getStatusHelp((job as any)?.status);
  const agreedStartTime = job?.agreed_start_at || null;
  const commitmentWindowText = agreedStartTime && commitmentWindow.startsAt
    ? `Commitment window starts around ${formatStartTime(commitmentWindow.startsAt.toISOString())}`
    : null;
  const startTimeActionLabel = canChangeStartTimeProposal ? "Change proposed time" : "Propose start time";

  async function handleApply() {
    markFeedbackForCurrentJob();
    if (!currentUserId) {
      setApplyError("Sign in before applying for this job.");
      Alert.alert("Sign in required", "Sign in before applying for this job.");
      return;
    }
    if (!jobId) {
      setApplyError("Job not found.");
      return;
    }

      try {
        setApplying(true);
        setApplyError(null);
        setApplyMessage(null);
        const application = await applyToJob(jobId, applicationMessage.trim() || undefined);
        setMyApplication(application);
        setApplicationMessage("");
        await loadJobState(true, false, true);
        setApplyMessage("Applied. The poster can now review your application.");
        Alert.alert("Applied!", "The poster has been notified. They'll reach out if interested.");
    } catch (err: any) {
      const message = getApplyErrorMessage(err);
      setApplyError(message);
      Alert.alert("Could not apply", message);
    } finally {
      setApplying(false);
    }
  }

  async function handleWithdrawApplication() {
    markFeedbackForCurrentJob();
    if (!currentUserId) {
      setApplyError("Sign in before withdrawing this application.");
      Alert.alert("Sign in required", "Sign in before withdrawing this application.");
      return;
    }
    if (!jobId || !hasApplied) {
      setApplyError("No active application was found to withdraw.");
      return;
    }
      try {
        setWithdrawingApplication(true);
        setApplyError(null);
        setApplyMessage(null);
        const application = await withdrawApplication(jobId);
        setMyApplication(application);
        await loadJobState(true, false, true);
        setApplyMessage("Application withdrawn.");
        setActionMessage({ type: "success", text: "Application withdrawn." });
      } catch (err: any) {
      const message = err?.message || "Could not withdraw this application.";
      setApplyError(message);
      Alert.alert("Could not withdraw", message);
    } finally {
      setWithdrawingApplication(false);
    }
  }

  async function loadApplications() {
    if (!jobId || !isPoster) {
      setApplicationsError("Applications cannot be loaded for this account.");
      return;
    }
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
    markFeedbackForCurrentJob();
    if (!jobId || !currentUserKey || !isPoster) {
      setActionMessage({ type: "error", text: "Only the signed-in poster can accept applicants." });
      return;
    }
    confirmAction({
      title: "Accept this applicant?",
      message: `You are choosing ${workerName || "this person"} for this job. This will let you message each other to arrange the details.`,
      confirmText: "Accept",
      onConfirm: async () => {
        try {
          setAccepting(true);
          setAcceptingWorkerId(workerId);
          await selectWorker(jobId, workerId);
          const conversation = await createOrOpenConversation(jobId, currentUserKey, workerId);
          await loadJobState(true, false, true);
          setShowApplications(false);
          setActionMessage({ type: "success", text: "Worker selected — applications are closed." });
          Alert.alert("Worker accepted!", "You can now message each other to finalise the job.");
          router.push(`/app/messages/${conversation.id}`);
        } catch (err: any) {
          const message = err?.message || "Something went wrong.";
          setActionMessage({ type: "error", text: message });
          Alert.alert("Could not accept", message);
        } finally {
          setAccepting(false);
          setAcceptingWorkerId(null);
        }
      },
    });
  }

  function handleCancelJob() {
    markFeedbackForCurrentJob();
    if (!currentUserId || !isPoster) {
      setActionMessage({ type: "error", text: "Only the signed-in poster can cancel this job." });
      return;
    }
    if (!jobId || isCancelledJob || isCompletedJob) {
      setActionMessage({ type: "error", text: "This job cannot be cancelled from its current state." });
      return;
    }
    confirmAction({
      title: "Cancel this job?",
      message: "This will close the job for new applicants. If you've already accepted someone, please message them first.",
      confirmText: "Cancel job",
      cancelText: "Keep job",
      destructive: true,
      onConfirm: async () => {
        try {
          setCancelling(true);
          const data = await cancelJob(jobId, "Cancelled by poster");
          setJob(data);
          setStartTime(data.agreed_start_at || data.preferred_start_at || "");
          await loadJobState(true, false, true);
          setActionMessage({ type: "success", text: "Job cancelled." });
          Alert.alert("Job cancelled", "This job is now cancelled. You can reopen it from this page if needed.");
        } catch (err: any) {
          console.log("Could not cancel job", err);
          const message = err?.message || "Something went wrong.";
          setActionMessage({ type: "error", text: message });
          Alert.alert("Could not cancel", message);
        } finally {
          setCancelling(false);
        }
      },
    });
  }

  function handleLeaveJob() {
    markFeedbackForCurrentJob();
    if (!jobId || !currentUserKey || !isSelectedWorker) {
      setActionMessage({ type: "error", text: "You are not the selected worker for this job." });
      return;
    }
    confirmAction({
      title: "Leave this job?",
      message: "This will remove you from the job. The poster will be notified.",
      confirmText: "Leave",
      cancelText: "Stay",
      destructive: true,
      onConfirm: async () => {
        try {
          setCancelling(true);
          const data = await leaveAcceptedJob(jobId, currentUserKey);
          setJob(data);
          const application = await getMyApplicationForJob(jobId).catch(() => null);
          setMyApplication(application);
          setStartTime(data.agreed_start_at || data.preferred_start_at || "");
          await loadJobState(true, false, true);
          setActionMessage({ type: "success", text: "You left the job and it has been reopened." });
          Alert.alert("Left job", "You have been removed and the job is open again.");
        } catch (err: any) {
          console.log("Could not leave job", err);
          const message = err?.message || "Something went wrong.";
          setActionMessage({ type: "error", text: message });
          Alert.alert("Could not leave", message);
        } finally {
          setCancelling(false);
        }
      },
    });
  }

  function openEditJob() {
    if (!job) return;
    setEditTitle(job.title || "");
    setEditDescription(job.description || "");
    setEditBudget(String(job.budget_gbp ?? ""));
    setEditCategory(job.category || "");
    setEditPostcode(normalizePostcodeDistrict((job as any).postcode_district) || normalizePostcodeDistrict(job.postcode) || "");
    setShowEditJob(true);
  }

  async function handleSaveJobDetails() {
    markFeedbackForCurrentJob();
    if (!jobId || !canEditJob) {
      setActionMessage({ type: "error", text: "This job cannot be edited from its current state." });
      return;
    }
    const parsedBudget = Number(editBudget);
    if (!editTitle.trim() || !editDescription.trim() || !editBudget.trim()) {
      Alert.alert("Missing details", "Title, description, and budget are required.");
      return;
    }
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      Alert.alert("Invalid budget", "Enter a valid budget in GBP.");
      return;
    }
    if (!isValidPostcodeDistrict(editPostcode)) {
      Alert.alert("Check job area", "Enter the first part of the job postcode, for example DN11, S80, or LS1.");
      return;
    }
    const safePostcode = normalizePostcodeDistrict(editPostcode);

    try {
          setSavingJob(true);
          const data = await updateJobDetails(jobId, {
        title: editTitle,
        description: editDescription,
        budget_gbp: parsedBudget,
        category: editCategory,
        postcode: safePostcode,
      });
      setJob(data);
      await loadJobState(true, false);
      setShowEditJob(false);
      Alert.alert("Job updated", "Your job details have been saved.");
    } catch (err: any) {
      Alert.alert("Could not update job", err?.message || "Something went wrong.");
    } finally {
      setSavingJob(false);
    }
  }

  function handleRemoveJob() {
    markFeedbackForCurrentJob();
    if (!jobId || !canEditJob) {
      setActionMessage({ type: "error", text: "This job cannot be removed from its current state." });
      return;
    }
    confirmAction({
      title: "Remove this job?",
      message: "This hides the job from your list and closes it to applicants.",
      confirmText: "Remove",
      cancelText: "Keep job",
      destructive: true,
      onConfirm: async () => {
      try {
        setSavingJob(true);
        await removeJob(jobId);
        setActionMessage({ type: "success", text: "Job removed." });
        Alert.alert("Job removed", "This job is no longer visible.");
        router.replace("/app/my-jobs");
        } catch (err: any) {
          const message = err?.message || "Something went wrong.";
          setActionMessage({ type: "error", text: message });
          Alert.alert("Could not remove job", message);
        } finally {
          setSavingJob(false);
        }
      },
    });
  }

  async function handleReport() {
    markFeedbackForCurrentJob();
    if (!currentUserId) {
      setActionMessage({ type: "error", text: "Sign in before reporting this job." });
      Alert.alert("Sign in required", "Sign in before reporting this job.");
      return;
    }
    if (!jobId) {
      setActionMessage({ type: "error", text: "Report could not be sent because this job is missing details." });
      return;
    }
    try {
      setReportingJob(true);
      const alreadyReported = await hasReported(jobId, currentUserId);
      if (!alreadyReported) {
        await submitReport({
          jobId,
          reporterId: currentUserId,
          reason: "Inappropriate content",
          details: "Reported from job detail screen. User was advised to keep screenshots if unsafe.",
        });
      }
      const text = alreadyReported
        ? "You have already sent a report for this job. Please keep screenshots if unsafe."
        : "Report sent. Please keep screenshots if unsafe.";
      setActionMessage({ type: "success", text });
      Alert.alert("Report sent", text);
    } catch (err: any) {
      console.log("Could not report job", err?.message);
      const text = "Report could not be sent. Please keep screenshots if unsafe.";
      setActionMessage({ type: "error", text });
      Alert.alert("Could not send report", text);
    } finally {
      setReportingJob(false);
    }
  }

  function handleReopenJob() {
    markFeedbackForCurrentJob();
    if (!jobId || !isPoster) {
      setActionMessage({ type: "error", text: "Only the poster can reopen this job." });
      return;
    }
    if (job?.status !== "cancelled") {
      setActionMessage({ type: "error", text: "This job cannot be reopened from its current state." });
      return;
    }
    confirmAction({
      title: "Reopen this job?",
      message: "This will make the job visible to new applicants again and clear any accepted worker. Previous application rows may still need a database reset before the same worker can reapply.",
      confirmText: "Reopen",
      cancelText: "Keep cancelled",
      onConfirm: async () => {
        try {
          setCancelling(true);
          await reopenJob(jobId);
          await loadJobState(true, false, true);
          setActionMessage({ type: "success", text: "Job reopened for applications." });
          Alert.alert("Job reopened", "This job is open for applications again.");
        } catch (err: any) {
          const message = err?.message || "Something went wrong.";
          setActionMessage({ type: "error", text: message });
          Alert.alert("Could not reopen", message);
        } finally {
          setCancelling(false);
        }
      },
    });
  }

  async function handleProposeStartTime() {
    markFeedbackForCurrentJob();
    if (!jobId || !canManageStartTime) {
      setActionMessage({ type: "error", text: "Start time cannot be proposed from this account or job state." });
      return;
    }
    const proposedStartTime = buildStartTime(startDateOffset, startClockTime);
    try {
      setUpdatingStartTime(true);
      await proposeJobStartTime(jobId, proposedStartTime);
      await loadJobState(true, false, true);
      setActionMessage({ type: "success", text: "Start time proposed. Waiting for worker confirmation." });
      Alert.alert("Start time proposed", "The worker can now confirm the start time.");
    } catch (err: any) {
      const message = err?.message || "Something went wrong.";
      setActionMessage({ type: "error", text: message });
      Alert.alert("Could not update start time", message);
    } finally {
      setUpdatingStartTime(false);
    }
  }

  async function buildCommitmentSnapshot(): Promise<CommitmentSnapshotInput> {
    const proposedStartTime = job?.preferred_start_at || startTime;
    const jobOutcode = normalizePostcodeDistrict((job as any)?.postcode_district) || normalizePostcodeDistrict(job?.postcode);
    const profile = await getProfile();
    const workerOutcode = normalizePostcodeDistrict(profile?.postcode);

    if (!proposedStartTime || !jobOutcode || !workerOutcode) {
      throw new Error("Add a valid profile postcode area before confirming this start time.");
    }

    const [workerPoint, jobPoint] = await Promise.all([
      geocodePostcodeArea(workerOutcode),
      geocodePostcodeArea(jobOutcode),
    ]);
    if (!workerPoint || !jobPoint) {
      throw new Error("Could not calculate the commitment window from the postcode areas. Please check your profile area and try again.");
    }

    const miles = estimateMiles(workerPoint, jobPoint);
    const range = getTravelMinutesRange(miles, profile?.transport_mode || "unspecified");
    const windowStart = calculateCommitmentWindowStart(proposedStartTime, range.maximum);
    if (!windowStart) {
      throw new Error("Could not calculate the commitment window for this start time.");
    }

    return {
      windowStartsAt: windowStart.toISOString(),
      travelMinutesMax: range.maximum,
      workerOutcode,
      jobOutcode,
      transportMode: profile?.transport_mode || "unspecified",
      estimateVersion: COMMITMENT_ESTIMATE_VERSION,
    };
  }

  async function handleConfirmStartTime() {
    markFeedbackForCurrentJob();
    if (!jobId || !currentUserKey || !canConfirmStartTime) {
      setActionMessage({ type: "error", text: "Start time cannot be confirmed from this account or job state." });
      return;
    }
    try {
      setUpdatingStartTime(true);
      const commitment = await buildCommitmentSnapshot();
      await confirmJobStartTime(jobId, currentUserKey, commitment);
      await loadJobState(true, false, true);
      setActionMessage({ type: "success", text: "Start time confirmed. Job is now in progress." });
      Alert.alert("Start time confirmed", "This job is now marked as in progress.");
    } catch (err: any) {
      const message = err?.message || "Something went wrong.";
      setActionMessage({ type: "error", text: message });
      Alert.alert("Could not confirm start time", message);
    } finally {
      setUpdatingStartTime(false);
    }
  }

  async function handleOpenConversation(workerId?: string) {
    markFeedbackForCurrentJob();
    if (!currentUserId) {
      setActionMessage({ type: "error", text: "Sign in before opening messages." });
      Alert.alert("Sign in required", "Sign in before opening messages.");
      return;
    }
    if (!jobId || !posterId || !workerId) {
      setActionMessage({ type: "error", text: "Could not open chat because the job or worker is missing." });
      return;
    }
    try {
      setOpeningConversation(true);
      const conversation = await createOrOpenConversation(jobId, posterId, workerId);
      router.push(`/app/messages/${conversation.id}`);
    } catch (err: any) {
      const message = err?.message || "Something went wrong.";
      setActionMessage({ type: "error", text: message });
      Alert.alert("Could not open messages", message);
    } finally {
      setOpeningConversation(false);
    }
  }

  async function handleCompleteJob() {
    markFeedbackForCurrentJob();
    if (!currentUserKey || !isPoster) {
      setActionMessage({ type: "error", text: "Only the signed-in poster can complete this job." });
      return;
    }
    if (!jobId || !["in_progress"].includes(job?.status || "")) {
      setActionMessage({ type: "error", text: "This job can only be completed once it is in progress." });
      return;
    }
    confirmAction({
      title: "Complete this job?",
      message: "This marks the job completed and moves it out of active jobs.",
      confirmText: "Complete",
      cancelText: "Keep active",
      onConfirm: async () => {
    try {
      setCompletingJob(true);
      const data = await completeJob(jobId);
      setJob(data);
      setStartTime(data.agreed_start_at || data.preferred_start_at || "");
      await loadJobState(true, false, true);
      setActionMessage({ type: "success", text: "Job completed." });
          Alert.alert("Job completed", "This job has moved to completed/cancelled history.");
        } catch (err: any) {
          const message = err?.message || "Could not complete this job.";
          setActionMessage({ type: "error", text: message });
          Alert.alert("Could not complete job", message);
        } finally {
          setCompletingJob(false);
        }
      },
    });
  }

  if (loading) {
    return <LoadingState text="Loading job..." fullScreen />;
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

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>

        <View style={styles.heroCard}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{job.title}</Text>
            <Text style={styles.budget}>{formatBudget((job as any)?.budget_gbp)}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{toStatusLabel((job as any)?.status)}</Text>
          </View>
          <Text style={styles.statusHelp}>{lifecycleHelp}</Text>
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
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category</Text>
            <Text style={styles.detailValue}>{normalizeCategory(job.category)}</Text>
          </View>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Privacy</Text>
          <Text style={styles.noticeText}>
            Exact address details are not shown here. Only safe area info is visible until
            someone is chosen.
          </Text>
        </View>

        {isSignedIn && !isPoster && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Travel estimate</Text>
            <Text style={styles.noticeText}>{travelEstimateText}</Text>
          </View>
        )}

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Safety &amp; platform notice</Text>
          <Text style={styles.noticeText}>
            FEN connects people — it does not provide, guarantee, or supervise the work. You
            are responsible for your own safety and any arrangements you make. FEN does not
            process payments in MVP; any money is agreed directly between users. FEN is not
            liable for disputes, losses, or cancellations between users.
          </Text>
        </View>

        {(job as any)?.status === "cancelled" && (
          <View style={styles.cancelledCard}>
            <Text style={styles.cancelledTitle}>Job cancelled</Text>
            <Text style={styles.cancelledText}>
              {job.cancel_reason || "This job is no longer open for applications or arrangements."}
            </Text>
          </View>
        )}

        {actionMessage && feedbackJobId === jobId && (
          <FeedbackNotice type={actionMessage.type} text={actionMessage.text} />
        )}

        {!isSignedIn && (
          <SignInRequired title="Sign in for job actions" text="You can read job details while logged out. Sign in to apply, message, report, or manage this job." />
        )}

        {isPoster && hasSelectedWorker && (
          <View style={styles.acceptedCard}>
            <Text style={styles.acceptedTitle}>Selected helper: {selectedWorkerName}</Text>
            <Text style={styles.acceptedText}>{lifecycleHelp}</Text>
            <Pressable style={[styles.btn, openingConversation && styles.btnDisabled]} onPress={() => handleOpenConversation(acceptedWorkerId)} disabled={openingConversation}>
              {openingConversation ? (
                <ActivityIndicator size="small" color="#140E1D" />
              ) : (
                <Text style={styles.btnText}>Open Messages</Text>
              )}
            </Pressable>
          </View>
        )}

        {(isPoster || isSelectedWorker) && hasSelectedWorker && !isCancelledJob && !isCompletedJob && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Start time</Text>
            <Text style={styles.bodyText}>
              {agreedStartTime
                ? `Start time agreed: ${formatStartTime(agreedStartTime)}`
                : job.status === "confirm_pending"
                ? `Pending confirmation: ${formatStartTime(job.preferred_start_at || job.agreed_start_at)}`
                : `Current plan: ${formatStartTime(job.preferred_start_at)}`}
            </Text>
            {commitmentWindowText ? (
              <>
                <Text style={styles.cutoffText}>{commitmentWindowText}</Text>
                <Text style={styles.noticeText}>{commitmentWindow.note}</Text>
                <Text style={styles.noticeText}>Helping neighbours help neighbours works best when both sides keep the agreed time.</Text>
              </>
            ) : hasSelectedWorker ? (
              <Text style={styles.noticeText}>The shared commitment window appears after both sides agree the start time.</Text>
            ) : null}
            {isPoster && job.status === "confirm_pending" ? (
              <Text style={styles.noticeText}>Waiting for the selected worker to confirm. You can change the proposed time if needed.</Text>
            ) : null}
            {isSelectedWorker && job.status === "confirm_pending" ? (
              <Text style={styles.noticeText}>Confirm this time if it works for you. If not, message the poster to request another time.</Text>
            ) : null}

            {isPoster && canManageStartTime && (
              <>
                <View style={styles.dateChipRow}>
                  {DATE_CHIPS.map((chip) => (
                    <Pressable
                      key={chip.label}
                      style={[styles.dateChip, startDateOffset === chip.offset && styles.dateChipActive]}
                      onPress={() => setStartDateOffset(chip.offset)}
                      disabled={updatingStartTime}
                    >
                      <Text style={[styles.dateChipText, startDateOffset === chip.offset && styles.dateChipTextActive]}>
                        {chip.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
                  {TIME_OPTIONS.map((time) => (
                    <Pressable
                      key={time}
                      style={[styles.timeChip, startClockTime === time && styles.timeChipActive]}
                      onPress={() => setStartClockTime(time)}
                      disabled={updatingStartTime}
                    >
                      <Text style={[styles.timeChipText, startClockTime === time && styles.timeChipTextActive]}>
                        {time}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable
                  style={[styles.secondaryButton, updatingStartTime && styles.secondaryButtonDisabled]}
                  onPress={handleProposeStartTime}
                  disabled={updatingStartTime}
                >
                  {updatingStartTime ? (
                    <ActivityIndicator size="small" color="#E7D9FF" />
                  ) : (
                    <Text style={styles.secondaryButtonText}>{startTimeActionLabel}</Text>
                  )}
                </Pressable>
              </>
            )}

            {isSelectedWorker && canConfirmStartTime && (
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

        {isPoster && !hasSelectedWorker && job.status === "open" && (
          <Pressable
            style={styles.btn}
            onPress={() => {
              loadApplications();
              setShowApplications(true);
            }}
          >
          <Text style={styles.btnText}>View applications ({activeApplications.length})</Text>
          </Pressable>
        )}

        {isPoster && (hasSelectedWorker || ["held", "confirm_pending", "in_progress"].includes(job.status)) && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Applications closed</Text>
            <Text style={styles.noticeText}>Worker selected — applications are closed.</Text>
          </View>
        )}

        {canEditJob && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Poster controls</Text>
            <Text style={styles.bodyText}>You can edit or close this open job before selecting a helper.</Text>
            <Pressable style={styles.secondaryButton} onPress={openEditJob}>
              <Text style={styles.secondaryButtonText}>Edit job details</Text>
            </Pressable>
            <Pressable style={styles.removeButton} onPress={handleRemoveJob} disabled={savingJob}>
              <Text style={styles.removeButtonText}>{savingJob ? "Processing..." : "Remove job"}</Text>
            </Pressable>
          </View>
        )}

        {isSelectedWorker && (
          <View style={styles.acceptedCard}>
            <Text style={styles.acceptedTitle}>You are the accepted helper</Text>
            <Text style={styles.acceptedText}>{lifecycleHelp}</Text>
            <Pressable style={[styles.btn, openingConversation && styles.btnDisabled]} onPress={() => handleOpenConversation(currentUserId || undefined)} disabled={openingConversation}>
              {openingConversation ? (
                <ActivityIndicator size="small" color="#140E1D" />
              ) : (
                <Text style={styles.btnText}>Open Messages</Text>
              )}
            </Pressable>
          </View>
        )}

        {!isPoster && !isSelectedWorker && hasApplied && job.status === "open" && !hasSelectedWorker && (
          <View style={styles.acceptedCard}>
            <Text style={styles.acceptedTitle}>Application sent</Text>
            <Text style={styles.acceptedText}>The poster can review your application from their job page.</Text>
            <Pressable
              style={[styles.secondaryButton, withdrawingApplication && styles.secondaryButtonDisabled]}
              onPress={handleWithdrawApplication}
              disabled={withdrawingApplication}
            >
              <Text style={styles.secondaryButtonText}>{withdrawingApplication ? "Withdrawing..." : "Withdraw application"}</Text>
            </Pressable>
          </View>
        )}

        {!isPoster && !isSelectedWorker && applicationWithdrawn && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Application withdrawn</Text>
            <Text style={styles.noticeText}>This application has been cancelled from your side.</Text>
          </View>
        )}

        {!actionMessage && !applyError && !isPoster && !isSelectedWorker && applyMessage && feedbackJobId === jobId && job.status === "open" && !hasSelectedWorker && (
          <FeedbackNotice type="success" text={applyMessage} />
        )}
        {!actionMessage && !isPoster && !isSelectedWorker && applyError && feedbackJobId === jobId && (
          <FeedbackNotice type="error" text={applyError} />
        )}

        {isSignedIn && !isPoster && !isSelectedWorker && !hasApplied && !applicationsClosed && !hasSelectedWorker && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Apply</Text>
            <TextInput
              style={styles.applicationInput}
              placeholder="Optional message to the poster"
              placeholderTextColor="#8D79AF"
              value={applicationMessage}
              onChangeText={setApplicationMessage}
              editable={!applying}
              multiline
              textAlignVertical="top"
            />
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
          </View>
        )}

        {!isPoster && !isSelectedWorker && !applicationWithdrawn && (applicationsClosed || hasSelectedWorker) && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Applications closed</Text>
            <Text style={styles.noticeText}>
              {hasSelectedWorker ? "Worker selected — applications are closed." : "This job is no longer open for applications."}
            </Text>
          </View>
        )}

        {isPoster && (job as any)?.status === "cancelled" && (
          <Pressable style={styles.btn} onPress={handleReopenJob} disabled={cancelling}>
            <Text style={styles.btnText}>{cancelling ? "Processing..." : "Reopen job"}</Text>
          </Pressable>
        )}

        {isPoster && (job as any)?.status === "in_progress" && (
          <Pressable style={styles.btn} onPress={handleCompleteJob} disabled={completingJob}>
            {completingJob ? (
              <ActivityIndicator size="small" color="#140E1D" />
            ) : (
              <Text style={styles.btnText}>Complete job</Text>
            )}
          </Pressable>
        )}

        {isSelectedWorker && (job as any)?.status === "in_progress" && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Completion</Text>
            <Text style={styles.noticeText}>Ask the poster to mark this job completed. Worker-side completion needs the Phase 2 database/RLS helper.</Text>
          </View>
        )}

        {(isPoster || isSelectedWorker) && (job as any)?.status !== "cancelled" && (job as any)?.status !== "completed" && (
          <Pressable style={styles.cancelButton} onPress={isPoster ? handleCancelJob : handleLeaveJob} disabled={cancelling}>
            <Text style={styles.cancelButtonText}>{cancelling ? "Processing..." : isPoster ? "Cancel job" : "Leave job"}</Text>
          </Pressable>
        )}

        {isSignedIn && (
          <Pressable style={[styles.reportBtn, reportingJob && styles.reportBtnDisabled]} onPress={handleReport} disabled={reportingJob}>
            <Text style={styles.reportBtnText}>{reportingJob ? "Reporting..." : "Report this job"}</Text>
          </Pressable>
        )}
      </ScrollView>

      {isPoster && showApplications && job.status === "open" && !hasSelectedWorker && (
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
                <LoadingState text="Loading applications..." compact />
              ) : applicationsError ? (
                <FeedbackNotice type="error" text={applicationsError} />
              ) : activeApplications.length === 0 ? (
                <EmptyState
                  title="No applicants yet"
                  text="Applications from nearby FEN helpers will appear here."
                />
              ) : (
                <ScrollView style={styles.applicationsList}>
                  {activeApplications.map((application) => {
                    const workerName = application.worker?.display_name || "Applicant";
                    const isSelected = application.status === "selected" || sameId(application.worker_id, acceptedWorkerId);
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
                          <Pressable style={[styles.acceptButton, openingConversation && styles.btnDisabled]} onPress={() => handleOpenConversation(application.worker_id)} disabled={openingConversation}>
                            {openingConversation ? (
                              <ActivityIndicator size="small" color="#140E1D" />
                            ) : (
                              <Text style={styles.acceptButtonText}>Open Messages</Text>
                            )}
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

      {showEditJob && (
        <Modal
          transparent
          visible
          animationType="fade"
          onRequestClose={() => setShowEditJob(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Edit job</Text>
              <TextInput
                style={styles.modalInputSingle}
                placeholder="Title"
                placeholderTextColor="#8D79AF"
                value={editTitle}
                onChangeText={setEditTitle}
                editable={!savingJob}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Description"
                placeholderTextColor="#8D79AF"
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
                textAlignVertical="top"
                editable={!savingJob}
              />
              <TextInput
                style={styles.modalInputSingle}
                placeholder="Budget in GBP"
                placeholderTextColor="#8D79AF"
                value={editBudget}
                onChangeText={setEditBudget}
                keyboardType="numeric"
                editable={!savingJob}
              />
              <TextInput
                style={styles.modalInputSingle}
                placeholder="Category"
                placeholderTextColor="#8D79AF"
                value={editCategory}
                onChangeText={setEditCategory}
                editable={!savingJob}
              />
              <TextInput
                style={styles.modalInputSingle}
                placeholder="Where is the job? First part only"
                placeholderTextColor="#8D79AF"
                value={editPostcode}
                onChangeText={setEditPostcode}
                autoCapitalize="characters"
                editable={!savingJob}
              />
              <Text style={styles.modalHint}>Use only the outward code, such as DN11, S80, or LS1. Exact addresses stay out of the public listing.</Text>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalCancel}
                  onPress={() => setShowEditJob(false)}
                  disabled={savingJob}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSubmit, savingJob && styles.modalSubmitDisabled]}
                  onPress={handleSaveJobDetails}
                  disabled={savingJob}
                >
                  {savingJob ? (
                    <ActivityIndicator size="small" color="#140E1D" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Save</Text>
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
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
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
  inlineErrorText: {
    color: "#FFD8DE",
    backgroundColor: "#2B161B",
    borderColor: "#8E4656",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  successText: {
    color: "#C8F7D2",
    backgroundColor: "#102619",
    borderColor: "#2F7A45",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  successBanner: {
    backgroundColor: "#102619",
    borderColor: "#2F7A45",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  successBannerText: {
    color: "#C8F7D2",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  errorBanner: {
    backgroundColor: "#2B161B",
    borderColor: "#8E4656",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: {
    color: "#FFD8DE",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  backBtn: {
    marginBottom: 16,
  },
  backBtnText: {
    color: "#B56CFF",
    fontSize: 15,
    fontWeight: "700",
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
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },
  title: {
    color: "#E7D9FF",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
    flex: 1,
    minWidth: 190,
  },
  budget: {
    color: "#B56CFF",
    fontSize: 18,
    fontWeight: "800",
    flexShrink: 0,
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
  cutoffText: {
    color: "#FFB347",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    marginTop: 6,
  },
  detailRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 6,
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
    flexShrink: 1,
    textAlign: "right",
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
    paddingHorizontal: 14,
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
  reportBtnDisabled: {
    opacity: 0.6,
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
  modalInputSingle: {
    backgroundColor: "#0E0A14",
    borderWidth: 1,
    borderColor: "#3A2B52",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#E7D9FF",
    fontSize: 15,
  },
  modalHint: {
    color: "#A590C9",
    fontSize: 12,
    lineHeight: 17,
    marginTop: -4,
  },
  applicationInput: {
    backgroundColor: "#0E0A14",
    borderWidth: 1,
    borderColor: "#3A2B52",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#E7D9FF",
    fontSize: 15,
    minHeight: 78,
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
  dateChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  dateChip: {
    backgroundColor: "#0E0A14",
    borderWidth: 1,
    borderColor: "#3A2B52",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateChipActive: {
    borderColor: "#B56CFF",
    backgroundColor: "#2A1E3D",
  },
  dateChipText: {
    color: "#A590C9",
    fontSize: 13,
    fontWeight: "800",
  },
  dateChipTextActive: {
    color: "#E7D9FF",
  },
  timeScroll: {
    marginTop: 10,
  },
  timeChip: {
    backgroundColor: "#0E0A14",
    borderWidth: 1,
    borderColor: "#3A2B52",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  timeChipActive: {
    borderColor: "#B56CFF",
    backgroundColor: "#2A1E3D",
  },
  timeChipText: {
    color: "#A590C9",
    fontSize: 13,
    fontWeight: "800",
  },
  timeChipTextActive: {
    color: "#E7D9FF",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#6E46A3",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: "#E7D9FF",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  modalCancel: {
    flex: 1,
    minWidth: 120,
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
    minWidth: 120,
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
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
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
  removeButton: {
    borderWidth: 1,
    borderColor: "#8E4656",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  removeButtonText: {
    color: "#FFB0B0",
    fontSize: 15,
    fontWeight: "800",
  },
  emptyText: {
    color: "#A590C9",
    fontSize: 14,
    textAlign: "center",
    marginVertical: 20,
  },
});
