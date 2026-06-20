import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Card, PageHeader } from "../ui/Premium";
import { useTheme } from "../ui/ThemeProvider";
import type { Theme } from "../ui/theme";

type Page = {
  title: string;
  sections: string[];
};

export function LegalScreen({ page }: { page: Page }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <PageHeader title={page.title} subtitle="Plain-language MVP guidance, not solicitor-level legal advice." />
      <Card>
        {page.sections.map((section) => (
          <View key={section} style={styles.row}>
            <View style={styles.dot} />
            <Text style={styles.text}>{section}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 80,
    gap: theme.spacing.md,
  },
  back: {
    color: theme.colors.accent,
    fontSize: 15,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
    marginTop: 6,
  },
  text: {
    flex: 1,
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  });
}
