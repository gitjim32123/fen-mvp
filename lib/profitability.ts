import type { PostcodePoint } from "./geocoding";
import type { RouteQuoteMode } from "./routeQuotes";
import {
  getProfitabilityTaskDurationMinutes,
  getRouteAiAgentBaseUrl,
  isProfitabilityEnabled,
  withRouteAiTimeout,
} from "./routeAiAgent";
import type { TransportMode } from "./types";

export type ProfitabilityStatus = "available" | "partial" | "unavailable";
export type ProfitabilityRecommendation = "accept" | "borderline" | "reject" | "unavailable";

export type ProfitabilityAnalysis = {
  status: ProfitabilityStatus;
  recommendation: ProfitabilityRecommendation;
  job_price_pence: number;
  travel_cost_pence?: number | null;
  round_trip_cost_pence?: number | null;
  net_earnings_pence?: number | null;
  task_duration_seconds: number;
  outbound_travel_seconds?: number | null;
  return_travel_seconds?: number | null;
  total_time_commitment_seconds?: number | null;
  effective_hourly_rate_pence?: number | null;
  confidence?: string | null;
  reason: string;
  error?: {
    code?: string;
    message?: string;
  } | null;
};

export type ProfitabilityRequestInput = {
  jobPricePence: number;
  taskDurationMinutes: number;
  jobLocation: PostcodePoint;
  startsAt: string;
  workerLocation: PostcodePoint;
  mode: RouteQuoteMode;
};

export type ProfitabilityRequestKeyInput = {
  jobId: string;
  originLat?: number | null;
  originLon?: number | null;
  destinationLat?: number | null;
  destinationLon?: number | null;
  startsAt?: string | null;
  jobPricePence?: number | null;
  taskDurationMinutes?: number | null;
  mode?: RouteQuoteMode | null;
};

export { getProfitabilityTaskDurationMinutes, isProfitabilityEnabled };

export function mapTransportModeToProfitabilityMode(mode?: TransportMode | string | null): RouteQuoteMode | null {
  switch (mode) {
    case "walk":
      return "walk";
    case "cycle":
      return "bicycle";
    case "drive":
      return "car";
    case "public_transport":
      return "bus";
    default:
      return null;
  }
}

function formatKeyNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(6) : "";
}

export function buildProfitabilityRequestKey(input: ProfitabilityRequestKeyInput) {
  return [
    input.jobId,
    formatKeyNumber(input.originLat),
    formatKeyNumber(input.originLon),
    formatKeyNumber(input.destinationLat),
    formatKeyNumber(input.destinationLon),
    input.startsAt || "",
    input.jobPricePence ?? "",
    input.taskDurationMinutes ?? "",
    input.mode || "",
  ].join("|");
}

export async function fetchJobProfitability(input: ProfitabilityRequestInput): Promise<ProfitabilityAnalysis> {
  const response = await withRouteAiTimeout(fetch(`${getRouteAiAgentBaseUrl()}/v1/jobs/profitability/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      job: {
        price_pence: input.jobPricePence,
        task_duration_minutes: input.taskDurationMinutes,
        location: { lat: input.jobLocation.latitude, lon: input.jobLocation.longitude },
        starts_at: input.startsAt,
      },
      worker: {
        current_location: { lat: input.workerLocation.latitude, lon: input.workerLocation.longitude },
      },
      travel: {
        mode: input.mode,
        return_journey: false,
      },
    }),
  }), "Profitability request");

  if (!response.ok) {
    throw new Error(`Profitability request failed with status ${response.status}.`);
  }

  const body = await response.json();
  if (!body || typeof body.status !== "string") {
    throw new Error("Profitability response did not include an analysis status.");
  }
  return body as ProfitabilityAnalysis;
}

export function formatPence(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return `\u00A3${(value / 100).toFixed(2)}`;
}

export function formatHourlyRate(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return `\u00A3${(value / 100).toFixed(2)}/hr`;
}

export function formatSecondsAsMinutes(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return `${Math.max(1, Math.round(value / 60))} min`;
}

export function profitabilityStatusLabel(analysis?: ProfitabilityAnalysis | null) {
  if (!analysis) return "Unavailable";
  if (analysis.status === "available" && analysis.confidence === "HIGH") return "Verified";
  if (analysis.status === "available") return "Available";
  if (analysis.status === "partial") return "Partial";
  return "Unavailable";
}
