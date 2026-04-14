import { StyleSheet, Text, View } from "react-native";

type Props = {
  label: "Open" | "Held" | "Confirm pending" | "In progress" | "Completed" | "Cancelled" | "Need now" | "Today" | "Flexible";
};

export default function StatusChip({ label }: Props) {
  const tone = getTone(label);

  return (
    <View style={[styles.chip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.text, { color: tone.text }]}>{label}</Text>
    </View>
  );
}

function getTone(label: Props["label"]) {
  switch (label) {
    case "Open":
      return { bg: "#20172E", border: "#5B3A87", text: "#E7D9FF" };
    case "Held":
      return { bg: "#2B1E15", border: "#8B5A2B", text: "#FFDDB7" };
    case "Confirm pending":
      return { bg: "#182033", border: "#3D5A93", text: "#D6E3FF" };
    case "In progress":
      return { bg: "#15251E", border: "#2E7A59", text: "#D0F5E2" };
    case "Completed":
      return { bg: "#16231A", border: "#3E8F58", text: "#D7F5DE" };
    case "Cancelled":
      return { bg: "#2B161B", border: "#8E4656", text: "#FFD8DE" };
    case "Need now":
      return { bg: "#2A1E3D", border: "#B56CFF", text: "#F0E2FF" };
    case "Today":
      return { bg: "#231D35", border: "#8C65D3", text: "#E8D9FF" };
    default:
      return { bg: "#1B1826", border: "#4E4467", text: "#D8CCEF" };
  }
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
});
