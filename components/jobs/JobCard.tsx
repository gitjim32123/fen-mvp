import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StatusChip from "./StatusChip";
import { useTheme } from "../ui/ThemeProvider";
import type { Theme } from "../ui/theme";
import {
  formatMatchScore,
  formatMatchTravelTime,
  formatMatchHourlyRate,
  modeLabel,
  recommendationTier,
  type JobMatchResult,
} from "../../lib/jobMatching";

type Props = {
  title: string;
  budget: string;
  urgency: "Need now" | "Today" | "Flexible";
  status?: string;
  category?: string;
  area: string;
  distance: string;
  travelTime: string;
  match?: JobMatchResult;
  onPress?: () => void;
};

export default function JobCard({ title, budget, urgency, status = "Open", category, area, distance, travelTime, match, onPress }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {match ? (
        <View style={styles.matchPanel}>
          <View style={styles.matchTopRow}>
            <View style={[styles.matchBadge, recommendationBadgeStyle(styles, match)]}>
              <Text style={[styles.matchRecommendation, recommendationStyle(styles, match)]}>
                {recommendationTier(match)}
              </Text>
            </View>
            <Text style={styles.matchRank}>#{match.rank}</Text>
          </View>
          <View style={styles.matchMetaRow}>
            <Text style={styles.matchMeta}>Best mode: {modeLabel(match.best_mode)}</Text>
            <Text style={styles.matchMeta}>{formatMatchHourlyRate(match)}</Text>
            <Text style={styles.matchMeta}>{formatMatchTravelTime(match)}</Text>
          </View>
          {match.timing_label ? <Text style={styles.timingLabel}>{match.timing_label}</Text> : null}
          {match.status === "partial" ? <Text style={styles.matchSummary}>Partial cost data</Text> : null}
          {match.status === "unavailable" ? <Text style={styles.matchSummary}>Unavailable route or earnings data</Text> : null}
          {SHOW_MATCH_DEBUG ? (
            <>
              <Text style={styles.matchReason}>{match.reason}</Text>
              <Text style={styles.matchSummary}>Score: {formatMatchScore(match.score)}</Text>
            </>
          ) : null}
        </View>
      ) : null}

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

const SHOW_MATCH_DEBUG = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

function recommendationStyle(styles: ReturnType<typeof createStyles>, match: JobMatchResult) {
  switch (recommendationTier(match)) {
    case "Highly Recommended":
    case "Recommended":
      return styles.match_accept;
    case "Worth Considering":
      return styles.match_borderline;
    case "Low Value":
      return styles.match_reject;
    case "Unavailable":
      return styles.match_unavailable;
  }
}

function recommendationBadgeStyle(styles: ReturnType<typeof createStyles>, match: JobMatchResult) {
  switch (recommendationTier(match)) {
    case "Highly Recommended":
    case "Recommended":
      return styles.matchBadge_accept;
    case "Worth Considering":
      return styles.matchBadge_borderline;
    case "Low Value":
      return styles.matchBadge_reject;
    case "Unavailable":
      return styles.matchBadge_unavailable;
  }
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    gap: 12,
  },
  matchPanel: {
    backgroundColor: theme.colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    padding: 14,
    gap: 8,
  },
  matchTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  matchRank: {
    color: theme.colors.subtle,
    fontSize: 13,
    fontWeight: "900",
  },
  matchBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  matchBadge_accept: {
    backgroundColor: theme.colors.successBg,
    borderColor: theme.colors.success,
  },
  matchBadge_borderline: {
    backgroundColor: theme.colors.warningBg,
    borderColor: theme.colors.warning,
  },
  matchBadge_reject: {
    backgroundColor: theme.colors.dangerBg,
    borderColor: theme.colors.danger,
  },
  matchBadge_unavailable: {
    backgroundColor: theme.colors.chipBg,
    borderColor: theme.colors.border,
  },
  matchRecommendation: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  match_accept: {
    color: theme.colors.successText,
  },
  match_borderline: {
    color: theme.colors.warningText,
  },
  match_reject: {
    color: theme.colors.dangerText,
  },
  match_unavailable: {
    color: theme.colors.subtle,
  },
  matchMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  matchMeta: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  matchReason: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  matchSummary: {
    color: theme.colors.subtle,
    fontSize: 12,
    lineHeight: 17,
  },
  timingLabel: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.chipBg,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    color: theme.colors.subtle,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  topRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    gap: 12,
  },
  title: {
    flex: 1,
    minWidth: 180,
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  budget: {
    color: theme.colors.accent,
    fontSize: 17,
    lineHeight: 22,
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
    marginTop: 2,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
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
