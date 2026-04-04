import { Pressable, StyleSheet, Text } from "react-native";

type Variant = "primary" | "secondary" | "ghost";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
};

export default function AppButton({ title, onPress, variant = "primary", disabled = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.base, styles[variant], disabled && styles.disabled]}
    >
      <Text style={[styles.text, styles[`${variant}Text`]]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18 },
  primary: { backgroundColor: "#B56CFF" },
  secondary: { backgroundColor: "#171024", borderWidth: 1, borderColor: "#231A33" },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.4 },
  text: { textAlign: "center", fontSize: 17, fontWeight: "800" },
  primaryText: { color: "#140E1D" },
  secondaryText: { color: "#E7D9FF" },
  ghostText: { color: "#B56CFF" },
});
