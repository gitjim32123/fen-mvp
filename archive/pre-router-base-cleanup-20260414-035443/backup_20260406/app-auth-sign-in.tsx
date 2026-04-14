import { Link, router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function SignInScreen() {
  return (
    <View style={styles.container}>
      <Image source={require("../../assets/images/fen-final-icon.png")} style={styles.icon} />

      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Use your email and password to continue.</Text>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>Please verify your email before posting, applying, or messaging.</Text>
      </View>

      <TextInput placeholder="Email" placeholderTextColor="#8D79AF" style={styles.input} autoCapitalize="none" keyboardType="email-address" />
      <TextInput placeholder="Password" placeholderTextColor="#8D79AF" style={styles.input} secureTextEntry />

      <Pressable style={styles.primaryButton} onPress={() => router.replace("/app/browse")}>
        <Text style={styles.primaryButtonText}>Sign in</Text>
      </Pressable>

      <Pressable>
        <Text style={styles.forgotText}>Forgot password</Text>
      </Pressable>

      <Link href="/auth/sign-up" asChild>
        <Pressable>
          <Text style={styles.altText}>Need an account? Register</Text>
        </Pressable>
      </Link>
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
  noticeBg: "#20172E",
  noticeBorder: "#5B3A87",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 31,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 8,
  },
  notice: {
    backgroundColor: colors.noticeBg,
    borderColor: colors.noticeBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
  },
  noticeText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 15,
    color: colors.text,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#140E1D",
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
  },
  forgotText: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 15,
    marginTop: 4,
  },
  altText: {
    color: colors.text,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
});
