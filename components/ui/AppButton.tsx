import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "./theme";

type Variant = "primary" | "secondary" | "ghost";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  icon?: ReactNode;
};

export default function AppButton({ title, onPress, variant = "primary", disabled = false, icon }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.base, styles[variant], disabled && styles.disabled]}
    >
      <View style={styles.content}>
        {icon}
        <Text style={[styles.text, styles[`${variant}Text`]]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primary: { backgroundColor: theme.colors.accent },
  secondary: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderStrong },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.4 },
  text: { textAlign: "center", fontSize: 17, fontWeight: "800" },
  primaryText: { color: theme.colors.accentText },
  secondaryText: { color: theme.colors.text },
  ghostText: { color: theme.colors.accent },
});
