import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { theme } from "./theme";

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Pill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <View style={[styles.pill, styles[`${tone}Pill`]]}>
      <Text style={[styles.pillText, styles[`${tone}PillText`]]}>{label}</Text>
    </View>
  );
}

export function TrustBanner({ title = "FEN safety", children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.trust}>
      <Text style={styles.trustTitle}>{title}</Text>
      <Text style={styles.trustText}>{children}</Text>
    </View>
  );
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
    </View>
  );
}

type FeedbackTone = "success" | "error" | "warning" | "info";

function getFeedbackStyles(type: FeedbackTone) {
  switch (type) {
    case "success":
      return {
        box: styles.successFeedback,
        title: styles.successFeedbackTitle,
        text: styles.successFeedbackText,
      };
    case "error":
      return {
        box: styles.errorFeedback,
        title: styles.errorFeedbackTitle,
        text: styles.errorFeedbackText,
      };
    case "warning":
      return {
        box: styles.warningFeedback,
        title: styles.warningFeedbackTitle,
        text: styles.warningFeedbackText,
      };
    default:
      return {
        box: styles.infoFeedback,
        title: styles.infoFeedbackTitle,
        text: styles.infoFeedbackText,
      };
  }
}

export function FeedbackNotice({
  type = "info",
  title,
  text,
}: {
  type?: FeedbackTone;
  title?: string;
  text: string;
}) {
  const feedback = getFeedbackStyles(type);
  return (
    <View style={[styles.feedback, feedback.box]}>
      {title ? <Text style={[styles.feedbackTitle, feedback.title]}>{title}</Text> : null}
      <Text style={[styles.feedbackText, feedback.text]}>{text}</Text>
    </View>
  );
}

export function LoadingState({
  text,
  fullScreen = false,
  compact = false,
}: {
  text: string;
  fullScreen?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.loading, fullScreen && styles.loadingFullScreen, compact && styles.loadingCompact]}>
      <ActivityIndicator size={compact ? "small" : "large"} color={theme.colors.accent} />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  );
}

export function InfoMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function SignInRequired({
  title = "Sign in required",
  text = "Sign in to use this part of FEN.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <View style={styles.signInCard}>
      <Text style={styles.signInTitle}>{title}</Text>
      <Text style={styles.signInText}>{text}</Text>
      <Pressable style={styles.signInButton} onPress={() => router.replace("/auth/sign-in")}>
        <Text style={styles.signInButtonText}>Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  header: {
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 16,
    lineHeight: 23,
  },
  pill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.borderStrong,
  },
  pillText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  defaultPill: {},
  defaultPillText: {},
  successPill: { backgroundColor: theme.colors.successBg, borderColor: theme.colors.success },
  successPillText: { color: "#D7F5DE" },
  warningPill: { backgroundColor: theme.colors.warningBg, borderColor: theme.colors.warning },
  warningPillText: { color: "#FFE0B8" },
  dangerPill: { backgroundColor: theme.colors.dangerBg, borderColor: theme.colors.danger },
  dangerPillText: { color: "#FFD8DE" },
  infoPill: { backgroundColor: theme.colors.infoBg, borderColor: theme.colors.info },
  infoPillText: { color: "#D6E3FF" },
  trust: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  trustTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  trustText: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  feedback: {
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 4,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 20,
  },
  successFeedback: {
    backgroundColor: theme.colors.successBg,
    borderColor: theme.colors.success,
  },
  successFeedbackTitle: {
    color: "#D7F5DE",
  },
  successFeedbackText: {
    color: "#D7F5DE",
  },
  errorFeedback: {
    backgroundColor: theme.colors.dangerBg,
    borderColor: theme.colors.danger,
  },
  errorFeedbackTitle: {
    color: "#FFD8DE",
  },
  errorFeedbackText: {
    color: "#FFD8DE",
  },
  warningFeedback: {
    backgroundColor: theme.colors.warningBg,
    borderColor: theme.colors.warning,
  },
  warningFeedbackTitle: {
    color: "#FFE0B8",
  },
  warningFeedbackText: {
    color: "#FFE0B8",
  },
  infoFeedback: {
    backgroundColor: theme.colors.infoBg,
    borderColor: theme.colors.info,
  },
  infoFeedbackTitle: {
    color: "#D6E3FF",
  },
  infoFeedbackText: {
    color: "#D6E3FF",
  },
  loading: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  loadingFullScreen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    borderWidth: 0,
    borderRadius: 0,
  },
  loadingCompact: {
    padding: theme.spacing.lg,
  },
  loadingText: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  metric: {
    flex: 1,
    minWidth: 132,
    backgroundColor: theme.colors.bg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  metricValue: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  metricLabel: {
    color: theme.colors.subtle,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  signInCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  signInTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  signInText: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  signInButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  signInButtonText: {
    color: theme.colors.accentText,
    fontSize: 16,
    fontWeight: "800",
  },
});
