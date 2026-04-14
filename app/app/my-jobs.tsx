import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { getMyPostedJobs } from "../../lib/jobs";
import { getMyApplications } from "../../lib/applications";
import type { Job, Application } from "../../lib/types";
import StatusChip from "../../components/jobs/StatusChip";

function toStatusLabel(status: Job["status"] | Application["status"]) {
  switch (status) {
    case "open": return "Open";
    case "held": return "Held";
    case "confirm_pending": return "Confirm pending";
    case "in_progress": return "In progress";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    case "applied": return "Applied";
    case "rejected": return "Rejected";
    case "selected": return "Selected";
    case "withdrawn": return "Withdrawn";
    default: return "Open";
  }
}

function JobRow({ title, budget, status, jobId, isPosted }: { title: string; budget: string; status: string; jobId: string; isPosted: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.rowTop}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBudget}>{budget}</Text>
      </View>
      <StatusChip label={status as any} />
      <Pressable style={styles.actionButton} onPress={() => router.push(`/app/job/${jobId}`)}>
        <Text style={styles.actionButtonText}>{isPosted ? "Manage job" : "View details"}</Text>
      </Pressable>
    </View>
  );
}

export default function MyJobsScreen() {
  const [postedJobs, setPostedJobs] = useState<Job[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setErrorText(null);
        const [posted, applied] = await Promise.all([
          getMyPostedJobs().catch(() => [] as Job[]),
          getMyApplications().catch(() => [] as Application[]),
        ]);
        if (!active) return;
        setPostedJobs(posted);
        setAppliedJobs(applied);
      } catch (err: any) {
        if (!active) return;
        setErrorText(err?.message || "Could not load your jobs.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B56CFF" />
        <Text style={styles.loadingText}>Loading your jobs…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My Jobs</Text>
      <Text style={styles.subtitle}>Track posted jobs and jobs you have applied for with clear status labels.</Text>

      {errorText ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Posted jobs</Text>
      <View style={styles.group}>
        {postedJobs.length === 0 ? (
          <Text style={styles.emptyText}>No posted jobs yet.</Text>
        ) : (
          postedJobs.map((job) => (
            <JobRow
              key={job.id}
              title={job.title}
              budget={`£${job.budget_gbp}`}
              status={toStatusLabel(job.status)}
              jobId={job.id}
              isPosted
            />
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Applied jobs</Text>
      <View style={styles.group}>
        {appliedJobs.length === 0 ? (
          <Text style={styles.emptyText}>No applications yet.</Text>
        ) : (
          appliedJobs.map((app) => {
            const job = (app as any).job;
            return (
              <JobRow
                key={app.id}
                title={job?.title || "Unknown job"}
                budget={job?.budget_gbp ? `£${job.budget_gbp}` : "—"}
                status={toStatusLabel(app.status)}
                jobId={app.job_id}
                isPosted={false}
              />
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0E0A14",
  },
  content: {
    padding: 20,
    paddingBottom: 110,
    gap: 14,
  },
  title: {
    color: "#E7D9FF",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 8,
  },
  subtitle: {
    color: "#CBB8F1",
    fontSize: 16,
    lineHeight: 23,
  },
  sectionTitle: {
    color: "#E7D9FF",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 8,
  },
  group: {
    gap: 12,
  },
  card: {
    backgroundColor: "#171024",
    borderWidth: 1,
    borderColor: "#231A33",
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    color: "#E7D9FF",
    fontSize: 17,
    fontWeight: "800",
  },
  cardBudget: {
    color: "#B56CFF",
    fontSize: 17,
    fontWeight: "800",
  },
  actionButton: {
    backgroundColor: "#2A1E3D",
    borderColor: "#6E46A3",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },
  actionButtonText: {
    color: "#E7D9FF",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
  },
  centered: {
    flex: 1,
    backgroundColor: "#0E0A14",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#CBB8F1",
    fontSize: 15,
    marginTop: 12,
  },
  errorBox: {
    backgroundColor: "#2B161B",
    borderColor: "#8E4656",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  errorText: {
    color: "#FFD8DE",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    color: "#CBB8F1",
    fontSize: 14,
    fontStyle: "italic",
  },
});
