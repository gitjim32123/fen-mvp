import { StyleSheet, Text, TextInput, View, TextInputProps } from "react-native";

type Props = TextInputProps & {
  label?: string;
  hint?: string;
};

export default function AppTextField({ label, hint, ...props }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#8D79AF"
        style={[styles.input, props.multiline && styles.multiline]}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: "#E7D9FF", fontSize: 15, fontWeight: "700" },
  input: {
    backgroundColor: "#171024",
    borderColor: "#231A33",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 15,
    color: "#E7D9FF",
    fontSize: 16,
  },
  multiline: { minHeight: 110, textAlignVertical: "top" },
  hint: { color: "#A590C9", fontSize: 13, lineHeight: 18 },
});
