import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { getProfile } from "../../lib/auth";
import {
  geocodePostcodeArea,
  getCurrentGpsPoint,
  type PostcodePoint,
} from "../../lib/geocoding";
import {
  buildJobMatchRequestKey,
  fetchJobMatches,
  getJobMatchingTaskDurationMinutes,
  isJobMatchingEnabled,
  modeLabel,
  recommendationTier,
  type JobMatchResult,
} from "../../lib/jobMatching";
import { getJobRouteTiming, type JobRouteTiming } from "../../lib/jobTiming";
import {
  formatHourlyRate,
  formatPence,
  formatSecondsAsMinutes,
} from "../../lib/profitability";
import { routeQuoteFailureMessage } from "../../lib/routeQuotes";
import { normalizePostcodeDistrict } from "../../lib/postcodeDistricts";
import type { Job } from "../../lib/types";
import { useTheme } from "../ui/ThemeProvider";
import type { Theme } from "../ui/theme";

type RecommendedOptionCardProps = {
  job: Job;
};

type LoadState =
  | { status: "idle" | "loading" }
  | { status: "ready"; match: JobMatchResult; timing: JobRouteTiming }
  | { status: "unavailable"; reason: string }
  | { status: "failed"; reason: string };

export default function RecommendedOptionCard({ job }: RecommendedOptionCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const latestRequestIdRef = useRef(0);
  const lastRequestKeyRef = useRef<string | null>(null);

  const enabled = isJobMatchingEnabled();
  const readyState = state.status === "ready" ? state : null;
  const timing = useMemo(
    () =>
      getJobRouteTiming({
        agreed_start_at: job.agreed_start_at,
        preferred_start_at: job.preferred_start_at,
        urgency: job.urgency,
      }),
    [job.agreed_start_at, job.preferred_start_at, job.urgency]
  );
  const jobPricePence = useMemo(() => Math.round(Number(job.budget_gbp) * 100), [job.budget_gbp]);
  const jobPostcode = useMemo(
    () => normalizePostcodeDistrict(job.postcode_district) || normalizePostcodeDistrict(job.postcode),
    [job.postcode_district, job.postcode]
  );

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;

    async function loadRecommendation() {
      try {
        const taskDurationMinutes = getJobMatchingTaskDurationMinutes();
        if (!taskDurationMinutes) {
          setState({ status: "unavailable", reason: "Recommendation unavailable until task duration is configured." });
          return;
        }

        if (!Number.isFinite(jobPricePence) || jobPricePence <= 0) {
          setState({ status: "unavailable", reason: "Recommendation unavailable until job pay is known." });
          return;
        }

        if (!jobPostcode) {
          setState({ status: "unavailable", reason: "Recommendation unavailable until the job area is known." });
          return;
        }

        const jobLocation = await geocodePostcodeArea(jobPostcode);
        if (!active) return;
        if (!jobLocation) {
          setState({ status: "unavailable", reason: "Recommendation unavailable because the job area could not be mapped." });
          return;
        }

        const workerLocation = await resolveWorkerLocation();
        if (!active) return;
        if (!workerLocation) {
          setState({ status: "unavailable", reason: "Recommendation unavailable until your current location or profile area is available." });
          return;
        }

        const requestKey = buildJobMatchRequestKey({
          jobId: job.id,
          origin: workerLocation,
          destination: jobLocation,
          timingKind: timing.kind,
          startsAt: timing.startsAt,
          pricePence: jobPricePence,
          taskDurationMinutes,
        });
        if (lastRequestKeyRef.current === requestKey) {
          return;
        }
        lastRequestKeyRef.current = requestKey;

        setState((previous) => (previous.status === "ready" ? previous : { status: "loading" }));

        const requestJobs = [
          {
            jobId: job.id,
            pricePence: jobPricePence,
            taskDurationMinutes,
            location: jobLocation,
            startsAt: timing.startsAt,
          },
        ];
        const response = await fetchJobMatches(workerLocation, requestJobs);
        if (!active || latestRequestIdRef.current !== requestId) return;

        const match = response.ranked_jobs.find((item) => item.job_id === job.id) || response.ranked_jobs[0];
        if (!match) {
          setState({ status: "unavailable", reason: "Recommendation unavailable for this job." });
          return;
        }

        setState({ status: "ready", match, timing });
      } catch (error: any) {
        if (!active || latestRequestIdRef.current !== requestId) return;
        lastRequestKeyRef.current = null;
        setState({
          status: "failed",
          reason: routeQuoteFailureMessage(error),
        });
      }
    }

    loadRecommendation();

    return () => {
      active = false;
    };
  }, [enabled, job.id, jobPostcode, jobPricePence, timing.kind, timing.startsAt]);

  if (!enabled) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Recommended option</Text>

      {state.status === "loading" || state.status === "idle" ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Finding the best option...</Text>
        </View>
      ) : state.status === "failed" ? (
        <Notice title="Recommendation unavailable" text={state.reason} styles={styles} />
      ) : state.status === "unavailable" ? (
        <Notice title="Recommendation unavailable" text={state.reason} styles={styles} />
      ) : readyState ? (
        <>
          <View style={styles.recommendationHeader}>
            <Text style={styles.recommendationText}>{recommendationTier(readyState.match)}</Text>
            <Text style={styles.modeText}>{modeLabel(readyState.match.best_mode)}</Text>
            <Text style={styles.timingText}>{readyState.timing.label}</Text>
          </View>
          <View style={styles.metricGrid}>
            <Metric label="Best mode" value={modeLabel(readyState.match.best_mode)} styles={styles} />
            <Metric label="Travel time" value={formatSecondsAsMinutes(readyState.match.profitability?.outbound_travel_seconds)} styles={styles} />
            <Metric label="Travel cost" value={formatPence(readyState.match.profitability?.travel_cost_pence)} styles={styles} />
            <Metric label="Job pay" value={formatPence(readyState.match.profitability?.job_price_pence)} styles={styles} />
            <Metric label="Net earnings" value={formatPence(readyState.match.profitability?.net_earnings_pence)} styles={styles} />
            <Metric label="Effective hourly rate" value={formatHourlyRate(readyState.match.profitability?.effective_hourly_rate_pence)} styles={styles} />
          </View>
          {readyState.match.status !== "available" ? (
            <Text style={styles.partialText}>
              {readyState.match.status === "partial" ? "Partial cost data. Missing fares are not treated as free." : readyState.match.reason}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Metric({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Notice({
  title,
  text,
  styles,
}: {
  title: string;
  text: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.noticeBox}>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

async function resolveWorkerLocation(): Promise<PostcodePoint | null> {
  const gpsPoint = await getCurrentGpsPoint();
  if (gpsPoint) return gpsPoint;

  const profile = await getProfile().catch(() => null);
  const profileDistrict = normalizePostcodeDistrict(profile?.postcode);
  return profileDistrict ? geocodePostcodeArea(profileDistrict) : null;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sectionTitle: {
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: "800",
      marginBottom: 10,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
    },
    loadingText: {
      color: theme.colors.muted,
      fontSize: 14,
      fontWeight: "700",
    },
    noticeBox: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      borderRadius: 14,
      padding: 12,
      gap: 4,
    },
    noticeTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    noticeText: {
      color: theme.colors.muted,
      fontSize: 13,
      lineHeight: 19,
    },
    recommendationHeader: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
      gap: 4,
    },
    recommendationText: {
      color: theme.colors.successText,
      fontSize: 20,
      fontWeight: "900",
    },
    modeText: {
      color: theme.colors.muted,
      fontSize: 13,
      fontWeight: "800",
    },
    timingText: {
      color: theme.colors.subtle,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
    },
    metricGrid: {
      backgroundColor: theme.colors.bg,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      borderRadius: 14,
      overflow: "hidden",
    },
    metricRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    metricLabel: {
      color: theme.colors.subtle,
      fontSize: 13,
      fontWeight: "800",
      flex: 1,
    },
    metricValue: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "800",
      textAlign: "right",
      flexShrink: 0,
    },
    partialText: {
      color: theme.colors.warningText,
      backgroundColor: theme.colors.warningBg,
      borderColor: theme.colors.warning,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 10,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
    },
  });
}
