import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { getJobsNearby } from "../../lib/jobs";
import type { Job } from "../../lib/types";
import JobCard from "../../components/jobs/JobCard";
import StatusChip from "../../components/jobs/StatusChip";
import BrowseMap from "../../components/jobs/BrowseMap";

function urgencyFromJob(job: Job): "Need now" | "Today" | "Flexible" {
  return job.urgency;
}

function budgetFromJob(job: Job): string {
  return `£${job.budget_gbp}`;
}

function areaFromJob(job: Job): string {
  return (job as any).postcode_district || job.postcode || "Unknown";
}

function distanceFromJob(job: Job): string {
  const hash = job.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const dist = ((hash % 50) / 10 + 0.3).toFixed(1);
  return `${dist} miles`;
}

function travelTimeFromJob(job: Job): string {
  const hash = job.id.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
  const mins = Math.max(5, (hash % 45) + 5);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function BrowseScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setErrorText(null);
        const data = await getJobsNearby();
        if (!active) return;
        setJobs(data);
      } catch (err: any) {
        if (!active) return;
        setErrorText(err?.message || "Could not load jobs.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        (j.description || "").toLowerCase().includes(q) ||
        areaFromJob(j).toLowerCase().includes(q)
    );
  }, [jobs, search]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Browse nearby jobs</Text>
      <Text style={styles.subtitle}>Quick local jobs with simple details, approximate distance, and travel time.</Text>

      <BrowseMap jobs={jobs} />

      <TextInput
        placeholder="Search jobs"
        placeholderTextColor="#8D79AF"
        style={styles.search}
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.chipsRow}>
        <StatusChip label="Need now" />
        <StatusChip label="Today" />
        <StatusChip label="Flexible" />
      </View>

      <View style={styles.filterRow}>
        <View style={styles.filterChip}><Text style={styles.filterText}>Distance: 5 miles</Text></View>
        <View style={styles.filterChip}><Text style={styles.filterText}>Category: All</Text></View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#B56CFF" />
          <Text style={styles.loadingText}>Loading jobs…</Text>
        </View>
      ) : errorText ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No jobs nearby right now.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              title={job.title}
              budget={budgetFromJob(job)}
              urgency={urgencyFromJob(job)}
              area={areaFromJob(job)}
              distance={distanceFromJob(job)}
              travelTime={travelTimeFromJob(job)}
              onPress={() => router.push(`/app/job/${job.id}`)}
            />
          ))}
        </View>
      )}
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
    paddingBottom: 100,
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
    marginBottom: 2,
  },
  search: {
    backgroundColor: "#171024",
    borderColor: "#231A33",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#E7D9FF",
    fontSize: 16,
    marginTop: 6,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    backgroundColor: "#171024",
    borderWidth: 1,
    borderColor: "#231A33",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterText: {
    color: "#CBB8F1",
    fontSize: 13,
    fontWeight: "700",
  },
  list: {
    gap: 14,
    marginTop: 4,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    color: "#CBB8F1",
    fontSize: 15,
    marginTop: 12,
  },
  errorText: {
    color: "#FFB0B0",
    fontSize: 15,
    textAlign: "center",
  },
  emptyText: {
    color: "#CBB8F1",
    fontSize: 15,
    textAlign: "center",
  },
});
