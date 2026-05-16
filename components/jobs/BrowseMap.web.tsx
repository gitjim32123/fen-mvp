import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { TrustBanner } from "../ui/Premium";
import { theme } from "../ui/theme";
import type { Job } from "../../lib/types";
import { normalizeCategory } from "../../lib/categories";

function areaFromJob(job: Job): string {
  return (job as any).postcode_district || job.postcode || "Area";
}

function budgetFromJob(job: Job): string {
  return typeof job.budget_gbp === "number" ? `£${job.budget_gbp}` : "Budget set";
}

export default function BrowseMap({ jobs, onJobPress }: { jobs: Job[]; selectedId?: string; onJobPress?: (jobId: string) => void }) {
  const visibleJobs = jobs.slice(0, 5);
  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const markerPositions = [
    { top: "18%", left: "50%", transform: [{ translateX: -64 }] },
    { top: "38%", left: "63%" },
    { top: "58%", left: "34%" },
    { top: "30%", left: "21%" },
    { top: "66%", left: "58%" },
  ];
  const areas = Array.from(new Set(jobs.map(areaFromJob).filter(Boolean))).slice(0, 3);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2400,
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
    const sweepLoop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    sweepLoop.start();

    return () => {
      pulseLoop.stop();
      sweepLoop.stop();
    };
  }, [pulse, sweep]);

  const pulseStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.2] }) }],
  };
  const sweepStyle = {
    transform: [
      {
        rotate: sweep.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "360deg"],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        <View style={styles.backGlow} />
        <Animated.View style={[styles.radarPulse, pulseStyle]} />
        <View style={styles.radarRingOuter} />
        <View style={styles.radarRingMiddle} />
        <View style={styles.radarRingInner} />
        <Animated.View style={[styles.sweep, sweepStyle]} />
        <View style={styles.crosshairHorizontal} />
        <View style={styles.crosshairVertical} />
        <View style={styles.centerNode} />
        <View style={styles.summaryPanel}>
          <Text style={styles.kicker}>Nearby activity</Text>
          <Text style={styles.count}>{jobs.length}</Text>
          <Text style={styles.label}>{jobs.length === 1 ? "open job" : "open jobs"} in view</Text>
          <Text style={styles.helper}>Approximate area activity, not live routing.</Text>
          {areas.length > 0 && (
            <Text style={styles.areaLine} numberOfLines={1}>
              {areas.join(" · ")}
            </Text>
          )}
        </View>
        <View style={styles.markerLayer}>
          {visibleJobs.map((job, index) => (
            <Pressable
              key={job.id}
              style={[styles.marker, markerPositions[index]]}
              onPress={() => onJobPress?.(job.id)}
            >
              <View style={styles.markerStem}>
                <View style={styles.markerHalo} />
                <View style={styles.markerDot} />
              </View>
              <View style={styles.markerCard}>
                <Text style={styles.markerArea} numberOfLines={1}>{areaFromJob(job)}</Text>
                <Text style={styles.markerMeta} numberOfLines={1}>
                  {normalizeCategory(job.category)}
                </Text>
                <Text style={styles.markerBudget} numberOfLines={1}>{budgetFromJob(job)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        {visibleJobs.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No local activity in this view</Text>
            <Text style={styles.emptyText}>Open jobs will appear here as area markers.</Text>
          </View>
        )}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>Area marker</Text>
          </View>
          <Text style={styles.legendNote}>Exact address stays hidden</Text>
        </View>
      </View>
      <TrustBanner title="Approximate area preview">
        This panel shows local activity from job areas and filters. It is not live navigation, and exact addresses stay hidden until a helper is chosen.
      </TrustBanner>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
  },
  preview: {
    minHeight: 280,
    backgroundColor: "#100B18",
    borderColor: "rgba(181, 108, 255, 0.22)",
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    overflow: "hidden",
    position: "relative",
  },
  backGlow: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(181, 108, 255, 0.08)",
    shadowColor: "#B56CFF",
    shadowOpacity: 0.45,
    shadowRadius: 52,
  },
  radarPulse: {
    position: "absolute",
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 1,
    borderColor: "rgba(181, 108, 255, 0.32)",
    backgroundColor: "rgba(181, 108, 255, 0.05)",
  },
  radarRingOuter: {
    position: "absolute",
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 1,
    borderColor: "rgba(181, 108, 255, 0.18)",
  },
  radarRingMiddle: {
    position: "absolute",
    width: 192,
    height: 192,
    borderRadius: 96,
    borderWidth: 1,
    borderColor: "rgba(203, 184, 241, 0.14)",
  },
  radarRingInner: {
    position: "absolute",
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: "rgba(181, 108, 255, 0.28)",
  },
  sweep: {
    position: "absolute",
    width: 270,
    height: 270,
    borderRadius: 135,
    borderTopWidth: 1,
    borderTopColor: "rgba(181, 108, 255, 0.34)",
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
    top: "12%",
    bottom: "12%",
    left: "50%",
    width: 1,
    backgroundColor: "rgba(203, 184, 241, 0.08)",
  },
  centerNode: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#F0E2FF",
    borderWidth: 2,
    borderColor: "#B56CFF",
    shadowColor: "#B56CFF",
    shadowOpacity: 0.55,
    shadowRadius: 12,
  },
  summaryPanel: {
    position: "absolute",
    left: 14,
    bottom: 14,
    backgroundColor: "rgba(14, 10, 20, 0.9)",
    borderColor: "rgba(181, 108, 255, 0.2)",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxWidth: 204,
  },
  kicker: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  count: {
    color: theme.colors.text,
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 44,
  },
  label: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  helper: {
    color: "#A590C9",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  areaLine: {
    color: "#E7D9FF",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 8,
  },
  markerLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  marker: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    maxWidth: 168,
  },
  markerStem: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  markerHalo: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(181, 108, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(181, 108, 255, 0.24)",
  },
  markerDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: "#F0E2FF",
    shadowColor: "#B56CFF",
    shadowOpacity: 0.55,
    shadowRadius: 9,
  },
  markerCard: {
    minWidth: 104,
    maxWidth: 132,
    backgroundColor: "rgba(28, 19, 42, 0.88)",
    borderColor: "rgba(231, 217, 255, 0.12)",
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  markerArea: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  markerMeta: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  markerBudget: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 1,
  },
  emptyState: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 22,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 15,
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
    position: "absolute",
    right: 14,
    top: 14,
    backgroundColor: "rgba(14, 10, 20, 0.86)",
    borderColor: "rgba(181, 108, 255, 0.18)",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
