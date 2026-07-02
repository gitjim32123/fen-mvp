import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import {
  formatMatchHourlyRate,
  formatMatchTravelTime,
  modeLabel,
  recommendationTier,
} from "../../lib/jobMatching";
import { getWebMapConfig, isMapLibreWebConfigured } from "../../lib/mapProvider";
import { preparePublicBrowseJobPoints, type PublicBrowseJobPoint } from "../../lib/mapPrivacy";
import { routeQuoteDisplayName } from "../../lib/routeQuotes";
import type { Job } from "../../lib/types";
import { useTheme } from "../ui/ThemeProvider";
import type { Theme } from "../ui/theme";
import BrowseMapBase, { type BrowseMapProps } from "./BrowseMapBase";

type JobPoint = PublicBrowseJobPoint<Job>;

type MapLibreModule = typeof import("maplibre-gl");

const DEFAULT_CENTER: [number, number] = [-1.14, 53.52];
const DEFAULT_ZOOM = 9.2;

export default function StreetBrowseMap(props: BrowseMapProps) {
  const config = getWebMapConfig();
  if (!isMapLibreWebConfigured(config)) {
    return <BrowseMapBase {...props} />;
  }

  return <MapLibreBrowseMap {...props} attribution={config.attribution} styleUrl={config.styleUrl as string} />;
}

function MapLibreBrowseMap({
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
  styleUrl,
  attribution,
}: BrowseMapProps & { styleUrl: string; attribution: string | null }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [providerFailed, setProviderFailed] = useState(false);
  const [jobPoints, setJobPoints] = useState<JobPoint[]>([]);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const activeId = selectedId !== undefined ? selectedId : localSelectedId;
  const selectedJobPoint = activeId ? jobPoints.find((item) => item.job.id === activeId) || null : null;
  const selectedJob = selectedJobPoint?.job || null;
  const selectedMatch = selectedJob ? matchesByJobId[selectedJob.id] : undefined;
  const selectedPreview = selectedJob ? routePreviewByJobId[selectedJob.id] : undefined;
  const selectedGeometry = selectedJob ? routeGeometryByJobId[selectedJob.id] : undefined;
  const selectedTravel = selectedJob ? travelByJobId[selectedJob.id] : undefined;
  const selectedMode = selectedPreview?.mode ? routeQuoteDisplayName(selectedPreview.mode) : modeLabel(selectedMatch?.best_mode);
  const selectedTime = selectedPreview?.time || (selectedMatch ? formatMatchTravelTime(selectedMatch) : cleanSummary(selectedTravel?.time));
  const selectedRate = selectedMatch ? formatMatchHourlyRate(selectedMatch) : null;
  const selectedDistance = selectedPreview?.distance || cleanSummary(selectedTravel?.distance);
  const hasRealRouteGeometry = !!selectedGeometry && selectedGeometry.points.length >= 2;
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
    let active = true;

    async function loadJobPoints() {
      const nextPoints = await preparePublicBrowseJobPoints(jobs);
      if (!active) return;
      if (active) setJobPoints(nextPoints);
    }

    loadJobPoints();
    return () => {
      active = false;
    };
  }, [jobs]);

  useEffect(() => {
    let active = true;
    if (!mapContainerRef.current || mapRef.current) return;

    import("maplibre-gl")
      .then((module) => {
        if (!active || !mapContainerRef.current) return;
        maplibreRef.current = module;
        const maplibregl = getMapLibreRuntime(module);
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: styleUrl,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: false,
        });
        mapRef.current = map;
        map.on("load", () => {
          if (active) setMapReady(true);
        });
        map.on("click", clearSelection);
        map.on("error", () => {
          if (active) setProviderFailed(true);
        });
      })
      .catch(() => {
        if (active) setProviderFailed(true);
      });

    return () => {
      active = false;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = getMapLibreRuntime(maplibreRef.current);
    if (!map || !maplibregl || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = jobPoints.map(({ job, point, area }) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `fen-map-pin${job.id === activeId ? " fen-map-pin-selected" : ""}`;
      element.textContent = matchesByJobId[job.id]?.rank ? `#${matchesByJobId[job.id].rank}` : budgetFromJob(job);
      element.setAttribute("aria-label", `${job.title}, ${area} area`);
      element.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectJob(job.id);
      };
      return new maplibregl.Marker({ element, anchor: "bottom" })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
    });
  }, [activeId, jobPoints, mapReady, matchesByJobId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource("fen-selected-route") as { setData: (data: unknown) => void } | undefined;
    const coordinates = hasRealRouteGeometry
      ? selectedGeometry.points.map((point) => [point.longitude, point.latitude])
      : [];
    const data: any = {
      type: "FeatureCollection",
      features: coordinates.length >= 2
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates },
            },
          ]
        : [],
    };

    if (source) {
      source.setData(data);
      return;
    }

    map.addSource("fen-selected-route", { type: "geojson", data });
    map.addLayer({
      id: "fen-selected-route-line",
      type: "line",
      source: "fen-selected-route",
      paint: {
        "line-color": theme.colors.accent,
        "line-width": 4,
        "line-opacity": 0.85,
      },
    });
  }, [hasRealRouteGeometry, mapReady, selectedGeometry, theme.colors.accent]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const routeCoordinates = hasRealRouteGeometry
      ? selectedGeometry.points.map((point) => [point.longitude, point.latitude] as [number, number])
      : [];
    if (routeCoordinates.length >= 2) {
      fitCoordinates(map, routeCoordinates);
      return;
    }
    if (selectedJobPoint) {
      map.easeTo({
        center: [selectedJobPoint.point.longitude, selectedJobPoint.point.latitude],
        zoom: Math.max(map.getZoom(), 11),
        duration: 450,
      });
      return;
    }
    if (jobPoints.length > 1) {
      fitCoordinates(map, jobPoints.map((item) => [item.point.longitude, item.point.latitude]));
    } else if (jobPoints.length === 1) {
      map.easeTo({
        center: [jobPoints[0].point.longitude, jobPoints[0].point.latitude],
        zoom: 11,
        duration: 450,
      });
    }
  }, [hasRealRouteGeometry, jobPoints, mapReady, selectedGeometry, selectedJobPoint]);

  if (providerFailed) {
    return <BrowseMapBase jobs={jobs} selectedId={selectedId} originDistrict={originDistrict} travelByJobId={travelByJobId} matchesByJobId={matchesByJobId} routeGeometryByJobId={routeGeometryByJobId} routePreviewByJobId={routePreviewByJobId} loading={loading} errorText={errorText} onJobPress={onJobPress} onJobSelect={onJobSelect} onOpenJob={onOpenJob} onNavigate={onNavigate} />;
  }

  return (
    <View style={styles.shell}>
      <style>{mapCss(theme)}</style>
      <View style={styles.mapArea}>
        <div ref={mapContainerRef} style={mapContainerStyle} />
        <View style={styles.topBar} pointerEvents="box-none">
          <View style={styles.titlePill}>
            <Text style={styles.mapTitle}>Street map preview</Text>
            <Text style={styles.mapSubtle}>
              Approximate public areas. Exact addresses hidden.
            </Text>
          </View>
          <View style={styles.mapControls}>
            <Pressable style={styles.controlButton} onPress={() => mapRef.current?.zoomIn()} accessibilityRole="button" accessibilityLabel="Zoom in">
              <Ionicons name="add" size={16} color={theme.colors.text} />
            </Pressable>
            <Pressable style={styles.controlButton} onPress={() => mapRef.current?.zoomOut()} accessibilityRole="button" accessibilityLabel="Zoom out">
              <Ionicons name="remove" size={16} color={theme.colors.text} />
            </Pressable>
          </View>
        </View>

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
        ) : jobs.length > 0 && jobPoints.length === 0 ? (
          <View style={styles.stateOverlay}>
            <Text style={styles.stateTitle}>Area pins unavailable</Text>
            <Text style={styles.stateText}>Open jobs still need a mappable postcode district.</Text>
          </View>
        ) : null}

        {selectedJob && selectedJobPoint ? (
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleBlock}>
                <Text style={styles.sheetEyebrow}>{selectedJobPoint.area} area</Text>
                <Text style={styles.sheetTitle} numberOfLines={2}>{selectedJob.title}</Text>
              </View>
              <View style={styles.sheetHeaderActions}>
                <Text style={styles.sheetBudget}>{budgetFromJob(selectedJob)}</Text>
                <Pressable style={styles.iconButton} onPress={clearSelection} accessibilityRole="button" accessibilityLabel="Close selected job preview" hitSlop={8}>
                  <Ionicons name="close" size={16} color={theme.colors.text} />
                </Pressable>
              </View>
            </View>

            <Text style={styles.sheetContext} numberOfLines={1}>
              {originDistrict ? `${originDistrict} area` : "Your area"} to {selectedJobPoint.area} area
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
              <Pressable style={styles.secondaryButton} onPress={() => openJob(selectedJob.id)} accessibilityRole="button" accessibilityLabel={`Open ${selectedJob.title}`}>
                <Text style={styles.secondaryButtonText}>Open job</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => onNavigate?.(selectedJob)} accessibilityRole="button" accessibilityLabel={`Navigate to ${selectedJobPoint.area} area`}>
                <Ionicons name="navigate" size={15} color={theme.colors.accentText} />
                <Text style={styles.primaryButtonText}>Navigate</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.mapHint} pointerEvents="none">
            <Text style={styles.mapHintText}>Select a pin for travel details</Text>
          </View>
        )}

        {attribution ? (
          <Text style={styles.attribution} numberOfLines={1}>{attribution}</Text>
        ) : null}
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

function budgetFromJob(job: Job) {
  return typeof job.budget_gbp === "number" ? `£${job.budget_gbp}` : "Budget set";
}

function cleanSummary(value?: string | null) {
  if (!value) return null;
  return value.replace("Travel estimate unavailable until both postcode areas are known.", "Unavailable");
}

function fitCoordinates(map: MapLibreMap, coordinates: [number, number][]) {
  if (coordinates.length === 0) return;
  const lngs = coordinates.map(([longitude]) => longitude);
  const lats = coordinates.map(([, latitude]) => latitude);
  map.fitBounds(
    [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    { padding: 72, maxZoom: 12.5, duration: 500 }
  );
}

function getMapLibreRuntime(module: MapLibreModule | null) {
  if (!module) return null;
  return (module as any).default || module;
}

const mapContainerStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
};

function mapCss(theme: Theme) {
  return `
    .fen-map-pin {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 42px;
      height: 30px;
      padding: 0 10px;
      border: 1px solid ${theme.colors.borderStrong};
      border-radius: 999px;
      background: ${theme.colors.surfaceRaised};
      color: ${theme.colors.text};
      font-weight: 900;
      font-size: 11px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
      pointer-events: auto;
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
    }
    .maplibregl-marker {
      z-index: 6;
    }
    .fen-map-pin-selected {
      background: ${theme.colors.accent};
      color: ${theme.colors.accentText};
      border-color: ${theme.colors.surface};
      transform: scale(1.08);
      z-index: 8;
    }
  `;
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
    titlePill: {
      backgroundColor: theme.colors.overlaySoft,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      maxWidth: 300,
    },
    mapTitle: {
      color: theme.colors.text,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "900",
    },
    mapSubtle: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
      marginTop: 2,
    },
    mapControls: {
      gap: 8,
    },
    controlButton: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.overlaySoft,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
      borderRadius: 8,
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
    attribution: {
      position: "absolute",
      right: 8,
      bottom: 4,
      zIndex: 3,
      maxWidth: 320,
      color: theme.colors.subtle,
      backgroundColor: theme.colors.overlaySoft,
      fontSize: 10,
      lineHeight: 13,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 4,
    },
  });
}
