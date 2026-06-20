import { useMemo } from "react";
import { StyleSheet, Text, TextInput, View, TextInputProps } from "react-native";
import { useTheme } from "./ThemeProvider";
import type { Theme } from "./theme";

type Props = TextInputProps & {
  label?: string;
  hint?: string;
};

export default function AppTextField({ label, hint, style, ...props }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={theme.colors.placeholder}
        style={[styles.input, props.multiline && styles.multiline, style]}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
  wrap: { gap: 8, alignSelf: "stretch" },
  label: { color: theme.colors.text, fontSize: 15, fontWeight: "800" },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 15,
    color: theme.colors.text,
    fontSize: 16,
    minWidth: 0,
  },
  multiline: { minHeight: 110, textAlignVertical: "top" },
  hint: { color: theme.colors.subtle, fontSize: 13, lineHeight: 18 },
  });
}
