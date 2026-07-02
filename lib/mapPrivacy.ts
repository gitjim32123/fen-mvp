import { geocodePostcodeArea, type PostcodePoint } from "./geocoding";
import { normalizePostcodeDistrict } from "./postcodeDistricts";
import type { Job } from "./types";

export type JobCoordinateAccess = "public_browse" | "poster_private" | "accepted_worker_private";

export type JobRoutePoint = {
  point: PostcodePoint;
  precision: "exact" | "approximate";
};

export type PublicBrowseJobPoint<T extends Job = Job> = {
  job: T;
  area: string;
  point: PostcodePoint;
};

export type GeocodeAreaFn = (area: string) => Promise<PostcodePoint | null>;

export const PUBLIC_BROWSE_COORDINATE_ACCESS: JobCoordinateAccess = "public_browse";

export function canUseExactJobCoordinates(access: JobCoordinateAccess) {
  return access === "poster_private" || access === "accepted_worker_private";
}

export function publicBrowseAreaFromJob(job: Job) {
  return normalizePostcodeDistrict((job as any).postcode_district) || normalizePostcodeDistrict(job.postcode);
}

export function sanitizeJobForPublicBrowse<T extends Job>(job: T): T {
  if (job.lat == null && job.lng == null) return job;
  return { ...job, lat: null, lng: null };
}

export function sanitizeJobsForPublicBrowse<T extends Job>(jobs: T[]): T[] {
  return jobs.map(sanitizeJobForPublicBrowse);
}

export async function preparePublicBrowseJobPoints<T extends Job>(
  jobs: T[],
  geocodeArea: GeocodeAreaFn = geocodePostcodeArea,
  limit = 80
): Promise<PublicBrowseJobPoint<T>[]> {
  const points: PublicBrowseJobPoint<T>[] = [];
  for (const job of jobs.filter(Boolean).slice(0, limit)) {
    const area = publicBrowseAreaFromJob(job);
    if (!area) continue;
    const point = await geocodeArea(area);
    if (point) points.push({ job, area, point });
  }
  return points;
}

function exactPointFromJob(job: Job): PostcodePoint | null {
  return isUsableCoordinate(job.lat, job.lng)
    ? { latitude: job.lat as number, longitude: job.lng as number }
    : null;
}

export async function resolveJobRoutePoint(job: Job, access: JobCoordinateAccess): Promise<JobRoutePoint | null> {
  // Public/open browse must never prefer exact job coordinates. Keep this
  // decision centralized so future map providers cannot accidentally expose
  // exact customer locations by reading jobs.lat/lng in browse flows.
  const exactPoint = canUseExactJobCoordinates(access) ? exactPointFromJob(job) : null;
  if (exactPoint) return { point: exactPoint, precision: "exact" };

  const jobArea = publicBrowseAreaFromJob(job);
  if (!jobArea) return null;
  const approximatePoint = await geocodePostcodeArea(jobArea);
  return approximatePoint ? { point: approximatePoint, precision: "approximate" } : null;
}

function isUsableCoordinate(latitude?: number | null, longitude?: number | null) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
