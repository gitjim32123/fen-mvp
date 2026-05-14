import { StyleSheet, Text, View } from "react-native";
import { theme } from "../ui/theme";

type Props = {
  label:
    | "Open"
    | "Held"
    | "Confirm pending"
    | "In progress"
    | "Completed"
    | "Cancelled"
    | "Need now"
    | "Today"
    | "Flexible"
    | "Applied"
    | "Rejected"
    | "Selected"
    | "Withdrawn";
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
      return { bg: "#10231A", border: theme.colors.success, text: "#D7F5DE" };
    case "Held":
      return { bg: "#241C10", border: theme.colors.warning, text: "#FFE0B8" };
    case "Confirm pending":
      return { bg: theme.colors.infoBg, border: theme.colors.info, text: "#D6E3FF" };
    case "In progress":
      return { bg: "#101F22", border: "#48C7D8", text: "#D9FAFF" };
    case "Completed":
      return { bg: theme.colors.successBg, border: theme.colors.success, text: "#D7F5DE" };
    case "Cancelled":
      return { bg: theme.colors.dangerBg, border: theme.colors.danger, text: "#FFD8DE" };
    case "Applied":
      return { bg: theme.colors.infoBg, border: theme.colors.info, text: "#D6E3FF" };
    case "Selected":
      return { bg: "#241C10", border: theme.colors.warning, text: "#FFE0B8" };
    case "Rejected":
    case "Withdrawn":
      return { bg: "#1B1826", border: "#4E4467", text: "#D8CCEF" };
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
