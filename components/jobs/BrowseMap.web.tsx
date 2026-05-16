import { Pressable, StyleSheet, Text, View } from "react-native";
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
  const visibleJobs = jobs.slice(0, 6);
  const markerPositions = [
    { top: "18%", left: "12%" },
    { top: "34%", left: "58%" },
    { top: "58%", left: "26%" },
    { top: "68%", left: "68%" },
    { top: "42%", left: "36%" },
    { top: "20%", left: "78%" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        <View style={styles.radarRingOuter} />
        <View style={styles.radarRingInner} />
        <View style={styles.gridLineHorizontal} />
        <View style={styles.gridLineVertical} />
        <View style={styles.summaryPanel}>
          <Text style={styles.kicker}>Local job radar</Text>
          <Text style={styles.count}>{jobs.length}</Text>
          <Text style={styles.label}>visible open jobs</Text>
          <Text style={styles.helper}>Approximate area view, not a route map.</Text>
        </View>
        <View style={styles.markerLayer}>
          {visibleJobs.map((job, index) => (
            <Pressable
              key={job.id}
              style={[styles.marker, markerPositions[index]]}
              onPress={() => onJobPress?.(job.id)}
            >
              <View style={styles.markerDot} />
              <Text style={styles.markerArea} numberOfLines={1}>{areaFromJob(job)}</Text>
              <Text style={styles.markerMeta} numberOfLines={1}>
                {normalizeCategory(job.category)} · {budgetFromJob(job)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>Open job area</Text>
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
    minHeight: 230,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    overflow: "hidden",
    position: "relative",
  },
  radarRingOuter: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: "rgba(181, 108, 255, 0.16)",
  },
  radarRingInner: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    borderColor: "rgba(181, 108, 255, 0.25)",
  },
  gridLineHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 1,
    backgroundColor: "#2F2441",
  },
  gridLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    backgroundColor: "#2F2441",
  },
  summaryPanel: {
    position: "absolute",
    left: 14,
    bottom: 14,
    backgroundColor: "rgba(14, 10, 20, 0.88)",
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: 168,
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
    fontSize: 38,
    fontWeight: "800",
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
  markerLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  marker: {
    position: "absolute",
    minWidth: 122,
    maxWidth: 152,
    backgroundColor: "rgba(42, 30, 61, 0.94)",
    borderColor: theme.colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: "#B56CFF",
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
    marginBottom: 5,
  },
  markerArea: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  markerMeta: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  legend: {
    position: "absolute",
    right: 14,
    top: 14,
    backgroundColor: "rgba(14, 10, 20, 0.82)",
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
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
