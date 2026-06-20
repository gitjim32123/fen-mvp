import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../ui/ThemeProvider";
import type { Theme } from "../ui/theme";

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
  const theme = useTheme();
  const tone = getTone(label, theme);

  return (
    <View style={[styles.chip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.text, { color: tone.text }]}>{label}</Text>
    </View>
  );
}

function getTone(label: Props["label"], theme: Theme) {
  switch (label) {
    case "Open":
      return { bg: theme.colors.successBg, border: theme.colors.success, text: theme.colors.successText };
    case "Held":
      return { bg: theme.colors.warningBg, border: theme.colors.warning, text: theme.colors.warningText };
    case "Confirm pending":
      return { bg: theme.colors.infoBg, border: theme.colors.info, text: theme.colors.infoText };
    case "In progress":
      return { bg: theme.colors.infoBg, border: theme.colors.info, text: theme.colors.infoText };
    case "Completed":
      return { bg: theme.colors.successBg, border: theme.colors.success, text: theme.colors.successText };
    case "Cancelled":
      return { bg: theme.colors.dangerBg, border: theme.colors.danger, text: theme.colors.dangerText };
    case "Applied":
      return { bg: theme.colors.infoBg, border: theme.colors.info, text: theme.colors.infoText };
    case "Selected":
      return { bg: theme.colors.warningBg, border: theme.colors.warning, text: theme.colors.warningText };
    case "Rejected":
    case "Withdrawn":
      return { bg: theme.colors.surfaceAlt, border: theme.colors.borderStrong, text: theme.colors.muted };
    case "Need now":
      return { bg: theme.colors.accentSoft, border: theme.colors.accent, text: theme.colors.text };
    case "Today":
      return { bg: theme.colors.surfaceAlt, border: theme.colors.borderStrong, text: theme.colors.text };
    default:
      return { bg: theme.colors.surfaceAlt, border: theme.colors.borderStrong, text: theme.colors.muted };
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
