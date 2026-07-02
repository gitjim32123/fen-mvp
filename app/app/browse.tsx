import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import * as Linking from "expo-linking";
import { router, useFocusEffect } from "expo-router";
import { getJobsNearby } from "../../lib/jobs";
import type { Job, TransportMode } from "../../lib/types";
import { getProfile } from "../../lib/auth";
import { estimateMiles, formatDistanceRange, formatTravelTimeRange, geocodePostcodeArea, getCurrentGpsPoint, getTravelEstimateUnavailableText, type PostcodePoint } from "../../lib/geocoding";
import JobCard from "../../components/jobs/JobCard";
import StatusChip from "../../components/jobs/StatusChip";
import BrowseMap from "../../components/jobs/BrowseMap";
import { EmptyState, FeedbackNotice, InfoMetric, LoadingState, PageHeader, TrustBanner } from "../../components/ui/Premium";
import { CATEGORY_OPTIONS, normalizeCategory } from "../../lib/categories";
import { normalizePostcodeDistrict } from "../../lib/postcodeDistricts";
import { useTheme } from "../../components/ui/ThemeProvider";
import type { Theme } from "../../components/ui/theme";
import {
  fetchJobMatches,
  getJobMatchingTaskDurationMinutes,
  isJobMatchingEnabled,
  orderJobsByMatch,
  type JobMatchResult,
} from "../../lib/jobMatching";
import { getJobRouteTiming, matchingTimingNotice, type JobRouteTiming } from "../../lib/jobTiming";
import {
  PUBLIC_BROWSE_COORDINATE_ACCESS,
  resolveJobRoutePoint,
  sanitizeJobsForPublicBrowse,
} from "../../lib/mapPrivacy";
import {
  fetchRouteQuotes,
  formatRouteQuoteDistance,
  formatRouteQuoteDuration,
  isRouteQuotesEnabled,
  routeQuoteFailureMessage,
  routeGeometryFromQuote,
  type RoutePreviewGeometry,
  type RouteQuoteMode,
} from "../../lib/routeQuotes";

const DISTANCE_OPTIONS = [2, 5, 10];

type RoutePreviewSummary = {
  distance?: string | null;
  time?: string | null;
  mode: RouteQuoteMode;
  locationPrecision: "exact" | "approximate";
};

function urgencyFromJob(job: Job): "Need now" | "Today" | "Flexible" {
  return job.urgency;
}

function budgetFromJob(job: Job): string {
  return `£${job.budget_gbp}`;
}

function statusFromJob(job: Job): string {
  switch (job.status) {
    case "held": return "Held";
    case "confirm_pending": return "Confirm pending";
    case "in_progress": return "In progress";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    default: return "Open";
  }
}

function areaFromJob(job: Job): string {
  return normalizePostcodeDistrict((job as any).postcode_district) || normalizePostcodeDistrict(job.postcode) || "Local";
}

function normalizeFilterValue(value?: string | null): string {
  if (!value?.trim()) return "";
  return normalizeCategory(value).trim().toLowerCase();
}

function distanceFromJob(job: Job): string {
  return getTravelEstimateUnavailableText();
}

function travelTimeFromJob(job: Job): string {
  return getTravelEstimateUnavailableText();
}

function routeModeFromTransportMode(mode?: TransportMode | string | null): RouteQuoteMode {
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
      return "walk";
  }
}

function routePreviewRequestKey(
  job: Job,
  mode: RouteQuoteMode,
  origin: PostcodePoint,
  destination: PostcodePoint,
  precision: "exact" | "approximate"
) {
  return [
    job.id,
    mode,
    coordinateKey(origin.latitude),
    coordinateKey(origin.longitude),
    coordinateKey(destination.latitude),
    coordinateKey(destination.longitude),
    precision,
  ].join("|");
}

function coordinateKey(value: number) {
  return Number.isFinite(value) ? value.toFixed(6) : "unknown";
}

export default function BrowseScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<"Need now" | "Today" | "Flexible" | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [distanceFilterMiles, setDistanceFilterMiles] = useState<number | null>(null);
  const [travelByJobId, setTravelByJobId] = useState<Record<string, { distance: string; time: string; miles: number }>>({});
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matchingNotice, setMatchingNotice] = useState<string | null>(null);
  const [matchesByJobId, setMatchesByJobId] = useState<Record<string, JobMatchResult>>({});
  const [selectedMapJobId, setSelectedMapJobId] = useState<string | null>(null);
  const [workerMapArea, setWorkerMapArea] = useState<string | null>(null);
  const [workerRouteMode, setWorkerRouteMode] = useState<RouteQuoteMode>("walk");
  const [routeGeometryByJobId, setRouteGeometryByJobId] = useState<Record<string, RoutePreviewGeometry | undefined>>({});
  const [routePreviewByJobId, setRoutePreviewByJobId] = useState<Record<string, RoutePreviewSummary | undefined>>({});
  const routePreviewKeysRef = useRef<Record<string, string>>({});
  const latestRoutePreviewRequestRef = useRef(0);

  const matchingEnabled = isJobMatchingEnabled();
  const routeQuotesEnabled = isRouteQuotesEnabled();

  const loadJobs = useCallback(async (active = true, showSpinner = true) => {
      try {
        if (showSpinner) setLoading(true);
        setErrorText(null);
        const data = sanitizeJobsForPublicBrowse(await getJobsNearby());
        if (!active) return;
        setJobs(data);

        const profile = await getProfile().catch(() => null);
        const transportMode = profile?.transport_mode || "unspecified";
        if (active) setWorkerRouteMode(routeModeFromTransportMode(transportMode));

        const profilePostcode = profile?.postcode?.trim();
        if (active) setWorkerMapArea(normalizePostcodeDistrict(profilePostcode));
        const fromPoint = profilePostcode ? await geocodePostcodeArea(profilePostcode) : null;
        if (!fromPoint || !active) return;

        const estimates: Record<string, { distance: string; time: string; miles: number }> = {};
        for (const job of data) {
          const jobPostcode = normalizePostcodeDistrict((job as any).postcode_district) || normalizePostcodeDistrict(job.postcode);
          if (!jobPostcode) continue;
          const toPoint = await geocodePostcodeArea(jobPostcode);
          if (!toPoint || !active) continue;
          const miles = estimateMiles(fromPoint, toPoint);
          estimates[job.id] = {
            distance: `${formatDistanceRange(miles)} from your profile area`,
            time: `${formatTravelTimeRange(miles, transportMode)}. Based on postcode areas.`,
            miles,
          };
        }
        if (active) setTravelByJobId(estimates);
      } catch (err: any) {
        if (!active) return;
        setErrorText(err?.message || "Could not load jobs.");
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

  useEffect(() => {
    let active = true;
    const timer = setInterval(() => {
      loadJobs(active, false);
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loadJobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const activeUrgency = normalizeFilterValue(urgencyFilter);
    const activeCategory = normalizeFilterValue(categoryFilter);
    return jobs.filter(
      (j) => {
        const jobCategory = normalizeFilterValue(j.category || "General");
        const jobUrgency = normalizeFilterValue(j.urgency);
        return (
          j.status === "open" &&
          (!activeUrgency || jobUrgency === activeUrgency) &&
          (!activeCategory || jobCategory === activeCategory) &&
          (!distanceFilterMiles || travelByJobId[j.id]?.miles == null || travelByJobId[j.id].miles <= distanceFilterMiles) &&
          (!q ||
            j.title.toLowerCase().includes(q) ||
            (j.description || "").toLowerCase().includes(q) ||
            areaFromJob(j).toLowerCase().includes(q) ||
            jobCategory.includes(q))
        );
      }
    ).sort((a, b) => {
      const aMiles = travelByJobId[a.id]?.miles;
      const bMiles = travelByJobId[b.id]?.miles;
      if (typeof aMiles === "number" && typeof bMiles === "number") return aMiles - bMiles;
      if (typeof aMiles === "number") return -1;
      if (typeof bMiles === "number") return 1;
      return 0;
    });
  }, [jobs, search, urgencyFilter, categoryFilter, distanceFilterMiles, travelByJobId]);

  useEffect(() => {
    if (!matchingEnabled) {
      setMatchingLoading(false);
      setMatchingError(null);
      setMatchingNotice(null);
      setMatchesByJobId({});
      return;
    }

    let active = true;

    async function loadMatches() {
      try {
        setMatchingLoading(true);
        setMatchingError(null);
        setMatchingNotice(null);
        setMatchesByJobId({});

        const taskDurationMinutes = getJobMatchingTaskDurationMinutes();
        if (!taskDurationMinutes) {
          setMatchingNotice("Best jobs unavailable until a matching task duration is configured.");
          return;
        }

        const profile = await getProfile().catch(() => null);
        const workerGps = await getCurrentGpsPoint();
        const workerProfilePoint = profile?.postcode ? await geocodePostcodeArea(profile.postcode) : null;
        const workerLocation = workerGps || workerProfilePoint;
        if (!active) return;
        if (!workerLocation) {
          setMatchingNotice("Best jobs unavailable until your current location or profile area is available.");
          return;
        }

        const candidates = [];
        const timingByJobId: Record<string, JobRouteTiming> = {};
        let hasProvisionalTiming = false;
        for (const job of filtered.slice(0, 25)) {
          const timing = getJobRouteTiming(job);
          const jobPricePence = Math.round(Number(job.budget_gbp) * 100);
          const jobPostcode = normalizePostcodeDistrict((job as any).postcode_district) || normalizePostcodeDistrict(job.postcode);
          if (!Number.isFinite(jobPricePence) || jobPricePence <= 0 || !jobPostcode) continue;
          const location = await geocodePostcodeArea(jobPostcode);
          if (!active) return;
          if (!location) continue;
          timingByJobId[job.id] = timing;
          if (timing.kind === "provisional") hasProvisionalTiming = true;
          candidates.push({
            jobId: job.id,
            pricePence: jobPricePence,
            taskDurationMinutes,
            location,
            startsAt: timing.startsAt,
          });
        }

        if (candidates.length === 0) {
          setMatchingNotice("Best jobs are estimated using provisional times until a start time is agreed. Jobs still need a mappable area.");
          return;
        }

        const response = await fetchJobMatches(workerLocation, candidates);
        if (!active) return;
        setMatchingNotice(matchingTimingNotice(hasProvisionalTiming));
        setMatchesByJobId(
          Object.fromEntries(
            response.ranked_jobs.map((match) => {
              const timing = timingByJobId[match.job_id];
              return [
                match.job_id,
                {
                  ...match,
                  timing_kind: timing?.kind,
                  timing_label: timing?.shortLabel,
                },
              ];
            })
          )
        );
      } catch (error: any) {
        if (!active) return;
        const reason = routeQuoteFailureMessage(error);
        setMatchingError(
          reason === "Route service unavailable"
            ? "Route service unavailable. Showing the usual job order."
            : `${reason} Showing the usual job order.`
        );
        setMatchesByJobId({});
      } finally {
        if (active) setMatchingLoading(false);
      }
    }

    loadMatches();

    return () => {
      active = false;
    };
  }, [matchingEnabled, filtered]);

  const displayedJobs = useMemo(() => {
    return matchingEnabled && Object.keys(matchesByJobId).length > 0
      ? orderJobsByMatch(filtered, matchesByJobId)
      : filtered;
  }, [filtered, matchingEnabled, matchesByJobId]);

  const selectedMapJob = useMemo(
    () => displayedJobs.find((job) => job.id === selectedMapJobId) || null,
    [displayedJobs, selectedMapJobId]
  );

  const selectedRoutePreviewMode = useMemo(() => {
    const matchMode = selectedMapJob ? matchesByJobId[selectedMapJob.id]?.best_mode : null;
    return matchMode || workerRouteMode;
  }, [matchesByJobId, selectedMapJob, workerRouteMode]);

  useEffect(() => {
    if (displayedJobs.length === 0) {
      if (selectedMapJobId) setSelectedMapJobId(null);
      return;
    }
    if (selectedMapJobId && !displayedJobs.some((job) => job.id === selectedMapJobId)) {
      setSelectedMapJobId(null);
    }
  }, [displayedJobs, selectedMapJobId]);

  useEffect(() => {
    if (!routeQuotesEnabled || !selectedMapJob) return;

    let active = true;
    const requestId = latestRoutePreviewRequestRef.current + 1;
    latestRoutePreviewRequestRef.current = requestId;

    async function loadRoutePreview() {
      try {
        const profile = await getProfile().catch(() => null);
        const workerGps = await getCurrentGpsPoint();
        const workerProfilePoint = profile?.postcode ? await geocodePostcodeArea(profile.postcode) : null;
        const origin = workerGps || workerProfilePoint;
        if (!origin || !selectedMapJob) return;

        const destination = await resolveJobRoutePoint(selectedMapJob, PUBLIC_BROWSE_COORDINATE_ACCESS);
        if (!active || latestRoutePreviewRequestRef.current !== requestId || !destination) return;

        const requestKey = routePreviewRequestKey(
          selectedMapJob,
          selectedRoutePreviewMode,
          origin,
          destination.point,
          destination.precision
        );
        if (routePreviewKeysRef.current[selectedMapJob.id] === requestKey) return;

        const previewModes: RouteQuoteMode[] =
          selectedRoutePreviewMode === "bus"
            ? ["bus", "walk", "bicycle", "car"]
            : [selectedRoutePreviewMode];
        const response = await fetchRouteQuotes(origin, destination.point, previewModes);
        if (!active || latestRoutePreviewRequestRef.current !== requestId) return;
        routePreviewKeysRef.current[selectedMapJob.id] = requestKey;

        const route = response.routes.find((option) => option.mode === selectedRoutePreviewMode && option.status === "available")
          || response.routes.find((option) => option.status === "available");
        const geometry = routeGeometryFromQuote(route);

        setRouteGeometryByJobId((current) => ({
          ...current,
          [selectedMapJob.id]: geometry || undefined,
        }));
        setRoutePreviewByJobId((current) => ({
          ...current,
          [selectedMapJob.id]: route
            ? {
                distance: formatRouteQuoteDistance(route.distance_meters),
                time: formatRouteQuoteDuration(route.duration_seconds),
                mode: route.mode,
                locationPrecision: destination.precision,
              }
            : undefined,
        }));
      } catch {
        if (!active || !selectedMapJob) return;
        setRouteGeometryByJobId((current) => ({
          ...current,
          [selectedMapJob.id]: undefined,
        }));
        setRoutePreviewByJobId((current) => ({
          ...current,
          [selectedMapJob.id]: undefined,
        }));
      }
    }

    loadRoutePreview();

    return () => {
      active = false;
    };
  }, [
    routeQuotesEnabled,
    selectedMapJob?.id,
    selectedMapJob?.postcode,
    selectedMapJob?.postcode_district,
    selectedRoutePreviewMode,
  ]);

  async function handleNavigateToJobArea(job: Job) {
    const area = areaFromJob(job);
    if (!area || area === "Local") {
      router.push(`/app/job/${job.id}`);
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${area} UK`)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        router.push(`/app/job/${job.id}`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      router.push(`/app/job/${job.id}`);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PageHeader title="Browse nearby jobs" subtitle="Quick local jobs with area-first privacy and simple details." />
      <FeedbackNotice type="info" text="Open FEN jobs appear here. Use search and filters to narrow what is nearby." />

      <View style={styles.metricsRow}>
        <InfoMetric label="Open jobs" value={String(jobs.filter((job) => job.status === "open").length)} />
        <InfoMetric label="Visible" value={String(filtered.length)} />
      </View>

      <TrustBanner title="Privacy first">
        Exact addresses stay hidden. Browse by area and arrange details only after someone is chosen.
      </TrustBanner>

      <BrowseMap
        jobs={displayedJobs}
        selectedId={selectedMapJobId}
        originDistrict={workerMapArea}
        travelByJobId={travelByJobId}
        matchesByJobId={matchesByJobId}
        routeGeometryByJobId={routeGeometryByJobId}
        routePreviewByJobId={routePreviewByJobId}
        loading={loading}
        errorText={errorText}
        onJobSelect={setSelectedMapJobId}
        onOpenJob={(jobId: string) => router.push(`/app/job/${jobId}`)}
        onNavigate={handleNavigateToJobArea}
      />

      <TextInput
        placeholder="Search jobs"
        placeholderTextColor={theme.colors.placeholder}
        style={styles.search}
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Urgency</Text>
        <View style={styles.chipsRow}>
          <Pressable
            style={[styles.selectableChip, !urgencyFilter && styles.selectableChipActive]}
            onPress={() => setUrgencyFilter(null)}
          >
            <Text style={[styles.selectableChipText, !urgencyFilter && styles.selectableChipTextActive]}>All</Text>
          </Pressable>
        {(["Need now", "Today", "Flexible"] as const).map((urgency) => (
          <Pressable
            key={urgency}
            style={[styles.selectableChip, urgencyFilter === urgency && styles.selectableChipActive]}
            onPress={() => setUrgencyFilter((current) => current === urgency ? null : urgency)}
          >
            <Text style={[styles.selectableChipText, urgencyFilter === urgency && styles.selectableChipTextActive]}>
              {urgency}
            </Text>
          </Pressable>
        ))}
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Distance</Text>
        <View style={styles.filterRow}>
        <Pressable style={[styles.filterChip, !distanceFilterMiles && styles.filterChipActive]} onPress={() => setDistanceFilterMiles(null)}>
          <Text style={[styles.filterText, !distanceFilterMiles && styles.filterTextActive]}>Any</Text>
        </Pressable>
        {DISTANCE_OPTIONS.map((miles) => (
          <Pressable
            key={miles}
            style={[styles.filterChip, distanceFilterMiles === miles && styles.filterChipActive]}
            onPress={() => setDistanceFilterMiles((current) => current === miles ? null : miles)}
          >
            <Text style={[styles.filterText, distanceFilterMiles === miles && styles.filterTextActive]}>
              {miles} miles
            </Text>
          </Pressable>
        ))}
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Category</Text>
        <View style={styles.filterRow}>
        <Pressable style={[styles.filterChip, !categoryFilter && styles.filterChipActive]} onPress={() => setCategoryFilter(null)}>
          <Text style={[styles.filterText, !categoryFilter && styles.filterTextActive]}>All categories</Text>
        </Pressable>
        {CATEGORY_OPTIONS.map((category) => (
          <Pressable key={category} style={[styles.filterChip, categoryFilter === category && styles.filterChipActive]} onPress={() => setCategoryFilter(category)}>
            <Text style={[styles.filterText, categoryFilter === category && styles.filterTextActive]}>{category}</Text>
          </Pressable>
        ))}
        </View>
      </View>

      {loading ? (
        <LoadingState text="Loading jobs..." />
      ) : errorText ? (
        <FeedbackNotice type="error" text={errorText} />
      ) : displayedJobs.length === 0 ? (
        <EmptyState
          title="No local jobs yet"
          text="New FEN jobs will appear here as people nearby post tasks."
        />
      ) : (
        <View style={styles.list}>
          {matchingEnabled && matchingLoading ? (
            <FeedbackNotice type="info" text="Loading best jobs for you..." />
          ) : null}
          {matchingEnabled && matchingError ? (
            <FeedbackNotice type="error" text={matchingError} />
          ) : null}
          {matchingEnabled && !matchingLoading && !matchingError && matchingNotice ? (
            <FeedbackNotice type="info" text={matchingNotice} />
          ) : null}
          {matchingEnabled && Object.keys(matchesByJobId).length > 0 ? (
            <Text style={styles.matchingTitle}>Best jobs for me</Text>
          ) : null}
          {displayedJobs.map((job) => (
            <JobCard
              key={job.id}
              title={job.title}
              budget={budgetFromJob(job)}
              urgency={urgencyFromJob(job)}
              status={statusFromJob(job)}
              category={normalizeCategory(job.category)}
              area={areaFromJob(job)}
              distance={travelByJobId[job.id]?.distance || "Distance unavailable"}
              travelTime={travelByJobId[job.id]?.time || travelTimeFromJob(job)}
              match={matchesByJobId[job.id]}
              onPress={() => router.push(`/app/job/${job.id}`)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
    gap: 14,
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 8,
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 2,
  },
  search: {
    backgroundColor: theme.colors.inputBg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: theme.colors.text,
    fontSize: 16,
    marginTop: 6,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterGroup: {
    gap: 8,
  },
  filterLabel: {
    color: theme.colors.subtle,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    backgroundColor: theme.colors.chipBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: "100%",
  },
  filterChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.chipActiveBg,
  },
  selectableChip: {
    backgroundColor: theme.colors.chipBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: "100%",
  },
  selectableChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.chipActiveBg,
  },
  selectableChipText: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  selectableChipTextActive: {
    color: theme.colors.text,
    fontWeight: "800",
  },
  filterText: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  filterTextActive: {
    color: theme.colors.text,
    fontWeight: "800",
  },
  list: {
    gap: 14,
    marginTop: 4,
  },
  matchingTitle: {
    color: theme.colors.accent,
    fontSize: 15,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    color: theme.colors.muted,
    fontSize: 15,
    marginTop: 12,
  },
  errorText: {
    color: theme.colors.dangerText,
    fontSize: 15,
    textAlign: "center",
  },
  emptyText: {
    color: theme.colors.muted,
    fontSize: 15,
    textAlign: "center",
  },
  });
}


