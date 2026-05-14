import { Pressable, StyleSheet, Text, View } from "react-native";
import { TrustBanner } from "../ui/Premium";
import { theme } from "../ui/theme";
import type { Job } from "../../lib/types";

function areaFromJob(job: Job): string {
  return (job as any).postcode_district || job.postcode || "Area";
}

export default function BrowseMap({ jobs, onJobPress }: { jobs: Job[]; selectedId?: string; onJobPress?: (jobId: string) => void }) {
  const visibleJobs = jobs.slice(0, 5);

  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        <Text style={styles.count}>{jobs.length}</Text>
        <Text style={styles.label}>open jobs in this browse area</Text>
        <View style={styles.markerRow}>
          {visibleJobs.map((job, index) => (
            <Pressable
              key={job.id}
              style={[styles.marker, { transform: [{ translateY: index % 2 === 0 ? -4 : 6 }] }]}
              onPress={() => onJobPress?.(job.id)}
            >
              <Text style={styles.markerTitle} numberOfLines={1}>{job.title}</Text>
              <Text style={styles.markerArea} numberOfLines={1}>{areaFromJob(job)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <TrustBanner title="Area-first privacy">
        Map preview is limited on web. Job area still shown in list.
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
  markerRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  marker: {
    maxWidth: 150,
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
