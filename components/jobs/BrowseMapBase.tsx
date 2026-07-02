import { useEffect, useMemo, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, Rect, Stop } from "react-native-svg";
import { normalizeCategory } from "../../lib/categories";
import {
  formatMatchHourlyRate,
  formatMatchTravelTime,
  modeLabel,
  recommendationTier,
  type JobMatchResult,
} from "../../lib/jobMatching";
import { getDistrictPosition, normalizePostcodeDistrict } from "../../lib/postcodeDistricts";
import { routeQuoteDisplayName, type RoutePreviewGeometry, type RouteQuoteMode } from "../../lib/routeQuotes";
import type { Job } from "../../lib/types";
import { useTheme } from "../ui/ThemeProvider";
import type { Theme } from "../ui/theme";

type TravelSummary = {
  distance?: string;
  time?: string;
  miles?: number;
};

type RoutePreviewSummary = {
  distance?: string | null;
  time?: string | null;
  mode: RouteQuoteMode;
  locationPrecision: "exact" | "approximate";
};

type JobMarker = {
  job: Job;
  area: string;
  x: number;
  y: number;
  known: boolean;
};

export type BrowseMapProps = {
  jobs: Job[];
  selectedId?: string | null;
  originDistrict?: string | null;
  travelByJobId?: Record<string, TravelSummary>;
  matchesByJobId?: Record<string, JobMatchResult>;
  routeGeometryByJobId?: Record<string, RoutePreviewGeometry | undefined>;
  routePreviewByJobId?: Record<string, RoutePreviewSummary | undefined>;
  loading?: boolean;
  errorText?: string | null;
  onJobPress?: (jobId: string) => void;
  onJobSelect?: (jobId: string | null) => void;
  onOpenJob?: (jobId: string) => void;
  onNavigate?: (job: Job) => void;
};

function areaFromJob(job: Job) {
  return normalizePostcodeDistrict((job as any).postcode_district) || normalizePostcodeDistrict(job.postcode) || "Local";
}

function budgetFromJob(job: Job) {
  return typeof job.budget_gbp === "number" ? `£${job.budget_gbp}` : "Budget set";
}

function shortCategoryFromJob(job: Job) {
  const category = normalizeCategory(job.category).toLowerCase();
  if (category.includes("clean")) return "Clean";
  if (category.includes("garden")) return "Garden";
  if (category.includes("dog")) return "Dog";
  if (category.includes("moving") || category.includes("lifting")) return "Move";
  if (category.includes("delivery") || category.includes("collection")) return "Collect";
  if (category.includes("shopping") || category.includes("errand")) return "Errand";
  if (category.includes("tech") || category.includes("coding")) return "Tech";
  if (category.includes("companionship")) return "Social";
  if (category.includes("furniture")) return "Build";
  if (category.includes("diy") || category.includes("decorating")) return "DIY";
  return "Job";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildMarkers(jobs: Job[]): JobMarker[] {
  const seenByArea = new Map<string, number>();
  return jobs
    .filter((job) => !!job?.id)
    .slice(0, 40)
    .map((job) => {
      const area = areaFromJob(job);
      const position = getDistrictPosition(area);
      const count = seenByArea.get(area) || 0;
      seenByArea.set(area, count + 1);
      const angle = count * 2.399;
      const radius = Math.min(7, 2.6 + count * 1.4);
      return {
        job,
        area,
        x: clamp(position.x + Math.cos(angle) * radius, 7, 93),
        y: clamp(position.y + Math.sin(angle) * radius, 9, 82),
        known: position.known,
      };
    });
}

function projectRouteGeometry(geometry?: RoutePreviewGeometry) {
  if (!geometry || geometry.source !== "route_ai_agent" || geometry.points.length < 2) {
    return { points: "", start: null, end: null };
  }

  const validPoints = geometry.points.filter(
    (point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      point.latitude >= -90 &&
      point.latitude <= 90 &&
      point.longitude >= -180 &&
      point.longitude <= 180
  );
  if (validPoints.length < 2) return { points: "", start: null, end: null };

  const latitudes = validPoints.map((point) => point.latitude);
  const longitudes = validPoints.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latSpan = Math.max(0.00001, maxLat - minLat);
  const lonSpan = Math.max(0.00001, maxLon - minLon);

  const projected = validPoints.map((point) => ({
    x: clamp(12 + ((point.longitude - minLon) / lonSpan) * 76, 8, 92),
    y: clamp(14 + ((maxLat - point.latitude) / latSpan) * 58, 10, 78),
  }));

  return {
    points: projected.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" "),
    start: projected[0],
    end: projected[projected.length - 1],
  };
}

function cleanSummary(value?: string | null) {
  if (!value) return null;
  return value.replace("Travel estimate unavailable until both postcode areas are known.", "Unavailable");
}

export default function BrowseMapBase({
  jobs,
  selectedId,
  originDistrict,
  travelByJobId = {},
  matchesByJobId = {},
  routeGeometryByJobId = {},
  routePreviewByJobId = {},
  loading = false,
  errorText,
  onJobPress,
  onJobSelect,
  onOpenJob,
  onNavigate,
}: BrowseMapProps) {
  const theme = useTheme();
  const [viewport, setViewport] = useState(() => Dimensions.get("window"));
  const styles = useMemo(() => createStyles(theme), [theme]);
  const markers = useMemo(() => buildMarkers(jobs), [jobs]);
  const isCompact = viewport.height < 720 || viewport.width < 390;
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const activeId = selectedId !== undefined ? selectedId : localSelectedId;
  const selectedMarker = activeId ? markers.find((marker) => marker.job.id === activeId) || null : null;
  const selectedJob = selectedMarker?.job || null;
  const selectedMatch = selectedJob ? matchesByJobId[selectedJob.id] : undefined;
  const selectedTravel = selectedJob ? travelByJobId[selectedJob.id] : undefined;
  const selectedGeometry = selectedJob ? routeGeometryByJobId[selectedJob.id] : undefined;
  const selectedPreview = selectedJob ? routePreviewByJobId[selectedJob.id] : undefined;
  const routeProjection = projectRouteGeometry(selectedGeometry);
  const hasRealRouteGeometry = routeProjection.points.length > 0;
  const originPosition = originDistrict ? getDistrictPosition(originDistrict) : null;
  const selectedMode = selectedPreview?.mode ? routeQuoteDisplayName(selectedPreview.mode) : modeLabel(selectedMatch?.best_mode);
  const selectedTime = selectedPreview?.time || (selectedMatch ? formatMatchTravelTime(selectedMatch) : cleanSummary(selectedTravel?.time));
  const selectedRate = selectedMatch ? formatMatchHourlyRate(selectedMatch) : null;
  const selectedDistance = selectedPreview?.distance || cleanSummary(selectedTravel?.distance);
  const previewUsesApproximatePoint = selectedPreview?.locationPrecision === "approximate";

  function selectJob(jobId: string) {
    setLocalSelectedId(jobId);
    onJobSelect?.(jobId);
  }

  function clearSelection() {
    setLocalSelectedId(null);
    onJobSelect?.(null);
  }

  function openJob(jobId: string) {
    onOpenJob?.(jobId);
    onJobPress?.(jobId);
  }

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }: { window: { height: number; width: number } }) => {
      setViewport(window);
    });
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={styles.shell}>
      <View style={[styles.mapArea, isCompact && styles.mapAreaCompact]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={styles.mapSvg}>
          <Defs>
            <LinearGradient id="mapDepth" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={theme.colors.mapBg} />
              <Stop offset="100%" stopColor={theme.colors.bgDeep} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#mapDepth)" />
          <Rect x="6" y="10" width="20" height="13" rx="1.2" fill={theme.colors.mapLand} opacity="0.92" />
          <Rect x="31" y="8" width="18" height="16" rx="1.2" fill={theme.colors.mapLand} opacity="0.68" />
          <Rect x="56" y="11" width="29" height="14" rx="1.2" fill={theme.colors.mapLand} opacity="0.78" />
          <Rect x="10" y="33" width="24" height="15" rx="1.2" fill={theme.colors.mapLand} opacity="0.72" />
          <Rect x="41" y="31" width="16" height="18" rx="1.2" fill={theme.colors.mapLand} opacity="0.9" />
          <Rect x="65" y="35" width="22" height="19" rx="1.2" fill={theme.colors.mapLand} opacity="0.7" />
          <Rect x="5" y="61" width="30" height="19" rx="1.2" fill={theme.colors.mapLand} opacity="0.76" />
          <Rect x="42" y="64" width="22" height="17" rx="1.2" fill={theme.colors.mapLand} opacity="0.64" />
          <Rect x="71" y="63" width="20" height="20" rx="1.2" fill={theme.colors.mapLand} opacity="0.84" />
          <Path d="M-4 29 L24 26 L52 28 L104 21" stroke={theme.colors.mapRoad} strokeWidth="1.35" strokeLinecap="round" fill="none" />
          <Path d="M-2 56 L22 52 L49 54 L77 50 L103 51" stroke={theme.colors.mapRoad} strokeWidth="1.15" strokeLinecap="round" fill="none" />
          <Path d="M22 -2 L25 22 L27 48 L31 104" stroke={theme.colors.mapRoad} strokeWidth="1.05" strokeLinecap="round" fill="none" />
          <Path d="M52 -2 L49 21 L52 48 L48 103" stroke={theme.colors.mapRoad} strokeWidth="0.9" strokeLinecap="round" fill="none" />
          <Path d="M82 -3 L79 24 L82 56 L77 103" stroke={theme.colors.mapRoad} strokeWidth="0.9" strokeLinecap="round" fill="none" />
          <Path d="M2 74 L18 71 L35 69 L55 72 L76 69 L100 72" stroke={theme.colors.mapWater} strokeWidth="2" strokeLinecap="round" fill="none" />
          <Path d="M8 18 L92 16" stroke={theme.colors.border} strokeWidth="0.35" strokeLinecap="round" fill="none" />
          <Path d="M8 42 L94 39" stroke={theme.colors.border} strokeWidth="0.35" strokeLinecap="round" fill="none" />
          <Path d="M12 88 L92 87" stroke={theme.colors.border} strokeWidth="0.35" strokeLinecap="round" fill="none" />
          <Path d="M11 9 L9 92" stroke={theme.colors.border} strokeWidth="0.32" strokeLinecap="round" fill="none" />
          <Path d="M39 7 L38 93" stroke={theme.colors.border} strokeWidth="0.32" strokeLinecap="round" fill="none" />
          <Path d="M68 8 L67 92" stroke={theme.colors.border} strokeWidth="0.32" strokeLinecap="round" fill="none" />
          {hasRealRouteGeometry ? (
            <Polyline
              points={routeProjection.points}
              stroke={theme.colors.accent}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null}
          {hasRealRouteGeometry && routeProjection.start && routeProjection.end ? (
            <>
              <Circle
                cx={routeProjection.end.x}
                cy={routeProjection.end.y}
                r="2.5"
                fill={theme.colors.accent}
                stroke={theme.colors.surface}
                strokeWidth="0.55"
              />
              <Circle
                cx={routeProjection.start.x}
                cy={routeProjection.start.y}
                r="2.2"
                fill={theme.colors.info}
                stroke={theme.colors.surface}
                strokeWidth="0.55"
              />
            </>
          ) : originPosition && selectedMarker ? (
            <>
              <Circle
                cx={selectedMarker.x}
                cy={selectedMarker.y}
                r="2.5"
                fill={theme.colors.accent}
                stroke={theme.colors.surface}
                strokeWidth="0.55"
              />
              <Circle
                cx={clamp(originPosition.x - (originPosition.x === selectedMarker.x ? 4 : 0), 5, 95)}
                cy={clamp(originPosition.y + (originPosition.y === selectedMarker.y ? 4 : 0), 5, 95)}
                r="2.2"
                fill={theme.colors.info}
                stroke={theme.colors.surface}
                strokeWidth="0.55"
              />
            </>
          ) : selectedMarker ? (
            <Circle cx={selectedMarker.x} cy={selectedMarker.y} r="2.5" fill={theme.colors.accent} stroke={theme.colors.surface} strokeWidth="0.55" />
          ) : null}
        </Svg>

        <Pressable
          style={styles.mapDismissLayer}
          onPress={clearSelection}
          accessibilityRole="button"
          accessibilityLabel="Deselect job"
          accessibilityHint="Closes the selected job preview and returns to the approximate area map."
        />

        <View style={[styles.areaLabel, styles.areaLabelOne]} pointerEvents="none">
          <Text style={styles.areaLabelText}>Doncaster</Text>
        </View>
        <View style={[styles.areaLabel, styles.areaLabelTwo]} pointerEvents="none">
          <Text style={styles.areaLabelText}>Rotherham</Text>
        </View>
        <View style={[styles.areaLabel, styles.areaLabelThree]} pointerEvents="none">
          <Text style={styles.areaLabelText}>Worksop</Text>
        </View>

        <View style={styles.topBar}>
          <View>
            <Text style={styles.mapTitle}>Approximate area map</Text>
            <Text style={styles.mapSubtle}>
              {jobs.length} {jobs.length === 1 ? "open job" : "open jobs"} · exact addresses hidden
            </Text>
          </View>
          <View style={styles.livePill}>
            <Ionicons name="shield-checkmark-outline" size={13} color={theme.colors.accent} />
            <Text style={styles.liveText}>Approx.</Text>
          </View>
        </View>

        {markers.map((marker) => {
          const isSelected = selectedMarker ? marker.job.id === selectedMarker.job.id : false;
          const match = matchesByJobId[marker.job.id];
          return (
            <Pressable
              key={marker.job.id}
              onPress={() => selectJob(marker.job.id)}
              accessibilityRole="button"
              accessibilityLabel={`${marker.job.title}, ${marker.area} area, ${match?.rank ? `rank ${match.rank}` : budgetFromJob(marker.job)}`}
              accessibilityHint="Selects this job on the map and opens its route preview summary."
              accessibilityState={{ selected: isSelected }}
              hitSlop={8}
              style={[
                styles.pin,
                { left: `${marker.x}%`, top: `${marker.y}%` },
                isSelected && styles.pinSelected,
              ]}
            >
              <View style={[styles.pinStem, isSelected && styles.pinStemSelected]} />
              <View style={[styles.pinHead, !marker.known && styles.pinFallback, isSelected && styles.pinHeadSelected]}>
                <Text style={[styles.pinText, isSelected && styles.pinTextSelected]}>
                  {match?.rank ? `#${match.rank}` : budgetFromJob(marker.job)}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {loading ? (
          <View style={styles.stateOverlay}>
            <Text style={styles.stateTitle}>Loading jobs...</Text>
            <Text style={styles.stateText}>Refreshing nearby open jobs.</Text>
          </View>
        ) : errorText ? (
          <View style={styles.stateOverlay}>
            <Text style={styles.stateTitle}>Map unavailable</Text>
            <Text style={styles.stateText}>{errorText}</Text>
          </View>
        ) : markers.length === 0 ? (
          <View style={styles.stateOverlay}>
            <Text style={styles.stateTitle}>No local jobs yet</Text>
            <Text style={styles.stateText}>Open jobs will appear here as area pins.</Text>
          </View>
        ) : null}

        {selectedJob && selectedMarker ? (
          <View style={[styles.sheet, isCompact && styles.sheetCompact]}>
            <View style={styles.grabber} />
            <>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetTitleBlock}>
                  <Text style={styles.sheetEyebrow}>{selectedMarker.area} area</Text>
                  <Text style={styles.sheetTitle} numberOfLines={2}>{selectedJob.title}</Text>
                </View>
                <View style={styles.sheetHeaderActions}>
                  <Text style={styles.sheetBudget}>{budgetFromJob(selectedJob)}</Text>
                  <Pressable
                    style={styles.iconButton}
                    onPress={clearSelection}
                    accessibilityRole="button"
                    accessibilityLabel="Close selected job preview"
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={16} color={theme.colors.text} />
                  </Pressable>
                </View>
              </View>

              <Text style={styles.sheetContext} numberOfLines={1}>
                {originDistrict ? `${originDistrict} area` : "Your area"} to {selectedMarker.area} area
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                {selectedMatch ? <Badge text={recommendationTier(selectedMatch)} tone="success" styles={styles} /> : null}
                <Badge text={`ETA ${selectedTime || "Unavailable"}`} tone="accent" styles={styles} />
                <Badge text={selectedMode} tone="neutral" styles={styles} />
                {selectedRate ? <Badge text={selectedRate} tone="neutral" styles={styles} /> : null}
              </ScrollView>

              <View style={styles.summaryRow}>
                <SummaryMetric icon="map-outline" label="Distance" value={selectedDistance || "Unavailable"} styles={styles} theme={theme} />
                <SummaryMetric icon="time-outline" label="Time" value={selectedTime || "Unavailable"} styles={styles} theme={theme} />
              </View>

              <View style={[styles.previewNotice, hasRealRouteGeometry ? styles.previewReady : styles.previewUnavailable]}>
                <Ionicons
                  name={hasRealRouteGeometry ? "git-branch-outline" : "remove-circle-outline"}
                  size={15}
                  color={hasRealRouteGeometry ? theme.colors.successText : theme.colors.warningText}
                />
                <Text style={styles.previewText}>
                  {hasRealRouteGeometry
                    ? previewUsesApproximatePoint
                      ? "Route preview from route-ai-agent using approximate area coordinates."
                      : "Route preview from route-ai-agent."
                    : "Route preview unavailable"}
                </Text>
              </View>

              <View style={styles.sheetActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => openJob(selectedJob.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${selectedJob.title}`}
                >
                  <Text style={styles.secondaryButtonText}>Open job</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => onNavigate?.(selectedJob)}
                  accessibilityRole="button"
                  accessibilityLabel={`Navigate to ${selectedMarker.area} area`}
                >
                  <Ionicons name="navigate" size={15} color={theme.colors.accentText} />
                  <Text style={styles.primaryButtonText}>Navigate</Text>
                </Pressable>
              </View>
            </>
          </View>
        ) : (
          <View style={styles.mapHint} pointerEvents="none">
            <Text style={styles.mapHintText}>Select a pin for travel details</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function Badge({
  text,
  tone,
  styles,
}: {
  text: string;
  tone: "accent" | "neutral" | "success";
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.badge, tone === "accent" && styles.badgeAccent, tone === "success" && styles.badgeSuccess]}>
      <Text style={styles.badgeText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function SummaryMetric({
  icon,
  label,
  value,
  styles,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}) {
  return (
    <View style={styles.summaryMetric}>
      <Ionicons name={icon} size={15} color={theme.colors.accent} />
      <View style={styles.summaryTextBlock}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    shell: {
      backgroundColor: theme.colors.bgDeep,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
      borderRadius: 8,
      overflow: "hidden",
    },
    mapArea: {
      minHeight: 560,
      position: "relative",
      overflow: "hidden",
      backgroundColor: theme.colors.mapBg,
    },
    mapAreaCompact: {
      minHeight: 500,
    },
    mapSvg: {
      ...StyleSheet.absoluteFillObject,
    },
    mapDismissLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1,
    },
    topBar: {
      position: "absolute",
      top: 14,
      left: 14,
      right: 14,
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      zIndex: 4,
    },
    areaLabel: {
      position: "absolute",
      zIndex: 2,
      backgroundColor: theme.colors.overlaySoft,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    areaLabelOne: {
      left: "36%",
      top: "21%",
    },
    areaLabelTwo: {
      left: "13%",
      top: "49%",
    },
    areaLabelThree: {
      right: "12%",
      bottom: "29%",
    },
    areaLabelText: {
      color: theme.colors.subtle,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "800",
    },
    mapTitle: {
      color: theme.colors.text,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
    },
    mapSubtle: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
      marginTop: 2,
    },
    livePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.overlaySoft,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.success,
    },
    liveText: {
      color: theme.colors.text,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
    },
    pin: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      transform: [{ translateX: -23 }, { translateY: -34 }],
      zIndex: 3,
    },
    pinSelected: {
      zIndex: 6,
      transform: [{ translateX: -27 }, { translateY: -39 }, { scale: 1.08 }],
    },
    pinHead: {
      minWidth: 46,
      height: 28,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceRaised,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
      paddingHorizontal: 9,
    },
    pinHeadSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.surface,
    },
    pinFallback: {
      borderStyle: "dashed",
    },
    pinText: {
      color: theme.colors.text,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
    },
    pinTextSelected: {
      color: theme.colors.accentText,
    },
    pinStem: {
      position: "absolute",
      bottom: -7,
      width: 9,
      height: 9,
      backgroundColor: theme.colors.surfaceRaised,
      borderRightColor: theme.colors.borderStrong,
      borderBottomColor: theme.colors.borderStrong,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      transform: [{ rotate: "45deg" }],
    },
    pinStemSelected: {
      backgroundColor: theme.colors.accent,
      borderRightColor: theme.colors.surface,
      borderBottomColor: theme.colors.surface,
    },
    stateOverlay: {
      position: "absolute",
      left: 18,
      right: 18,
      top: 96,
      backgroundColor: theme.colors.overlaySoft,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
      borderRadius: 8,
      padding: 14,
      gap: 4,
      zIndex: 8,
    },
    stateTitle: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
      textAlign: "center",
    },
    stateText: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      textAlign: "center",
    },
    sheet: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 12,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      gap: 8,
      zIndex: 10,
    },
    sheetCompact: {
      padding: 10,
      gap: 7,
    },
    grabber: {
      alignSelf: "center",
      width: 38,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.colors.borderStrong,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    sheetTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    sheetHeaderActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 0,
    },
    iconButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceAlt,
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    sheetEyebrow: {
      color: theme.colors.accent,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    sheetTitle: {
      color: theme.colors.text,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "900",
    },
    sheetBudget: {
      color: theme.colors.accent,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "900",
      flexShrink: 0,
    },
    sheetContext: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
    },
    badgeRow: {
      gap: 7,
      paddingRight: 8,
    },
    badge: {
      backgroundColor: theme.colors.chipBg,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      maxWidth: 180,
    },
    badgeAccent: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.accent,
    },
    badgeSuccess: {
      backgroundColor: theme.colors.successBg,
      borderColor: theme.colors.success,
    },
    badgeText: {
      color: theme.colors.text,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
    },
    routePanel: {
      backgroundColor: theme.colors.bg,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      gap: 8,
    },
    routePoint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    routeDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    routeTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    routeLabel: {
      color: theme.colors.subtle,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    routeValue: {
      color: theme.colors.text,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "800",
    },
    routeDivider: {
      width: 1,
      height: 12,
      backgroundColor: theme.colors.borderStrong,
      marginLeft: 4.5,
    },
    summaryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    summaryMetric: {
      flex: 1,
      minWidth: 132,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: theme.colors.surfaceAlt,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 8,
    },
    summaryTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    summaryLabel: {
      color: theme.colors.subtle,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    summaryValue: {
      color: theme.colors.text,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
    },
    previewNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 9,
      paddingVertical: 8,
    },
    previewReady: {
      backgroundColor: theme.colors.successBg,
      borderColor: theme.colors.success,
    },
    previewUnavailable: {
      backgroundColor: theme.colors.warningBg,
      borderColor: theme.colors.warning,
    },
    previewText: {
      color: theme.colors.text,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
      flex: 1,
    },
    sheetActions: {
      flexDirection: "row",
      gap: 10,
    },
    secondaryButton: {
      flex: 1,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
    },
    primaryButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      backgroundColor: theme.colors.accent,
      borderRadius: 8,
      paddingVertical: 10,
    },
    primaryButtonText: {
      color: theme.colors.accentText,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
    },
    mapHint: {
      position: "absolute",
      left: 14,
      right: 14,
      bottom: 14,
      zIndex: 5,
      alignItems: "center",
    },
    mapHintText: {
      color: theme.colors.text,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
      backgroundColor: theme.colors.overlaySoft,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
  });
}
