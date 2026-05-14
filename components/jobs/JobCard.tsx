import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StatusChip from "./StatusChip";

type Props = {
  title: string;
  budget: string;
  urgency: "Need now" | "Today" | "Flexible";
  status?: string;
  category?: string;
  area: string;
  distance: string;
  travelTime: string;
  onPress?: () => void;
};

export default function JobCard({ title, budget, urgency, status = "Open", category, area, distance, travelTime, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.budget}>{budget}</Text>
      </View>

      <View style={styles.chipRow}>
        <StatusChip label={status as any} />
        <StatusChip label={urgency} />
      </View>

      <Text style={styles.category}>{category || "General"}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{area} - {distance}</Text>
      </View>

      <View style={styles.travelRow}>
        <Ionicons name="navigate" size={14} color="#B56CFF" />
        <Text style={styles.travelText}>{travelTime}</Text>
      </View>

      <Pressable style={styles.button} onPress={onPress}>
        <Text style={styles.buttonText}>View job</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#171024",
    borderColor: "#231A33",
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    paddingBottom: 0,
    gap: 12,
  },
  title: {
    flex: 1,
    color: "#E7D9FF",
    fontSize: 18,
    fontWeight: "800",
  },
  budget: {
    color: "#B56CFF",
    fontSize: 18,
    fontWeight: "800",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
  category: {
    color: "#A590C9",
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 6,
  },
  meta: {
    color: "#CBB8F1",
    fontSize: 14,
  },
  travelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 6,
  },
  travelText: {
    color: "#B56CFF",
    fontSize: 13,
    fontWeight: "700",
  },
  button: {
    marginTop: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#B56CFF",
    borderRadius: 14,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#140E1D",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
  },
});
