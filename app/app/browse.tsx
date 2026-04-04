import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import JobCard from "../../components/jobs/JobCard";
import StatusChip from "../../components/jobs/StatusChip";

export default function BrowseScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Browse nearby jobs</Text>
      <Text style={styles.subtitle}>Quick local jobs with simple details and approximate distance only.</Text>

      <TextInput
        placeholder="Search jobs"
        placeholderTextColor="#8D79AF"
        style={styles.search}
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

      <View style={styles.list}>
        <JobCard title="Help move a sofa" budget="£25" urgency="Need now" area="DN11" distance="1.2 miles" />
        <JobCard title="Small garden tidy-up" budget="£40" urgency="Today" area="S81" distance="3.8 miles" />
        <JobCard title="Collect parcel and drop off" budget="£15" urgency="Flexible" area="DN10" distance="4.6 miles" />
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
});
