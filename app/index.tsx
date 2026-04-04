import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function IntroScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>FEN</Text>
        </View>
      </View>

      <Text style={styles.title}>Fast Earn Nearby</Text>
      <Text style={styles.subtitle}>Local help, when you need it.</Text>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/auth/sign-in")}>
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push("/auth/sign-up")}>
          <Text style={styles.secondaryButtonText}>Register</Text>
        </Pressable>
      </View>

      <Text style={styles.helper}>
        Browse local jobs, post simple work, and arrange help nearby without the clutter.
      </Text>
    </View>
  );
}

const colors = {
  bg: "#0E0A14",
  card: "#171024",
  border: "#231A33",
  text: "#E7D9FF",
  muted: "#CBB8F1",
  accent: "#B56CFF",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  logoWrap: {
    marginBottom: 28,
  },
  logoCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  logoText: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 17,
    textAlign: "center",
    marginBottom: 32,
  },
  actions: {
    width: "100%",
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 16,
  },
  primaryButtonText: {
    color: "#140E1D",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    borderRadius: 16,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  helper: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },
});
