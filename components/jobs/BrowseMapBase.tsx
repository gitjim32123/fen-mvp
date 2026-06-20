import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";
import { normalizeCategory } from "../../lib/categories";
import { getDistrictPosition, normalizePostcodeDistrict } from "../../lib/postcodeDistricts";
import type { Job } from "../../lib/types";
import { useTheme } from "../ui/ThemeProvider";
import type { Theme } from "../ui/theme";

type DistrictGroup = {
  district: string;
  jobs: Job[];
  x: number;
  y: number;
  known: boolean;
};

type Props = {
  jobs: Job[];
  selectedId?: string;
  onJobPress?: (jobId: string) => void;
};

function districtFromJob(job: Job) {
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
  return "";
}

function groupJobsByDistrict(jobs: Job[]): DistrictGroup[] {
  const grouped = new Map<string, Job[]>();
  for (const job of jobs) {
    if (!job?.id) continue;
    const district = districtFromJob(job);
    grouped.set(district, [...(grouped.get(district) || []), job]);
  }

  return Array.from(grouped.entries())
    .map(([district, groupJobs]) => {
      const position = getDistrictPosition(district);
      return {
        district,
        jobs: groupJobs,
        ...position,
      };
    })
    .sort((left, right) => right.jobs.length - left.jobs.length || left.district.localeCompare(right.district))
    .slice(0, 8);
}

function markerSummary(group: DistrictGroup) {
  if (group.jobs.length > 1) return `${group.jobs.length} jobs`;
  return budgetFromJob(group.jobs[0]);
}

function getMapPalette(theme: Theme) {
  return {
    bg: theme.colors.mapBg,
    land: theme.colors.mapLand,
    landStroke: theme.colors.borderStrong,
    water: theme.colors.mapWater,
    road: theme.colors.mapRoad,
    minorRoad: theme.colors.border,
    grid: theme.colors.border,
    centerFill: theme.colors.surfaceAlt,
    centerStroke: theme.colors.borderStrong,
    markerHalo: theme.colors.accentSoft,
    markerHaloSelected: theme.colors.surfaceAlt,
    markerCard: theme.colors.surfaceRaised,
    markerCardBorder: theme.colors.border,
    markerSelectedBorder: theme.colors.accent,
    markerDotBorder: theme.colors.surface,
  };
}

export default function BrowseMapBase({ jobs, selectedId, onJobPress }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mapPalette = useMemo(() => getMapPalette(theme), [theme]);
  const groups = groupJobsByDistrict(jobs);
  const areas = groups.map((group) => group.district).slice(0, 4);

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <View style={styles.summaryTitleRow}>
          <Text style={styles.kicker}>Approximate local map</Text>
          <Text style={styles.summaryCount}>
            {jobs.length} {jobs.length === 1 ? "open job" : "open jobs"}
          </Text>
        </View>
        <View style={styles.summaryMetaRow}>
          <Text style={styles.helper}>Postcode districts only</Text>
          {areas.length > 0 && (
            <Text style={styles.areas} numberOfLines={1}>
              {areas.join(" · ")}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.mapArea}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={styles.mapSvg}>
          <Rect x="0" y="0" width="100" height="100" rx="6" fill={mapPalette.bg} />
          <Path
            d="M13 18 C22 9 39 10 50 15 C64 20 78 17 88 29 C97 40 88 55 91 71 C80 83 63 88 47 84 C31 81 18 85 9 73 C2 62 12 48 9 35 C8 28 9 23 13 18 Z"
            fill={mapPalette.land}
            stroke={mapPalette.landStroke}
            strokeWidth="0.7"
          />
          <Path
            d="M19 70 C31 61 38 61 48 54 C58 47 65 38 80 32"
            stroke={mapPalette.water}
            strokeWidth="1.4"
            fill="none"
          />
          <Polyline
            points="15,45 28,43 38,48 52,45 67,51 84,49"
            stroke={mapPalette.road}
            strokeWidth="0.65"
            fill="none"
          />
          <Polyline
            points="27,18 31,30 29,42 33,56 30,72"
            stroke={mapPalette.minorRoad}
            strokeWidth="0.55"
            fill="none"
          />
          <Polyline
            points="61,18 56,31 60,45 55,60 58,78"
            stroke={mapPalette.minorRoad}
            strokeWidth="0.55"
            fill="none"
          />
          <Line x1="8" y1="28" x2="91" y2="28" stroke={mapPalette.grid} strokeWidth="0.45" />
          <Line x1="8" y1="72" x2="91" y2="72" stroke={mapPalette.grid} strokeWidth="0.45" />
          <Line x1="22" y1="10" x2="22" y2="88" stroke={mapPalette.grid} strokeWidth="0.45" />
          <Line x1="78" y1="12" x2="78" y2="86" stroke={mapPalette.grid} strokeWidth="0.45" />
          <Circle cx="49" cy="45" r="2.8" fill={mapPalette.centerFill} stroke={mapPalette.centerStroke} strokeWidth="0.4" />
        </Svg>

        {groups.map((group) => {
          const topJob = group.jobs[0];
          const isSelected = group.jobs.some((job) => job.id === selectedId);
          const alignRight = group.x > 58;
          const category = shortCategoryFromJob(topJob);
          return (
            <Pressable
              key={group.district}
              onPress={() => onJobPress?.(topJob.id)}
              style={[
                styles.marker,
                alignRight && styles.markerRight,
                { left: `${group.x}%`, top: `${group.y}%` },
              ]}
            >
              <View style={[styles.markerDotWrap, isSelected && styles.markerDotWrapSelected, !group.known && styles.markerDotWrapFallback]}>
                <View style={styles.markerDot} />
              </View>
              <View style={[styles.markerCard, isSelected && styles.markerCardSelected]}>
                <Text style={styles.markerArea} numberOfLines={1}>
                  {group.district} area
                </Text>
                <View style={styles.markerLine}>
                  <Text style={styles.markerBudget} numberOfLines={1}>
                    {markerSummary(group)}
                  </Text>
                  {!!category && (
                    <Text style={styles.markerMeta} numberOfLines={1}>
                      {category}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}

        {groups.length === 0 && (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyTitle}>No local jobs yet</Text>
            <Text style={styles.emptyText}>New jobs will appear here by approximate area.</Text>
          </View>
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>District marker</Text>
        </View>
        <Text style={styles.legendNote}>Exact address hidden</Text>
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
  container: {
    backgroundColor: theme.colors.mapBg,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  summary: {
    backgroundColor: theme.colors.overlaySoft,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
  },
  summaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  mapArea: {
    minHeight: 272,
    position: "relative",
    backgroundColor: theme.colors.mapBg,
    overflow: "hidden",
  },
  mapSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  kicker: {
    color: theme.colors.accent,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  summaryCount: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  helper: {
    color: theme.colors.subtle,
    fontSize: 9,
    fontWeight: "700",
  },
  areas: {
    color: theme.colors.text,
    fontSize: 9,
    fontWeight: "800",
    maxWidth: 190,
  },
  marker: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 132,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  markerRight: {
    flexDirection: "row-reverse",
    transform: [{ translateX: -116 }, { translateY: -8 }],
  },
  markerDotWrap: {
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accent,
    borderWidth: 1,
  },
  markerDotWrapSelected: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.accent,
  },
  markerDotWrapFallback: {
    borderStyle: "dashed",
  },
  markerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: theme.colors.surface,
  },
  markerCard: {
    minWidth: 88,
    maxWidth: 108,
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  markerCardSelected: {
    borderColor: theme.colors.accent,
  },
  markerArea: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: "800",
  },
  markerLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 1,
  },
  markerMeta: {
    color: theme.colors.muted,
    fontSize: 8,
    fontWeight: "800",
    maxWidth: 42,
  },
  markerBudget: {
    color: theme.colors.accent,
    fontSize: 10,
    fontWeight: "900",
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 22,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: theme.colors.overlaySoft,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  legendText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "800",
  },
  legendNote: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  });
}
