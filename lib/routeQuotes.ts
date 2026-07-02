import type { PostcodePoint } from "./geocoding";
import { getRouteAiAgentBaseUrl, isRouteQuotesEnabled, withRouteAiTimeout } from "./routeAiAgent";

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

export type RouteQuoteLeg = {
  mode?: string | null;
  distance_meters?: number | null;
  duration_seconds?: number | null;
  geometry?: string | null;
  route_id?: string | null;
  route_short_name?: string | null;
  route_long_name?: string | null;
  operator?: string | null;
  trip_id?: string | null;
  service_id?: string | null;
  from_stop_id?: string | null;
  from_stop_name?: string | null;
  to_stop_id?: string | null;
  to_stop_name?: string | null;
  realtime_status?: string | null;
};

export type RouteGeometryPoint = {
  latitude: number;
  longitude: number;
};

export type RoutePreviewGeometry = {
  source: "route_ai_agent";
  mode: RouteQuoteMode;
  points: RouteGeometryPoint[];
};

export type RouteQuoteOption = {
  route_id?: string;
  mode: RouteQuoteMode;
  status: RouteQuoteStatus;
  distance_meters?: number | null;
  duration_seconds?: number | null;
  legs?: RouteQuoteLeg[];
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
export { getRouteAiAgentBaseUrl, isRouteQuotesEnabled };

const MAX_DECODED_GEOMETRY_POINTS = 2000;
export const ROUTE_SERVICE_UNAVAILABLE_MESSAGE = "Route service unavailable";
export const BUS_OUTSIDE_SERVICE_PERIOD_MESSAGE = "Bus routes unavailable for this time";
export const PUBLIC_TRANSPORT_TIMETABLE_UNAVAILABLE_MESSAGE = "Public transport timetable unavailable";

export async function fetchRouteQuotes(
  origin: PostcodePoint,
  destination: PostcodePoint,
  modes: RouteQuoteMode[] = ROUTE_QUOTE_MODES
): Promise<RouteQuoteResponse> {
  const normalizedModes = normalizeModes(modes);
  try {
    return await requestRouteQuotes(origin, destination, normalizedModes);
  } catch (error) {
    if (normalizedModes.length === 1 && isTransitMode(normalizedModes[0]) && isTransitTimetableUnavailableError(error)) {
      return { routes: [unavailableTransitRoute(normalizedModes[0])] };
    }

    if (normalizedModes.length > 1 && normalizedModes.some(isTransitMode) && !isRouteServiceUnavailableError(error, errorMessage(error))) {
      const fallback = await requestRouteQuotesByMode(origin, destination, normalizedModes, error);
      if (fallback) return fallback;
    }

    throw new Error(routeQuoteFailureMessage(error));
  }
}

async function requestRouteQuotes(
  origin: PostcodePoint,
  destination: PostcodePoint,
  modes: RouteQuoteMode[]
): Promise<RouteQuoteResponse> {
  let response: Response;
  try {
    response = await withRouteAiTimeout(
      fetch(`${getRouteAiAgentBaseUrl()}/v1/routes/plan`, {
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
      }),
      "Route quote request"
    );
  } catch (error) {
    throw routeRequestErrorFromUnknown(error);
  }

  if (!response.ok) {
    const details = await responseErrorDetails(response);
    if (response.status === 0 || response.status >= 500) {
      throw new RouteRequestError(details.message || ROUTE_SERVICE_UNAVAILABLE_MESSAGE, response.status, details.code);
    }
    throw new RouteRequestError(details.message || `Route quote request failed with status ${response.status}.`, response.status, details.code);
  }

  const body = await response.json();
  if (!body || !Array.isArray(body.routes)) {
    throw new Error("Route quote response did not include routes.");
  }
  return { routes: body.routes.map(normalizeRouteQuoteOption) } as RouteQuoteResponse;
}

export function routeQuoteFailureMessage(error: unknown) {
  const message = errorMessage(error);
  if (isTransitTimetableUnavailableError(error)) return PUBLIC_TRANSPORT_TIMETABLE_UNAVAILABLE_MESSAGE;
  if (isRouteServiceUnavailableError(error, message)) return ROUTE_SERVICE_UNAVAILABLE_MESSAGE;
  return message || "Travel quotes could not be loaded.";
}

export function decodeEncodedPolyline(encoded?: string | null): RouteGeometryPoint[] {
  if (!encoded || typeof encoded !== "string") return [];
  const points: RouteGeometryPoint[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  try {
    while (index < encoded.length && points.length < MAX_DECODED_GEOMETRY_POINTS) {
      const decodedLat = decodePolylineValue(encoded, index);
      latitude += decodedLat.value;
      index = decodedLat.nextIndex;

      const decodedLon = decodePolylineValue(encoded, index);
      longitude += decodedLon.value;
      index = decodedLon.nextIndex;

      const point = {
        latitude: latitude / 100000,
        longitude: longitude / 100000,
      };
      if (isValidGeometryPoint(point)) points.push(point);
    }
  } catch {
    return [];
  }

  return points;
}

export function routeGeometryFromQuote(route?: RouteQuoteOption | null): RoutePreviewGeometry | null {
  if (!route || route.status !== "available" || !Array.isArray(route.legs)) return null;

  const points: RouteGeometryPoint[] = [];
  for (const leg of route.legs) {
    const legPoints = decodeEncodedPolyline(leg.geometry);
    for (const point of legPoints) {
      const previous = points[points.length - 1];
      if (!previous || previous.latitude !== point.latitude || previous.longitude !== point.longitude) {
        points.push(point);
      }
    }
  }

  return points.length >= 2 ? { source: "route_ai_agent", mode: route.mode, points } : null;
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
  return `\u00A3${(amount / 100).toFixed(2)}`;
}

export function routeQuoteStatusText(route: RouteQuoteOption) {
  if (isTransitTimetableUnavailableRoute(route)) {
    return route.mode === "bus" ? BUS_OUTSIDE_SERVICE_PERIOD_MESSAGE : PUBLIC_TRANSPORT_TIMETABLE_UNAVAILABLE_MESSAGE;
  }

  if (route.status === "available") {
    if (route.mode === "bus" && route.fare && route.fare.status !== "available") {
      return route.fare.reason || "Fare unavailable";
    }
    if (route.cost && route.cost.status !== "available") {
      return route.cost.warning || route.cost.explanation || "Cost unavailable";
    }
    return route.confidence === "HIGH" ? "Verified" : "Available";
  }

  if (route.mode === "bus") return "Bus route unavailable";
  return route.error?.message && !isOtpTransitMessage(route.error.message) ? route.error.message : "Route unavailable";
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

function decodePolylineValue(encoded: string, startIndex: number) {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte = 0;

  do {
    if (index >= encoded.length || shift > 30) {
      throw new Error("Invalid encoded polyline.");
    }
    byte = encoded.charCodeAt(index++) - 63;
    if (byte < 0) throw new Error("Invalid encoded polyline.");
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  const value = result & 1 ? ~(result >> 1) : result >> 1;
  return { value, nextIndex: index };
}

function isValidGeometryPoint(point: RouteGeometryPoint) {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function isRouteServiceUnavailableError(error: unknown, message: string) {
  if (error instanceof TypeError) return true;
  if (Object.prototype.toString.call(error) === "[object TypeError]") return true;
  return /route service unavailable|failed to fetch|network request failed|networkerror|load failed|connection refused|econnrefused|timed out/i.test(message);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

async function requestRouteQuotesByMode(
  origin: PostcodePoint,
  destination: PostcodePoint,
  modes: RouteQuoteMode[],
  originalError: unknown
): Promise<RouteQuoteResponse | null> {
  const routes: RouteQuoteOption[] = [];
  let hasAnyModeResult = false;

  for (const mode of modes) {
    try {
      const response = await requestRouteQuotes(origin, destination, [mode]);
      routes.push(...response.routes);
      hasAnyModeResult = true;
    } catch (error) {
      if (isTransitMode(mode) && isTransitTimetableUnavailableError(error)) {
        routes.push(unavailableTransitRoute(mode));
        hasAnyModeResult = true;
        continue;
      }
      if (isRouteServiceUnavailableError(error, errorMessage(error))) {
        continue;
      }
      routes.push({
        mode,
        status: "unavailable",
        error: { message: "Route unavailable" },
      });
      hasAnyModeResult = true;
    }
  }

  if (!hasAnyModeResult || routes.length === 0) {
    if (isTransitTimetableUnavailableError(originalError)) {
      return {
        routes: modes.map((mode) =>
          isTransitMode(mode)
            ? unavailableTransitRoute(mode)
            : { mode, status: "unavailable", error: { message: "Route unavailable" } }
        ),
      };
    }
    return null;
  }

  return { routes };
}

function normalizeModes(modes: RouteQuoteMode[]) {
  const unique = Array.from(new Set(modes.filter(Boolean)));
  return unique.length > 0 ? unique : ROUTE_QUOTE_MODES;
}

function normalizeRouteQuoteOption(route: RouteQuoteOption): RouteQuoteOption {
  if (isTransitTimetableUnavailableRoute(route)) {
    return unavailableTransitRoute(route.mode);
  }
  return route;
}

function unavailableTransitRoute(mode: RouteQuoteMode): RouteQuoteOption {
  return {
    mode,
    status: "unavailable",
    error: {
      code: "OUTSIDE_SERVICE_PERIOD",
      message: mode === "bus" ? BUS_OUTSIDE_SERVICE_PERIOD_MESSAGE : PUBLIC_TRANSPORT_TIMETABLE_UNAVAILABLE_MESSAGE,
    },
  };
}

function isTransitMode(mode: RouteQuoteMode) {
  return mode === "bus";
}

function isTransitTimetableUnavailableRoute(route?: RouteQuoteOption | null) {
  if (!route || !isTransitMode(route.mode)) return false;
  return isTransitTimetableUnavailableCode(route.error?.code) || isOtpTransitMessage(route.error?.message);
}

export function isTransitTimetableUnavailableError(error: unknown) {
  if (error instanceof RouteRequestError && isTransitTimetableUnavailableCode(error.code)) return true;
  const message = errorMessage(error);
  if (isOtpTransitMessage(message)) return true;
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" && isTransitTimetableUnavailableCode(code);
  }
  return false;
}

function isTransitTimetableUnavailableCode(code?: string | null) {
  return code === "OUTSIDE_SERVICE_PERIOD";
}

function isOtpTransitMessage(message?: string | null) {
  return /outside_service_period|no transit times available|too far in the future|may be past/i.test(message || "");
}

async function responseErrorDetails(response: Response): Promise<{ code?: string; message?: string }> {
  try {
    if (typeof response.json === "function") {
      const body = await response.json();
      const code = stringValue(body?.error?.code) || stringValue(body?.code);
      const message = stringValue(body?.error?.message) || stringValue(body?.message) || stringValue(body?.detail);
      return { code, message };
    }
  } catch {
    // Fall back to response text below when available.
  }

  try {
    if (typeof response.text === "function") {
      const text = await response.text();
      return { message: text };
    }
  } catch {
    // Ignore body parsing failures; the status still drives fallback behavior.
  }

  return {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function routeRequestErrorFromUnknown(error: unknown) {
  if (error instanceof RouteRequestError) return error;
  return new RouteRequestError(routeQuoteFailureMessage(error));
}

class RouteRequestError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "RouteRequestError";
    this.status = status;
    this.code = code;
  }
}
