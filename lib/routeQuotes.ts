import Constants from "expo-constants";

import type { PostcodePoint } from "./geocoding";

export type RouteQuoteMode = "walk" | "bicycle" | "car" | "bus";
export type RouteQuoteStatus = "available" | "unavailable" | "failed" | "unsupported";

export type RouteQuoteCost = {
  status?: string;
  amount_pence?: number | null;
  currency?: string | null;
  explanation?: string | null;
  warning?: string | null;
};

export type RouteQuoteFare = {
  status?: string;
  amount_pence?: number | null;
  currency?: string | null;
  reason?: string | null;
};

export type RouteQuoteOption = {
  route_id?: string;
  mode: RouteQuoteMode;
  status: RouteQuoteStatus;
  distance_meters?: number | null;
  duration_seconds?: number | null;
  cost?: RouteQuoteCost | null;
  fare?: RouteQuoteFare | null;
  confidence?: string | null;
  error?: {
    code?: string;
    message?: string;
  } | null;
};

export type RouteQuoteResponse = {
  routes: RouteQuoteOption[];
};

export const ROUTE_QUOTE_MODES: RouteQuoteMode[] = ["walk", "bicycle", "car", "bus"];

const DEFAULT_ROUTE_AI_AGENT_BASE_URL = "http://localhost:8000";

function envValue(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value === "string" && value.trim()) return value.trim();

  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const extraValue = extra?.[name];
  if (typeof extraValue === "boolean") return String(extraValue);
  if (typeof extraValue === "string" && extraValue.trim()) return extraValue.trim();
  return undefined;
}

export function isRouteQuotesEnabled() {
  const value =
    envValue("EXPO_PUBLIC_ENABLE_ROUTE_QUOTES") ||
    envValue("ENABLE_ROUTE_QUOTES") ||
    "false";
  return value.toLowerCase() === "true";
}

export function getRouteAiAgentBaseUrl() {
  const configured =
    envValue("EXPO_PUBLIC_ROUTE_AI_AGENT_BASE_URL") ||
    envValue("ROUTE_AI_AGENT_BASE_URL") ||
    DEFAULT_ROUTE_AI_AGENT_BASE_URL;
  return configured.replace(/\/+$/, "");
}

export async function fetchRouteQuotes(
  origin: PostcodePoint,
  destination: PostcodePoint,
  modes: RouteQuoteMode[] = ROUTE_QUOTE_MODES
): Promise<RouteQuoteResponse> {
  const response = await fetch(`${getRouteAiAgentBaseUrl()}/v1/routes/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      origin: { lat: origin.latitude, lon: origin.longitude },
      destination: { lat: destination.latitude, lon: destination.longitude },
      time: { mode: "depart_at", at: new Date().toISOString() },
      modes,
    }),
  });

  if (!response.ok) {
    throw new Error(`Route quote request failed with status ${response.status}.`);
  }

  const body = await response.json();
  if (!body || !Array.isArray(body.routes)) {
    throw new Error("Route quote response did not include routes.");
  }
  return body as RouteQuoteResponse;
}

export function formatRouteQuoteDuration(seconds?: number | null) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function formatRouteQuoteDistance(meters?: number | null) {
  if (typeof meters !== "number" || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km.toFixed(km >= 10 ? 0 : 1)} km`;
}

export function formatRouteQuoteCost(route: RouteQuoteOption) {
  const directCost =
    route.cost?.status === "available" && typeof route.cost.amount_pence === "number"
      ? route.cost.amount_pence
      : null;
  const verifiedFare =
    route.fare?.status === "available" && typeof route.fare.amount_pence === "number"
      ? route.fare.amount_pence
      : null;
  const amount = directCost ?? verifiedFare;

  if (amount == null || !Number.isFinite(amount)) return null;
  if (amount <= 0) return "Free";
  return `£${(amount / 100).toFixed(2)}`;
}

export function routeQuoteStatusText(route: RouteQuoteOption) {
  if (route.status === "available") {
    if (route.mode === "bus" && route.fare && route.fare.status !== "available") {
      return route.fare.reason || "Fare unavailable";
    }
    if (route.cost && route.cost.status !== "available") {
      return route.cost.warning || route.cost.explanation || "Cost unavailable";
    }
    return route.confidence === "HIGH" ? "Verified" : "Available";
  }

  return route.error?.message || "Route unavailable";
}

export function routeQuoteDisplayName(mode: RouteQuoteMode) {
  switch (mode) {
    case "walk":
      return "Walk";
    case "bicycle":
      return "Bicycle";
    case "car":
      return "Car";
    case "bus":
      return "Bus";
  }
}
