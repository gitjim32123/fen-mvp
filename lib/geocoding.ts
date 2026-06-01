import type { TransportMode } from "./types";
import { normalizePostcodeDistrict } from "./postcodeDistricts";

export type PostcodePoint = {
  latitude: number;
  longitude: number;
};

export const DEFAULT_COMMITMENT_BUFFER_MINUTES = 45;
export const COMMITMENT_GRACE_MINUTES = 15;
export const COMMITMENT_ESTIMATE_VERSION = "fen-outcode-v1";

export function roundToFive(value: number) {
  return Math.max(5, Math.round(value / 5) * 5);
}

export async function geocodePostcode(postcode: string): Promise<PostcodePoint | null> {
  const clean = postcode.trim();
  if (!clean || clean.toUpperCase() === "N/A") return null;

  try {
    const compact = clean.replace(/\s+/g, "").toUpperCase();
    const isOutcode = /^[A-Z]{1,2}\d[A-Z\d]?$/.test(compact);
    const path = isOutcode ? "outcodes" : "postcodes";
    const response = await fetch(`https://api.postcodes.io/${path}/${encodeURIComponent(clean)}`);
    if (!response.ok) return null;
    const json = await response.json();
    const result = json?.result;
    if (typeof result?.latitude !== "number" || typeof result?.longitude !== "number") return null;
    return { latitude: result.latitude, longitude: result.longitude };
  } catch {
    return null;
  }
}

export async function geocodePostcodeArea(postcode: string): Promise<PostcodePoint | null> {
  const district = normalizePostcodeDistrict(postcode);
  return district ? geocodePostcode(district) : null;
}

export async function getCurrentGpsPoint(): Promise<PostcodePoint | null> {
  const geolocation = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
  if (!geolocation) return null;

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (typeof latitude === "number" && typeof longitude === "number") {
          resolve({ latitude, longitude });
        } else {
          resolve(null);
        }
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 3000, maximumAge: 10 * 60 * 1000 }
    );
  });
}


export function estimateMiles(a: PostcodePoint, b: PostcodePoint) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthMiles = 3958.8;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const straightLineMiles = earthMiles * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return straightLineMiles * 1.3;
}

export function estimateTravelMinutes(miles: number, mode: TransportMode = "unspecified") {
  const mph =
    mode === "walk" ? 3 :
    mode === "cycle" ? 10 :
    mode === "drive" ? 20 :
    mode === "public_transport" ? 14 :
    20;
  return Math.max(10, Math.ceil((miles / mph) * 60 / 5) * 5);
}

export function formatTransportMode(mode: TransportMode = "unspecified") {
  switch (mode) {
    case "walk":
      return "walking";
    case "cycle":
      return "bike";
    case "drive":
      return "car";
    case "public_transport":
      return "public transport";
    default:
      return "local travel";
  }
}

export function getDistanceRange(miles: number) {
  const safeMiles = Math.max(0, miles);
  const minimum = Math.max(1, Math.floor((safeMiles * 0.85) / 1) * 1);
  const maximum = Math.max(minimum + 1, Math.ceil((safeMiles * 1.2) / 1) * 1);
  return { minimum, maximum };
}

export function getTravelMinutesRange(miles: number, mode: TransportMode = "unspecified") {
  const minutes = estimateTravelMinutes(miles, mode);
  const minimum = Math.max(10, Math.floor((minutes * 0.8) / 5) * 5);
  const maximum = Math.max(minimum + 5, Math.ceil((minutes * 1.3) / 5) * 5);
  return { minimum, maximum };
}

export function formatDistanceRange(miles: number) {
  const range = getDistanceRange(miles);
  return `Approx. ${range.minimum}-${range.maximum} miles`;
}

export function formatTravelTimeRange(miles: number, mode: TransportMode = "unspecified") {
  const range = getTravelMinutesRange(miles, mode);
  return `Approx. ${range.minimum}-${range.maximum} min by ${formatTransportMode(mode)}`;
}

export function getCommitmentBufferMinutes(travelMinutes?: number | null) {
  if (typeof travelMinutes !== "number" || !Number.isFinite(travelMinutes) || travelMinutes <= 0) {
    return DEFAULT_COMMITMENT_BUFFER_MINUTES;
  }
  return travelMinutes + COMMITMENT_GRACE_MINUTES;
}

export function calculateCommitmentWindowStart(startTime?: string | null, travelMinutes?: number | null) {
  if (!startTime) return null;
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() - getCommitmentBufferMinutes(travelMinutes) * 60 * 1000);
}

export function getTravelEstimateUnavailableText() {
  return "Travel estimate unavailable until both postcode areas are known.";
}
