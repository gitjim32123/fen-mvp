import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import StatusChip from "../../components/jobs/StatusChip";

function JobRow({ title, budget, status, action }: { title: string; budget: string; status: "Open" | "Held" | "Confirm pending" | "In progress" | "Completed" | "Cancelled"; action: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.rowTop}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBudget}>{budget}</Text>
      </View>
      <StatusChip label={status} />
      <Pressable style={styles.actionButton}>
        <Text style={styles.actionButtonText}>{action}</Text>
      </Pressable>
    </View>
  );
}

export default function MyJobsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My Jobs</Text>
      <Text style={styles.subtitle}>Track posted jobs and jobs you have applied for with clear status labels.</Text>

      <Text style={styles.sectionTitle}>Posted jobs</Text>
      <View style={styles.group}>
        <JobRow title="Help move a sofa" budget="£25" status="Open" action="Open applicants" />
        <JobRow title="Flat pack assembly" budget="£35" status="Held" action="View details" />
      </View>

      <Text style={styles.sectionTitle}>Applied jobs</Text>
      <View style={styles.group}>
        <JobRow title="Small garden tidy-up" budget="£40" status="Confirm pending" action="View status" />
        <JobRow title="Parcel drop-off" budget="£15" status="Completed" action="View outcome" />
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
});
