import { Pressable, StyleSheet, Text, View } from "react-native";
import StatusChip from "./StatusChip";

type Props = {
  title: string;
  budget: string;
  urgency: "Need now" | "Today" | "Flexible";
  area: string;
  distance: string;
  onPress?: () => void;
};

export default function JobCard({ title, budget, urgency, area, distance, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.budget}>{budget}</Text>
      </View>

      <StatusChip label={urgency} />

      <Text style={styles.meta}>{area} · {distance}</Text>

      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>Open job</Text>
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
    padding: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  meta: {
    color: "#CBB8F1",
    fontSize: 14,
  },
  button: {
    marginTop: 2,
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
