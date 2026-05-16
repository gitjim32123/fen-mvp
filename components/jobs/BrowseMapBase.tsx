import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { normalizeCategory } from "../../lib/categories";
import type { Job } from "../../lib/types";
import { theme } from "../ui/theme";

type Pin = {
  x: number;
  y: number;
  id: string;
  job: Job;
};

type Props = {
  jobs: Job[];
  selectedId?: string;
  onJobPress?: (jobId: string) => void;
};

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function areaFromJob(job: Job) {
  return (job as any).postcode_district || job.postcode || "Area";
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

function pinsFromJobs(jobs: Job[]): Pin[] {
  const positions = [
    { x: 47, y: 20 },
    { x: 64, y: 47 },
    { x: 30, y: 58 },
  ];

  return jobs.filter((job) => job?.id).slice(0, 3).map((job, index) => {
    const fallback = hashStr(job.id + areaFromJob(job));
    const position = positions[index] ?? { x: 20 + (fallback % 58), y: 24 + ((fallback >> 8) % 42) };
    return {
      ...position,
      id: job.id,
      job,
    };
  });
}

export default function BrowseMapBase({ jobs, selectedId, onJobPress }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const pins = pinsFromJobs(jobs);
  const areas = Array.from(new Set(jobs.map(areaFromJob).filter(Boolean))).slice(0, 2);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const pulseStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.16] }) }],
  };

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <View style={styles.summaryTitleRow}>
          <Text style={styles.kicker}>Nearby activity</Text>
          <Text style={styles.summaryCount}>
            {jobs.length} {jobs.length === 1 ? "open job" : "open jobs"}
          </Text>
        </View>
        <View style={styles.summaryMetaRow}>
          <Text style={styles.helper}>Approximate area view</Text>
          {areas.length > 0 && (
            <Text style={styles.areas} numberOfLines={1}>
              {areas.join(" · ")}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.mapArea}>
        <View style={styles.backGlow} />
        <Animated.View style={[styles.pulseRing, pulseStyle]} />
        <View style={styles.ringOuter} />
        <View style={styles.ringMiddle} />
        <View style={styles.ringInner} />
        <View style={styles.crosshairHorizontal} />
        <View style={styles.crosshairVertical} />
        <View style={styles.centerNode} />

        {pins.map((pin) => {
          const isSelected = pin.id === selectedId;
          return (
            <Pressable
              key={pin.id}
              onPress={() => onJobPress?.(pin.id)}
              style={[styles.marker, { left: `${pin.x}%`, top: `${pin.y}%` }]}
            >
              <View style={[styles.markerDotWrap, isSelected && styles.markerDotWrapSelected]}>
                <View style={styles.markerDot} />
              </View>
              <View style={[styles.markerCard, isSelected && styles.markerCardSelected]}>
                <Text style={styles.markerArea} numberOfLines={1}>
                  {areaFromJob(pin.job)}
                </Text>
                <View style={styles.markerLine}>
                  <Text style={styles.markerBudget} numberOfLines={1}>
                    {budgetFromJob(pin.job)}
                  </Text>
                  {!!shortCategoryFromJob(pin.job) && (
                    <Text style={styles.markerMeta} numberOfLines={1}>
                      {shortCategoryFromJob(pin.job)}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}

        {pins.length === 0 && (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyTitle}>No local activity here yet</Text>
            <Text style={styles.emptyText}>Open jobs will appear as area markers.</Text>
          </View>
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>Area marker</Text>
        </View>
        <Text style={styles.legendNote}>Exact address hidden</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#100B18",
    borderColor: "rgba(181, 108, 255, 0.22)",
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  summary: {
    backgroundColor: "rgba(14, 10, 20, 0.94)",
    borderBottomColor: "rgba(181, 108, 255, 0.14)",
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
    minHeight: 252,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#100B18",
    overflow: "hidden",
    padding: theme.spacing.md,
  },
  backGlow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(181, 108, 255, 0.08)",
  },
  pulseRing: {
    position: "absolute",
    width: 242,
    height: 242,
    borderRadius: 121,
    borderWidth: 1,
    borderColor: "rgba(181, 108, 255, 0.32)",
    backgroundColor: "rgba(181, 108, 255, 0.05)",
  },
  ringOuter: {
    position: "absolute",
    width: 228,
    height: 228,
    borderRadius: 114,
    borderWidth: 1,
    borderColor: "rgba(181, 108, 255, 0.18)",
  },
  ringMiddle: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: "rgba(203, 184, 241, 0.14)",
  },
  ringInner: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: "rgba(181, 108, 255, 0.28)",
  },
  crosshairHorizontal: {
    position: "absolute",
    left: "16%",
    right: "16%",
    top: "50%",
    height: 1,
    backgroundColor: "rgba(203, 184, 241, 0.08)",
  },
  crosshairVertical: {
    position: "absolute",
    top: "15%",
    bottom: "15%",
    left: "50%",
    width: 1,
    backgroundColor: "rgba(203, 184, 241, 0.08)",
  },
  centerNode: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#F0E2FF",
    borderWidth: 2,
    borderColor: "#B56CFF",
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
    color: "#A590C9",
    fontSize: 9,
    fontWeight: "700",
  },
  areas: {
    color: "#E7D9FF",
    fontSize: 9,
    fontWeight: "800",
    maxWidth: 170,
  },
  marker: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 116,
  },
  markerDotWrap: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(181, 108, 255, 0.16)",
    borderColor: "rgba(181, 108, 255, 0.24)",
    borderWidth: 1,
  },
  markerDotWrapSelected: {
    backgroundColor: "rgba(240, 226, 255, 0.2)",
    borderColor: "#F0E2FF",
  },
  markerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: "#F0E2FF",
  },
  markerCard: {
    minWidth: 78,
    maxWidth: 92,
    backgroundColor: "rgba(28, 19, 42, 0.9)",
    borderColor: "rgba(231, 217, 255, 0.12)",
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  markerCardSelected: {
    borderColor: "rgba(181, 108, 255, 0.65)",
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
    alignItems: "center",
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
    backgroundColor: "rgba(14, 10, 20, 0.92)",
    borderTopColor: "rgba(181, 108, 255, 0.14)",
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
