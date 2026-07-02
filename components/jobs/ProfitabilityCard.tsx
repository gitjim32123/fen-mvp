import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { getProfile } from "../../lib/auth";
import {
  geocodePostcodeArea,
  getCurrentGpsPoint,
  type PostcodePoint,
} from "../../lib/geocoding";
import {
  fetchJobProfitability,
  formatHourlyRate,
  formatPence,
  formatSecondsAsMinutes,
  getProfitabilityTaskDurationMinutes,
  isProfitabilityEnabled,
  buildProfitabilityRequestKey,
  mapTransportModeToProfitabilityMode,
  profitabilityStatusLabel,
  type ProfitabilityAnalysis,
} from "../../lib/profitability";
import { getJobRouteTiming, type JobRouteTiming } from "../../lib/jobTiming";
import { routeQuoteFailureMessage } from "../../lib/routeQuotes";
import { normalizePostcodeDistrict } from "../../lib/postcodeDistricts";
import type { Job } from "../../lib/types";
import { useTheme } from "../ui/ThemeProvider";
import type { Theme } from "../ui/theme";

type ProfitabilityCardProps = {
  job: Job;
};

type LoadState =
  | { status: "idle" | "loading" }
  | { status: "ready"; analysis: ProfitabilityAnalysis; modeLabel: string; timing: JobRouteTiming }
  | { status: "unavailable"; reason: string }
  | { status: "failed"; reason: string };

export default function ProfitabilityCard({ job }: ProfitabilityCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const latestRequestIdRef = useRef(0);
  const lastLoadedRequestKeyRef = useRef<string | null>(null);

  const enabled = isProfitabilityEnabled();
  const readyState = state.status === "ready" ? state : null;
  const taskDurationMinutes = getProfitabilityTaskDurationMinutes();
  const timing = useMemo(
    () => getJobRouteTiming(job),
    [job.id, job.urgency, job.preferred_start_at, job.agreed_start_at, job.created_at]
  );
  const jobPricePence = useMemo(() => Math.round(Number(job.budget_gbp) * 100), [job.budget_gbp]);
  const jobPostcode = useMemo(
    () => normalizePostcodeDistrict(job.postcode_district) || normalizePostcodeDistrict(job.postcode),
    [job.postcode, job.postcode_district]
  );

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    async function loadProfitability() {
      try {
        setState((previous) => previous.status === "ready" ? previous : { status: "loading" });

        if (!taskDurationMinutes) {
          setState({
            status: "unavailable",
            reason: "Profitability unavailable until a task duration is configured.",
          });
          return;
        }

        if (!Number.isFinite(jobPricePence) || jobPricePence <= 0) {
          setState({
            status: "unavailable",
            reason: "Profitability unavailable until job pay is known.",
          });
          return;
        }

        if (!jobPostcode) {
          setState({
            status: "unavailable",
            reason: "Profitability unavailable until the job area is known.",
          });
          return;
        }

        const jobLocation = await geocodePostcodeArea(jobPostcode);
        if (!active) return;
        if (!jobLocation) {
          setState({
            status: "unavailable",
            reason: "Profitability unavailable because the job area could not be mapped.",
          });
          return;
        }

        const profile = await getProfile().catch(() => null);
        if (!active) return;

        const mode = mapTransportModeToProfitabilityMode(profile?.transport_mode);
        if (!mode) {
          setState({
            status: "unavailable",
            reason: "Profitability unavailable until a supported worker travel mode is set.",
          });
          return;
        }

        const workerLocation = await resolveWorkerLocation(profile?.postcode);
        if (!active) return;
        if (!workerLocation) {
          setState({
            status: "unavailable",
            reason: "Profitability unavailable until your current location or profile area is available.",
          });
          return;
        }

        const requestKey = buildProfitabilityRequestKey({
          jobId: job.id,
          originLat: workerLocation.latitude,
          originLon: workerLocation.longitude,
          destinationLat: jobLocation.latitude,
          destinationLon: jobLocation.longitude,
          startsAt: timing.startsAt,
          jobPricePence,
          taskDurationMinutes,
          mode,
        });
        if (lastLoadedRequestKeyRef.current === requestKey) {
          return;
        }
        const requestId = latestRequestIdRef.current + 1;
        latestRequestIdRef.current = requestId;

        const analysis = await fetchJobProfitability({
          jobPricePence,
          taskDurationMinutes,
          jobLocation,
          startsAt: timing.startsAt,
          workerLocation,
          mode,
        });
        if (!active || latestRequestIdRef.current !== requestId) return;

        lastLoadedRequestKeyRef.current = requestKey;
        setState({
          status: "ready",
          analysis,
          modeLabel: mode === "bicycle" ? "Bicycle" : mode[0].toUpperCase() + mode.slice(1),
          timing,
        });
      } catch (error: any) {
        if (!active) return;
        setState({
          status: "failed",
          reason: routeQuoteFailureMessage(error),
        });
      }
    }

    loadProfitability();

    return () => {
      active = false;
    };
  }, [enabled, job.id, jobPostcode, jobPricePence, taskDurationMinutes, timing.startsAt, timing.label]);

  if (!enabled) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Earnings impact</Text>

      {state.status === "loading" || state.status === "idle" ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading profitability...</Text>
        </View>
      ) : state.status === "failed" ? (
        <Notice title="Profitability unavailable" text={state.reason} styles={styles} />
      ) : state.status === "unavailable" ? (
        <Notice title="Profitability unavailable" text={state.reason} styles={styles} />
      ) : readyState ? (
        <>
          <Text style={styles.sourceText}>Using {readyState.modeLabel.toLowerCase()} profitability from route-ai-agent.</Text>
          <Text style={styles.timingText}>{readyState.timing.label}</Text>
          <View style={styles.metricGrid}>
            <Metric label="Job Pay" value={formatPence(readyState.analysis.job_price_pence)} styles={styles} />
            <Metric label="Travel Cost" value={formatPence(readyState.analysis.travel_cost_pence)} styles={styles} />
            <Metric label="Net Earnings" value={formatPence(readyState.analysis.net_earnings_pence)} styles={styles} />
            <Metric
              label="Effective Hourly Rate"
              value={formatHourlyRate(readyState.analysis.effective_hourly_rate_pence)}
              styles={styles}
            />
            <Metric label="Travel Time" value={formatSecondsAsMinutes(readyState.analysis.outbound_travel_seconds)} styles={styles} />
            <Metric label="Status" value={profitabilityStatusLabel(readyState.analysis)} styles={styles} />
          </View>
          {readyState.analysis.status !== "available" || readyState.analysis.reason ? (
            <View
              style={[
                styles.statusNotice,
                readyState.analysis.status === "partial" ? styles.partialNotice : styles.unavailableNotice,
              ]}
            >
              <Text style={styles.statusNoticeText}>{readyState.analysis.reason}</Text>
            </View>
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

async function resolveWorkerLocation(profilePostcode?: string | null): Promise<PostcodePoint | null> {
  const gpsPoint = await getCurrentGpsPoint();
  if (gpsPoint) return gpsPoint;

  const profileDistrict = normalizePostcodeDistrict(profilePostcode);
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
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    sourceText: {
      color: theme.colors.subtle,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 4,
    },
    timingText: {
      color: theme.colors.subtle,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 8,
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
    statusNotice: {
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
      marginTop: 10,
    },
    partialNotice: {
      backgroundColor: theme.colors.warningBg,
      borderColor: theme.colors.warning,
    },
    unavailableNotice: {
      backgroundColor: theme.colors.dangerBg,
      borderColor: theme.colors.danger,
    },
    statusNoticeText: {
      color: theme.colors.text,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "700",
    },
  });
}
