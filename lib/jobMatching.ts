import type { PostcodePoint } from "./geocoding";
import {
  formatHourlyRate,
  formatPence,
  formatSecondsAsMinutes,
  type ProfitabilityAnalysis,
} from "./profitability";
import {
  getJobMatchingTaskDurationMinutes,
  getRouteAiAgentBaseUrl,
  isJobMatchingEnabled,
  withRouteAiTimeout,
} from "./routeAiAgent";
import { isTransitTimetableUnavailableError, routeQuoteFailureMessage } from "./routeQuotes";

export type JobMatchingMode = "walk" | "bicycle" | "car" | "bus";
export type JobMatchStatus = "available" | "partial" | "unavailable";
export type JobMatchRecommendation = "accept" | "borderline" | "reject" | "unavailable";

export type MatchCandidateInput = {
  jobId: string;
  pricePence: number;
  taskDurationMinutes: number;
  location: PostcodePoint;
  startsAt: string;
};

export type JobMatchResult = {
  rank: number;
  job_id: string;
  status: JobMatchStatus;
  recommendation: JobMatchRecommendation;
  best_mode?: JobMatchingMode | null;
  score: number;
  profitability?: ProfitabilityAnalysis | null;
  reason: string;
  timing_kind?: "confirmed" | "provisional";
  timing_label?: string;
};

export type JobMatchResponse = {
  status: JobMatchStatus;
  ranked_jobs: JobMatchResult[];
};

export type JobMatchRequestKeyInput = {
  jobId: string;
  origin: PostcodePoint;
  destination: PostcodePoint;
  timingKind: "confirmed" | "provisional";
  startsAt: string;
  pricePence: number;
  taskDurationMinutes: number;
};

export const JOB_MATCHING_MODES: JobMatchingMode[] = ["walk", "bicycle", "car", "bus"];
const NON_TRANSIT_JOB_MATCHING_MODES: JobMatchingMode[] = ["walk", "bicycle", "car"];
const SUMMARY_SEPARATOR = " \u00B7 ";

export { getJobMatchingTaskDurationMinutes, isJobMatchingEnabled };

export async function fetchJobMatches(
  workerLocation: PostcodePoint,
  jobs: MatchCandidateInput[]
): Promise<JobMatchResponse> {
  try {
    return await requestJobMatches(workerLocation, jobs, JOB_MATCHING_MODES);
  } catch (error) {
    if (isTransitTimetableUnavailableError(error)) {
      return requestJobMatches(workerLocation, jobs, NON_TRANSIT_JOB_MATCHING_MODES);
    }
    throw new Error(routeQuoteFailureMessage(error));
  }
}

async function requestJobMatches(
  workerLocation: PostcodePoint,
  jobs: MatchCandidateInput[],
  modes: JobMatchingMode[]
): Promise<JobMatchResponse> {
  const response = await withRouteAiTimeout(fetch(`${getRouteAiAgentBaseUrl()}/v1/jobs/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      worker: {
        current_location: { lat: workerLocation.latitude, lon: workerLocation.longitude },
      },
      jobs: jobs.slice(0, 25).map((job) => ({
        job_id: job.jobId,
        price_pence: job.pricePence,
        task_duration_minutes: job.taskDurationMinutes,
        location: { lat: job.location.latitude, lon: job.location.longitude },
        starts_at: job.startsAt,
      })),
      travel: {
        modes,
        return_journey: false,
      },
    }),
  }), "Job matching request");

  if (!response.ok) {
    const details = await responseErrorDetails(response);
    throw Object.assign(
      new Error(details.message || `Job matching request failed with status ${response.status}.`),
      { status: response.status, code: details.code }
    );
  }

  const body = await response.json();
  if (!body || !Array.isArray(body.ranked_jobs)) {
    throw new Error("Job matching response did not include ranked jobs.");
  }
  return body as JobMatchResponse;
}

async function responseErrorDetails(response: Response): Promise<{ code?: string; message?: string }> {
  try {
    if (typeof response.json === "function") {
      const body = await response.json();
      return {
        code: stringValue(body?.error?.code) || stringValue(body?.code),
        message: stringValue(body?.error?.message) || stringValue(body?.message) || stringValue(body?.detail),
      };
    }
  } catch {
    // Fall through to text.
  }

  try {
    if (typeof response.text === "function") return { message: await response.text() };
  } catch {
    // Ignore body parsing failures.
  }

  return {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function recommendationLabel(value?: JobMatchRecommendation | null) {
  switch (value) {
    case "accept":
      return "Accept";
    case "borderline":
      return "Borderline";
    case "reject":
      return "Reject";
    case "unavailable":
      return "Unavailable";
    default:
      return "Unavailable";
  }
}

export function recommendationTier(match?: JobMatchResult | null) {
  if (!match || match.status === "unavailable" || match.recommendation === "unavailable") {
    return "Unavailable";
  }
  if (match.recommendation === "accept" && match.status === "available") {
    return "Highly Recommended";
  }
  if (match.recommendation === "accept") {
    return "Recommended";
  }
  if (match.recommendation === "borderline") {
    return "Worth Considering";
  }
  return "Low Value";
}

export function modeLabel(value?: JobMatchingMode | null) {
  switch (value) {
    case "walk":
      return "Walk";
    case "bicycle":
      return "Bicycle";
    case "car":
      return "Car";
    case "bus":
      return "Bus";
    default:
      return "Unavailable";
  }
}

export function formatMatchScore(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return value.toFixed(1);
}

export function formatMatchHourlyRate(match?: JobMatchResult | null) {
  return formatHourlyRate(match?.profitability?.effective_hourly_rate_pence);
}

export function formatMatchTravelTime(match?: JobMatchResult | null) {
  return formatSecondsAsMinutes(match?.profitability?.outbound_travel_seconds);
}

export function formatMatchProfitabilitySummary(match?: JobMatchResult | null) {
  const profitability = match?.profitability;
  if (!profitability) return "Profitability unavailable";

  return [
    `Travel ${formatSecondsAsMinutes(profitability.outbound_travel_seconds)}`,
    `Cost ${formatPence(profitability.travel_cost_pence)}`,
    `Net ${formatPence(profitability.net_earnings_pence)}`,
    `Rate ${formatHourlyRate(profitability.effective_hourly_rate_pence)}`,
  ].join(SUMMARY_SEPARATOR);
}

export function buildJobMatchRequestKey(input: JobMatchRequestKeyInput) {
  return [
    input.jobId,
    coordinateKey(input.origin.latitude),
    coordinateKey(input.origin.longitude),
    coordinateKey(input.destination.latitude),
    coordinateKey(input.destination.longitude),
    input.timingKind,
    input.startsAt,
    String(input.pricePence),
    String(input.taskDurationMinutes),
  ].join("|");
}

export function orderJobsByMatch<T extends { id: string }>(
  jobs: T[],
  matchesByJobId: Record<string, JobMatchResult>
) {
  const ranked = jobs
    .filter((job) => matchesByJobId[job.id])
    .sort((left, right) => matchesByJobId[left.id].rank - matchesByJobId[right.id].rank);
  const unranked = jobs.filter((job) => !matchesByJobId[job.id]);
  return [...ranked, ...unranked];
}

function coordinateKey(value: number) {
  return Number.isFinite(value) ? value.toFixed(6) : "unknown";
}
