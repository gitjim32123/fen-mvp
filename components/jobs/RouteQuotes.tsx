import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  fetchRouteQuotes,
  formatRouteQuoteCost,
  formatRouteQuoteDistance,
  formatRouteQuoteDuration,
  isRouteQuotesEnabled,
  routeQuoteFailureMessage,
  routeQuoteDisplayName,
  ROUTE_QUOTE_MODES,
  routeQuoteStatusText,
  type RouteQuoteMode,
  type RouteQuoteOption,
} from "../../lib/routeQuotes";
import {
  geocodePostcodeArea,
  getCurrentGpsPoint,
  type PostcodePoint,
} from "../../lib/geocoding";
import { getProfile } from "../../lib/auth";
import { normalizePostcodeDistrict } from "../../lib/postcodeDistricts";
import { useTheme } from "../ui/ThemeProvider";
import type { Theme } from "../ui/theme";

type RouteQuotesProps = {
  jobPostcode?: string | null;
  fallbackText: string;
};

type LoadState =
  | { status: "idle" | "loading" }
  | { status: "ready"; routes: RouteQuoteOption[]; originSource: "current_location" | "profile_area" }
  | { status: "unavailable"; reason: string }
  | { status: "failed"; reason: string };

export default function RouteQuotes({ jobPostcode, fallbackText }: RouteQuotesProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [expanded, setExpanded] = useState(false);

  const enabled = isRouteQuotesEnabled();
  const safeJobPostcode = normalizePostcodeDistrict(jobPostcode);
  const readyState = state.status === "ready" ? state : null;

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    async function loadQuotes() {
      try {
        setState({ status: "loading" });
        if (!safeJobPostcode) {
          setState({ status: "unavailable", reason: "Travel quotes unavailable until the job area is known." });
          return;
        }

        const destination = await geocodePostcodeArea(safeJobPostcode);
        if (!active) return;
        if (!destination) {
          setState({ status: "unavailable", reason: "Travel quotes unavailable because the job area could not be mapped." });
          return;
        }

        const originResult = await resolveWorkerOrigin();
        if (!active) return;
        if (!originResult) {
          setState({ status: "unavailable", reason: "Travel quotes unavailable until your current location or profile area is available." });
          return;
        }

        const response = await fetchRouteQuotes(originResult.point, destination);
        if (!active) return;
        setState({
          status: "ready",
          routes: response.routes.filter((route) => ROUTE_QUOTE_MODES.includes(route.mode)),
          originSource: originResult.source,
        });
      } catch (error: any) {
        if (!active) return;
        setState({
          status: "failed",
          reason: routeQuoteFailureMessage(error),
        });
      }
    }

    loadQuotes();

    return () => {
      active = false;
    };
  }, [enabled, safeJobPostcode]);

  if (!enabled) return null;

  return (
    <View style={styles.card}>
      <Pressable style={styles.headerRow} onPress={() => setExpanded((current) => !current)}>
        <View style={styles.headerTextColumn}>
          <Text style={styles.sectionTitle}>Travel options</Text>
          <Text style={styles.helperText}>
            {expanded ? "Verified travel details are ready." : "Collapsed. Tap to compare walk, bicycle, car, and bus."}
          </Text>
        </View>
        <Text style={styles.expandText}>{expanded ? "Hide" : "Show"}</Text>
      </Pressable>

      {state.status === "loading" || state.status === "idle" ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading travel options...</Text>
        </View>
      ) : state.status === "failed" ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>Travel options unavailable</Text>
          <Text style={styles.noticeText}>{state.reason}</Text>
          <Text style={styles.noticeText}>{fallbackText}</Text>
        </View>
      ) : state.status === "unavailable" ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>Travel options unavailable</Text>
          <Text style={styles.noticeText}>{state.reason}</Text>
        </View>
      ) : readyState && !expanded ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>Route options ready</Text>
          <Text style={styles.noticeText}>Show details to compare walk, bicycle, car, and bus options.</Text>
        </View>
      ) : readyState ? (
        <>
          <Text style={styles.sourceText}>
            {readyState.originSource === "current_location" ? "Using current location." : "Using profile area."}
          </Text>
          <View style={styles.quoteGrid}>
            {ROUTE_QUOTE_MODES.map((mode) => (
              <RouteQuoteRow
                key={mode}
                mode={mode}
                route={readyState.routes.find((route: RouteQuoteOption) => route.mode === mode)}
                styles={styles}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function RouteQuoteRow({
  mode,
  route,
  styles,
}: {
  mode: RouteQuoteMode;
  route?: RouteQuoteOption;
  styles: ReturnType<typeof createStyles>;
}) {
  const duration = formatRouteQuoteDuration(route?.duration_seconds);
  const distance = formatRouteQuoteDistance(route?.distance_meters);
  const cost = route ? formatRouteQuoteCost(route) : null;
  const available = route?.status === "available";
  const statusLabel = route ? routeQuoteStatusBadge(route) : "Unavailable";

  return (
    <View style={[styles.quoteRow, !available && styles.quoteRowUnavailable]}>
      <View style={styles.quoteTitleColumn}>
        <Text style={styles.quoteMode}>{routeQuoteDisplayName(mode)}</Text>
        <View style={[styles.quoteStatusBadge, available ? styles.quoteStatusAvailable : styles.quoteStatusUnavailable]}>
          <Text style={[styles.quoteStatusText, available ? styles.quoteStatusTextAvailable : styles.quoteStatusTextUnavailable]}>
            {statusLabel}
          </Text>
        </View>
        {!available ? <Text style={styles.quoteReason}>{route ? routeQuoteStatusText(route) : "Route unavailable"}</Text> : null}
      </View>
      <View style={styles.quoteValues}>
        <Text style={styles.quoteValue}>{duration || "Unavailable"}</Text>
        {distance ? <Text style={styles.quoteMeta}>{distance}</Text> : null}
        {cost ? <Text style={styles.quoteCost}>{cost}</Text> : null}
      </View>
    </View>
  );
}

function routeQuoteStatusBadge(route: RouteQuoteOption) {
  if (route.status !== "available") return "Unavailable";
  if (route.confidence === "HIGH") return "Verified";
  return "Estimated";
}

async function resolveWorkerOrigin(): Promise<{
  point: PostcodePoint;
  source: "current_location" | "profile_area";
} | null> {
  const gpsPoint = await getCurrentGpsPoint();
  if (gpsPoint) {
    return { point: gpsPoint, source: "current_location" };
  }

  const profile = await getProfile().catch(() => null);
  const profilePostcode = normalizePostcodeDistrict(profile?.postcode);
  if (!profilePostcode) return null;

  const profilePoint = await geocodePostcodeArea(profilePostcode);
  return profilePoint ? { point: profilePoint, source: "profile_area" } : null;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginBottom: 8,
    },
    headerTextColumn: {
      flex: 1,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "800",
      marginBottom: 4,
      textTransform: "uppercase",
    },
    helperText: {
      color: theme.colors.muted,
      fontSize: 13,
      lineHeight: 19,
    },
    expandText: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: "900",
    },
    sourceText: {
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
      borderColor: theme.colors.border,
      borderRadius: 12,
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
    quoteGrid: {
      gap: 8,
    },
    quoteRow: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    quoteRowUnavailable: {
      opacity: 0.82,
    },
    quoteTitleColumn: {
      flex: 1,
      minWidth: 120,
      gap: 6,
    },
    quoteMode: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    quoteStatusBadge: {
      alignSelf: "flex-start",
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    quoteStatusAvailable: {
      backgroundColor: theme.colors.successBg,
      borderColor: theme.colors.success,
    },
    quoteStatusUnavailable: {
      backgroundColor: theme.colors.warningBg,
      borderColor: theme.colors.warning,
    },
    quoteStatusText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    quoteStatusTextAvailable: {
      color: theme.colors.successText,
    },
    quoteStatusTextUnavailable: {
      color: theme.colors.warningText,
    },
    quoteReason: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
    },
    quoteValues: {
      alignItems: "flex-end",
      gap: 2,
      minWidth: 92,
    },
    quoteValue: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    quoteMeta: {
      color: theme.colors.muted,
      fontSize: 13,
      fontWeight: "700",
    },
    quoteCost: {
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: "800",
    },
  });
}
