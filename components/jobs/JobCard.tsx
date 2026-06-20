import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StatusChip from "./StatusChip";
import { useTheme } from "../ui/ThemeProvider";
import type { Theme } from "../ui/theme";

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
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
        <Ionicons name="navigate" size={14} color={theme.colors.accent} />
        <Text style={styles.travelText}>{travelTime}</Text>
      </View>

      <Pressable style={styles.button} onPress={onPress}>
        <Text style={styles.buttonText}>View job</Text>
      </Pressable>
    </Pressable>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    paddingBottom: 0,
    gap: 12,
  },
  title: {
    flex: 1,
    minWidth: 180,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  budget: {
    color: theme.colors.accent,
    fontSize: 18,
    fontWeight: "800",
    flexShrink: 0,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
  category: {
    color: theme.colors.subtle,
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
    color: theme.colors.muted,
    fontSize: 14,
    flexShrink: 1,
  },
  travelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 6,
  },
  travelText: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  button: {
    marginTop: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: theme.colors.accent,
    borderRadius: 14,
    paddingVertical: 12,
  },
  buttonText: {
    color: theme.colors.accentText,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },
  });
}
