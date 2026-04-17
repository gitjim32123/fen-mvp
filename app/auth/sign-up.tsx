import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, router } from "expo-router";
import { signUp } from "../../lib/auth";

export default function SignUpScreen() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Password too short", "Password must be at least 6 characters.");
      return;
    }
    try {
      setLoading(true);
      await signUp(email.trim(), password, displayName.trim(), postcode.trim().toUpperCase());
      Alert.alert("Check your email", "We've sent a confirmation link.", [
        { text: "OK", onPress: () => router.replace("/auth/sign-in") },
      ]);
    } catch (err: any) {
      Alert.alert("Registration failed", err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image source={require("../../assets/images/fen-logo.png")} style={styles.icon} />

      <Text style={styles.title}>Register</Text>
      <Text style={styles.subtitle}>Create a simple account to post a job or find work nearby.</Text>

      <TextInput placeholder="Display name" placeholderTextColor="#8D79AF" style={styles.input} value={displayName} onChangeText={setDisplayName} editable={!loading} />
      <TextInput placeholder="Email" placeholderTextColor="#8D79AF" style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!loading} />
      <TextInput placeholder="Postcode" placeholderTextColor="#8D79AF" style={styles.input} autoCapitalize="characters" value={postcode} onChangeText={setPostcode} editable={!loading} />
      <TextInput placeholder="Password" placeholderTextColor="#8D79AF" style={styles.input} secureTextEntry value={password} onChangeText={setPassword} editable={!loading} />

      <View style={styles.notice}>
        <Text style={styles.noticeText}>Verification is required before posting, applying, or messaging.</Text>
      </View>

      <Pressable style={[styles.primaryButton, loading && styles.disabledButton]} onPress={handleSignUp} disabled={loading}>
        {loading ? <ActivityIndicator size="small" color="#140E1D" /> : <Text style={styles.primaryButtonText}>Create account</Text>}
      </Pressable>

      <Link href="/auth/sign-in" asChild>
        <Pressable>
          <Text style={styles.altText}>Already have an account? Sign in</Text>
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
    marginBottom: 6,
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
  notice: {
    backgroundColor: colors.noticeBg,
    borderColor: colors.noticeBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  noticeText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
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
  disabledButton: {
    opacity: 0.5,
  },
  altText: {
    color: colors.text,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
});
