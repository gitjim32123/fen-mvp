import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator, Pressable } from "react-native";
import { router } from "expo-router";
import { getJobsNearby } from "../../lib/jobs";
import type { Job } from "../../lib/types";
import { getProfile } from "../../lib/auth";
import { estimateMiles, estimateTravelMinutes, geocodePostcode, getCurrentGpsPoint, getTravelEstimateUnavailableText } from "../../lib/geocoding";
import JobCard from "../../components/jobs/JobCard";
import StatusChip from "../../components/jobs/StatusChip";
import BrowseMap from "../../components/jobs/BrowseMap";
import { EmptyState, InfoMetric, PageHeader, TrustBanner } from "../../components/ui/Premium";
import { CATEGORY_OPTIONS, normalizeCategory } from "../../lib/categories";

const DISTANCE_OPTIONS = [2, 5, 10];

function urgencyFromJob(job: Job): "Need now" | "Today" | "Flexible" {
  return job.urgency;
}

function budgetFromJob(job: Job): string {
  return `£${job.budget_gbp}`;
}

function statusFromJob(job: Job): string {
  switch (job.status) {
    case "held": return "Held";
    case "confirm_pending": return "Confirm pending";
    case "in_progress": return "In progress";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    default: return "Open";
  }
}

function areaFromJob(job: Job): string {
  return (job as any).postcode_district || job.postcode || "Unknown";
}

function normalizeFilterValue(value?: string | null): string {
  return normalizeCategory(value || "").trim().toLowerCase();
}

function distanceFromJob(job: Job): string {
  return getTravelEstimateUnavailableText();
}

function travelTimeFromJob(job: Job): string {
  return getTravelEstimateUnavailableText();
}

export default function BrowseScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<"Need now" | "Today" | "Flexible" | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [distanceFilterMiles, setDistanceFilterMiles] = useState<number | null>(null);
  const [travelByJobId, setTravelByJobId] = useState<Record<string, { distance: string; time: string; miles: number }>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setErrorText(null);
        const data = await getJobsNearby();
        if (!active) return;
        setJobs(data);

        const profile = await getProfile().catch(() => null);
        const transportMode = profile?.transport_mode || "unspecified";

        const profilePostcode = profile?.postcode?.trim();
        const fromPoint = await getCurrentGpsPoint()
          || (profilePostcode ? await geocodePostcode(profilePostcode) : null);
        if (!fromPoint || !active) return;

        const estimates: Record<string, { distance: string; time: string; miles: number }> = {};
        for (const job of data) {
          const jobPostcode = (job.postcode || "").split("→")[0]?.trim();
          if (!jobPostcode || jobPostcode === "N/A" || jobPostcode === "AREA NOT PROVIDED") continue;
          const toPoint = await geocodePostcode(jobPostcode);
          if (!toPoint || !active) continue;
          const miles = estimateMiles(fromPoint, toPoint);
          const minutes = estimateTravelMinutes(miles, transportMode);
          estimates[job.id] = {
            distance: `${miles.toFixed(1)} miles approx travel distance`,
            time: `About ${minutes} min by ${transportMode || "transport"}`,
            miles,
          };
        }
        if (active) setTravelByJobId(estimates);
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
    const q = search.trim().toLowerCase();
    const activeUrgency = normalizeFilterValue(urgencyFilter);
    const activeCategory = normalizeFilterValue(categoryFilter);
    return jobs.filter(
      (j) => {
        const jobCategory = normalizeFilterValue(j.category || "General");
        const jobUrgency = normalizeFilterValue(j.urgency);
        return (
          j.status === "open" &&
          (!activeUrgency || jobUrgency === activeUrgency) &&
          (!activeCategory || jobCategory === activeCategory) &&
          (!distanceFilterMiles || travelByJobId[j.id]?.miles == null || travelByJobId[j.id].miles <= distanceFilterMiles) &&
          (!q ||
            j.title.toLowerCase().includes(q) ||
            (j.description || "").toLowerCase().includes(q) ||
            areaFromJob(j).toLowerCase().includes(q) ||
            jobCategory.includes(q))
        );
      }
    );
  }, [jobs, search, urgencyFilter, categoryFilter, distanceFilterMiles, travelByJobId]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PageHeader title="Browse nearby jobs" subtitle="Quick local jobs with area-first privacy and simple details." />

      <View style={styles.metricsRow}>
        <InfoMetric label="Open jobs" value={String(jobs.length)} />
        <InfoMetric label="Visible" value={String(filtered.length)} />
      </View>

      <TrustBanner title="Privacy first">
        Exact addresses stay hidden. Browse by area and arrange details only after someone is chosen.
      </TrustBanner>

      <BrowseMap jobs={filtered} onJobPress={(jobId: string) => router.push(`/app/job/${jobId}`)} />

      <TextInput
        placeholder="Search jobs"
        placeholderTextColor="#8D79AF"
        style={styles.search}
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Urgency</Text>
        <View style={styles.chipsRow}>
          <Pressable
            style={[styles.selectableChip, !urgencyFilter && styles.selectableChipActive]}
            onPress={() => setUrgencyFilter(null)}
          >
            <Text style={[styles.selectableChipText, !urgencyFilter && styles.selectableChipTextActive]}>All</Text>
          </Pressable>
        {(["Need now", "Today", "Flexible"] as const).map((urgency) => (
          <Pressable
            key={urgency}
            style={[styles.selectableChip, urgencyFilter === urgency && styles.selectableChipActive]}
            onPress={() => setUrgencyFilter((current) => current === urgency ? null : urgency)}
          >
            <Text style={[styles.selectableChipText, urgencyFilter === urgency && styles.selectableChipTextActive]}>
              {urgency}
            </Text>
          </Pressable>
        ))}
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Distance</Text>
        <View style={styles.filterRow}>
        <Pressable style={[styles.filterChip, !distanceFilterMiles && styles.filterChipActive]} onPress={() => setDistanceFilterMiles(null)}>
          <Text style={[styles.filterText, !distanceFilterMiles && styles.filterTextActive]}>Any</Text>
        </Pressable>
        {DISTANCE_OPTIONS.map((miles) => (
          <Pressable
            key={miles}
            style={[styles.filterChip, distanceFilterMiles === miles && styles.filterChipActive]}
            onPress={() => setDistanceFilterMiles((current) => current === miles ? null : miles)}
          >
            <Text style={[styles.filterText, distanceFilterMiles === miles && styles.filterTextActive]}>
              {miles} miles
            </Text>
          </Pressable>
        ))}
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Category</Text>
        <View style={styles.filterRow}>
        <Pressable style={[styles.filterChip, !categoryFilter && styles.filterChipActive]} onPress={() => setCategoryFilter(null)}>
          <Text style={[styles.filterText, !categoryFilter && styles.filterTextActive]}>All categories</Text>
        </Pressable>
        {CATEGORY_OPTIONS.map((category) => (
          <Pressable key={category} style={[styles.filterChip, categoryFilter === category && styles.filterChipActive]} onPress={() => setCategoryFilter(category)}>
            <Text style={[styles.filterText, categoryFilter === category && styles.filterTextActive]}>{category}</Text>
          </Pressable>
        ))}
        </View>
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
        <EmptyState title="No jobs nearby right now" text="Try a broader search or check back soon." />
      ) : (
        <View style={styles.list}>
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              title={job.title}
              budget={budgetFromJob(job)}
              urgency={urgencyFromJob(job)}
              status={statusFromJob(job)}
              category={normalizeCategory(job.category)}
              area={areaFromJob(job)}
              distance={travelByJobId[job.id]?.distance || "Distance unavailable"}
              travelTime={travelByJobId[job.id]?.time || travelTimeFromJob(job)}
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
  filterGroup: {
    gap: 8,
  },
  filterLabel: {
    color: "#A590C9",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metricsRow: {
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
  filterChipActive: {
    borderColor: "#B56CFF",
    backgroundColor: "#2A1E3D",
  },
  selectableChip: {
    backgroundColor: "#171024",
    borderWidth: 1,
    borderColor: "#231A33",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectableChipActive: {
    borderColor: "#B56CFF",
    backgroundColor: "#2A1E3D",
  },
  selectableChipText: {
    color: "#CBB8F1",
    fontSize: 13,
    fontWeight: "700",
  },
  selectableChipTextActive: {
    color: "#F0E2FF",
    fontWeight: "800",
  },
  filterText: {
    color: "#CBB8F1",
    fontSize: 13,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#F0E2FF",
    fontWeight: "800",
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


