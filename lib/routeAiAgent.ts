import Constants from "expo-constants";

const DEFAULT_ROUTE_AI_AGENT_BASE_URL = "http://localhost:8000";
const DEFAULT_ROUTE_AI_TIMEOUT_MS = 15000;

export function routeAiEnvValue(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value === "string" && value.trim()) return value.trim();

  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const extraValue = extra?.[name];
  if (typeof extraValue === "boolean") return String(extraValue);
  if (typeof extraValue === "number" && Number.isFinite(extraValue)) return String(extraValue);
  if (typeof extraValue === "string" && extraValue.trim()) return extraValue.trim();
  return undefined;
}

export function routeAiFlagEnabled(publicName: string, privateName: string) {
  const value = routeAiEnvValue(publicName) || routeAiEnvValue(privateName) || "false";
  return value.toLowerCase() === "true";
}

export function isRouteQuotesEnabled() {
  return routeAiFlagEnabled("EXPO_PUBLIC_ENABLE_ROUTE_QUOTES", "ENABLE_ROUTE_QUOTES");
}

export function isProfitabilityEnabled() {
  return routeAiFlagEnabled("EXPO_PUBLIC_ENABLE_PROFITABILITY", "ENABLE_PROFITABILITY");
}

export function isJobMatchingEnabled() {
  return routeAiFlagEnabled("EXPO_PUBLIC_ENABLE_JOB_MATCHING", "ENABLE_JOB_MATCHING");
}

export function getRouteAiAgentBaseUrl() {
  const configured =
    routeAiEnvValue("EXPO_PUBLIC_ROUTE_AI_AGENT_BASE_URL") ||
    routeAiEnvValue("ROUTE_AI_AGENT_BASE_URL") ||
    DEFAULT_ROUTE_AI_AGENT_BASE_URL;
  return configured.replace(/\/+$/, "");
}

export function getProfitabilityTaskDurationMinutes() {
  const raw =
    routeAiEnvValue("EXPO_PUBLIC_PROFITABILITY_TASK_DURATION_MINUTES") ||
    routeAiEnvValue("PROFITABILITY_TASK_DURATION_MINUTES");
  if (!raw) return null;

  const minutes = Number(raw);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null;
}

export function getJobMatchingTaskDurationMinutes() {
  const raw =
    routeAiEnvValue("EXPO_PUBLIC_JOB_MATCHING_TASK_DURATION_MINUTES") ||
    routeAiEnvValue("JOB_MATCHING_TASK_DURATION_MINUTES");
  if (raw) {
    const minutes = Number(raw);
    return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null;
  }
  return getProfitabilityTaskDurationMinutes();
}

export function withRouteAiTimeout<T>(
  request: Promise<T>,
  label = "Route service request",
  timeoutMs = DEFAULT_ROUTE_AI_TIMEOUT_MS
): Promise<T> {
  if (typeof setTimeout !== "function" || typeof clearTimeout !== "function") return request;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out.`));
    }, timeoutMs);
  });

  return Promise.race([request, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}
