import { Pressable, StyleSheet, Text, View } from "react-native";
import { TrustBanner } from "../ui/Premium";
import { theme } from "../ui/theme";
import type { Job } from "../../lib/types";

function areaFromJob(job: Job): string {
  return (job as any).postcode_district || job.postcode || "Area";
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
        <View style={styles.gridLineHorizontal} />
        <View style={styles.gridLineVertical} />
        <View style={styles.summaryPanel}>
          <Text style={styles.count}>{jobs.length}</Text>
          <Text style={styles.label}>open jobs</Text>
          <Text style={styles.helper}>Tap an area marker to open a job.</Text>
        </View>
        <View style={styles.markerLayer}>
          {visibleJobs.map((job, index) => (
            <Pressable
              key={job.id}
              style={[styles.marker, markerPositions[index]]}
              onPress={() => onJobPress?.(job.id)}
            >
              <Text style={styles.markerTitle} numberOfLines={1}>{job.title}</Text>
              <Text style={styles.markerArea} numberOfLines={1}>{areaFromJob(job)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <TrustBanner title="Area-first privacy">
        This web preview uses job areas only. Exact addresses stay hidden until a helper is chosen.
      </TrustBanner>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
  },
  preview: {
    minHeight: 170,
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
    width: 126,
    backgroundColor: "#2A1E3D",
    borderColor: theme.colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  markerTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  markerArea: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
});
