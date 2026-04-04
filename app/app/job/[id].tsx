import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getJob } from "../../../lib/jobs";
import type { Job } from "../../../lib/types";

function toStatusLabel(status?: string) {
  switch (status) {
    case "open": return "Open";
    case "held": return "Held";
    case "confirm_pending": return "Confirm pending";
    case "in_progress": return "In progress";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    default: return "Open";
  }
}

function formatBudget(value?: number | string) {
  if (typeof value === "number") return `£${value}`;
  if (typeof value === "string" && value.trim()) return `£${value}`;
  return "Budget not set";
}

export default function JobDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const jobId = useMemo(() => {
    if (Array.isArray(params.id)) return params.id[0];
    return params.id;
  }, [params.id]);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!jobId) { setErrorText("Job not found."); setLoading(false); return; }
      try {
        setLoading(true);
        setErrorText(null);
        const data = await getJob(jobId);
        if (!active) return;
        setJob(data);
      } catch (error: any) {
        if (!active) return;
        setErrorText(error?.message || "Could not load this job.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [jobId]);

  const areaText = (job as any)?.postcode_district || job?.postcode || "Area not available";

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B56CFF" />
        <Text style={styles.loadingText}>Loading job…</Text>
      </View>
    );
  }

  if (errorText || !job) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not open this job</Text>
        <Text style={styles.errorText}>{errorText || "This job is not available."}</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Back</Text>
      </Pressable>

      <View style={styles.heroCard}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{job.title}</Text>
          <Text style={styles.budget}>{formatBudget((job as any)?.budget_gbp)}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{toStatusLabel((job as any)?.status)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Job details</Text>
        <Text style={styles.bodyText}>{job.description}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>At a glance</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Urgency</Text>
          <Text style={styles.detailValue}>{(job as any)?.urgency || "Not set"}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Area</Text>
          <Text style={styles.detailValue}>{areaText}</Text>
        </View>
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Privacy</Text>
        <Text style={styles.noticeText}>
          Exact address details are not shown here. Only safe area info is visible until someone is chosen.
        </Text>
      </View>

      <Pressable
        style={[(job as any)?.status !== "open" ? styles.btnDisabled : styles.btn]}
        disabled={(job as any)?.status !== "open"}
      >
        <Text style={styles.btnText}>
          {(job as any)?.status === "open" ? "Apply for this job" : "Applications closed"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#1a0033",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: "#1a0033",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: "#ccc",
    marginTop: 12,
    fontFamily: "Comic Sans MS",
    fontWeight: "bold",
  },
  errorTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Comic Sans MS",
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    color: "#ccc",
    fontSize: 14,
    fontFamily: "Comic Sans MS",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  backBtn: {
    marginBottom: 16,
  },
  backBtnText: {
    color: "#B56CFF",
    fontSize: 15,
    fontFamily: "Comic Sans MS",
    fontWeight: "bold",
  },
  heroCard: {
    backgroundColor: "#2d0057",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#7c3aed",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Comic Sans MS",
    flex: 1,
    marginRight: 8,
  },
  budget: {
    color: "#B56CFF",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Comic Sans MS",
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#4c1d95",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusText: {
    color: "#e9d5ff",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Comic Sans MS",
  },
  card: {
    backgroundColor: "#2d0057",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#7c3aed",
  },
  sectionTitle: {
    color: "#B56CFF",
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "Comic Sans MS",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  bodyText: {
    color: "#e2e8f0",
    fontSize: 15,
    fontFamily: "Comic Sans MS",
    fontWeight: "bold",
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#4c1d95",
  },
  detailLabel: {
    color: "#a78bfa",
    fontSize: 13,
    fontFamily: "Comic Sans MS",
    fontWeight: "bold",
  },
  detailValue: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Comic Sans MS",
    fontWeight: "bold",
  },
  noticeCard: {
    backgroundColor: "#1e0040",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#4c1d95",
  },
  noticeTitle: {
    color: "#a78bfa",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Comic Sans MS",
    marginBottom: 4,
  },
  noticeText: {
    color: "#94a3b8",
    fontSize: 12,
    fontFamily: "Comic Sans MS",
    fontWeight: "bold",
    lineHeight: 18,
  },
  btn: {
    backgroundColor: "#7c3aed",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: {
    backgroundColor: "#4c1d95",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    opacity: 0.5,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Comic Sans MS",
  },
});
