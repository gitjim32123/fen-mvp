import { useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { signUp } from "../../lib/auth";
import { TrustBanner } from "../../components/ui/Premium";
import type { TransportMode } from "../../lib/types";

const TRANSPORT_OPTIONS: { value: TransportMode; label: string }[] = [
  { value: "walk", label: "Walk" },
  { value: "cycle", label: "Cycle" },
  { value: "drive", label: "Drive" },
  { value: "public_transport", label: "Public transport" },
  { value: "unspecified", label: "Not sure" },
];

export default function SignUpScreen() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [transportMode, setTransportMode] = useState<TransportMode>("unspecified");
  const [understandsPlatform, setUnderstandsPlatform] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < 6;

  async function handleSignUp() {
    setSuccessMessage(null);
    setErrorText(null);
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      setErrorText("Fill in all required fields.");
      Alert.alert("Missing fields", "Fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      setErrorText("Password must be at least 6 characters.");
      Alert.alert("Password too short", "Password must be at least 6 characters.");
      return;
    }
    if (!understandsPlatform) {
      setErrorText("Confirm you understand FEN is a connection platform and does not process payments in MVP.");
      Alert.alert("Confirm platform basics", "Confirm you understand FEN is a connection platform and does not process payments in MVP.");
      return;
    }
    try {
      setLoading(true);
      await signUp(email.trim(), password, displayName.trim(), postcode.trim().toUpperCase(), transportMode);
      setSuccessMessage("Account created. Check your email for the confirmation link.");
      Alert.alert("Check your email", "We've sent a confirmation link.", [
        { text: "OK", onPress: () => router.replace("/auth/sign-in") },
      ]);
    } catch (err: any) {
      const message = err?.message || "Something went wrong.";
      setErrorText(message);
      Alert.alert("Registration failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Image source={require("../../assets/images/fen-logo.png")} style={styles.icon} />

        <Text style={styles.title}>Register</Text>
        <Text style={styles.subtitle}>Fast Earn Nearby connects people who need quick local help with people nearby who can help.</Text>

        <TextInput placeholder="Display name" placeholderTextColor="#8D79AF" style={styles.input} value={displayName} onChangeText={setDisplayName} editable={!loading} />
        <TextInput placeholder="Email" placeholderTextColor="#8D79AF" style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!loading} />
        <TextInput placeholder="Postcode" placeholderTextColor="#8D79AF" style={styles.input} autoCapitalize="characters" value={postcode} onChangeText={setPostcode} editable={!loading} />
        <TextInput placeholder="Password" placeholderTextColor="#8D79AF" style={styles.input} secureTextEntry value={password} onChangeText={setPassword} editable={!loading} />
        {passwordTooShort ? (
          <Text style={styles.validationText}>Password must be at least 6 characters.</Text>
        ) : null}

        <Text style={styles.sectionLabel}>Transport</Text>
        <View style={styles.optionRow}>
          {TRANSPORT_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.optionChip, transportMode === option.value && styles.optionChipActive]}
              onPress={() => setTransportMode(option.value)}
              disabled={loading}
            >
              <Text style={[styles.optionChipText, transportMode === option.value && styles.optionChipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <TrustBanner title="How FEN works">
          FEN connects local people. It does not employ helpers, supervise work, or process payments in MVP.
        </TrustBanner>

        <Pressable
          style={[styles.confirmBox, understandsPlatform && styles.confirmBoxActive]}
          onPress={() => setUnderstandsPlatform((v) => !v)}
          disabled={loading}
        >
          <View style={[styles.checkbox, understandsPlatform && styles.checkboxActive]}>
            {understandsPlatform ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <View style={styles.confirmCopy}>
            <Text style={styles.confirmText}>
              I understand FEN is a connection platform, not an employer, supervisor, or payment processor.
            </Text>
            {!understandsPlatform ? (
              <Text style={styles.confirmHint}>Tick this to activate Create account.</Text>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable onPress={() => router.push("/legal/terms")}><Text style={styles.legalLink}>Terms</Text></Pressable>
          <Pressable onPress={() => router.push("/legal/privacy")}><Text style={styles.legalLink}>Privacy</Text></Pressable>
          <Pressable onPress={() => router.push("/legal/safety")}><Text style={styles.legalLink}>Safety</Text></Pressable>
          <Pressable onPress={() => router.push("/legal/payments")}><Text style={styles.legalLink}>Payments</Text></Pressable>
        </View>

        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <Pressable style={[styles.primaryButton, (loading || passwordTooShort || !understandsPlatform) && styles.disabledButton]} onPress={handleSignUp} disabled={loading || passwordTooShort || !understandsPlatform}>
          {loading ? <ActivityIndicator size="small" color="#140E1D" /> : <Text style={styles.primaryButtonText}>Create account</Text>}
        </Pressable>

        <Pressable onPress={() => router.push("/auth/sign-in")}>
          <Text style={styles.altText}>Already have an account? Sign in</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  keyboard: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  subtitle: {
    alignSelf: "stretch",
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 6,
    textAlign: "center",
  },
  input: {
    alignSelf: "stretch",
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
  sectionLabel: {
    alignSelf: "stretch",
    textAlign: "center",
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  optionRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  optionChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: "100%",
  },
  optionChipActive: {
    borderColor: colors.accent,
    backgroundColor: "#2A1E3D",
  },
  optionChipText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  optionChipTextActive: {
    color: colors.text,
  },
  confirmBox: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  confirmBoxActive: {
    borderColor: colors.accent,
    backgroundColor: "#20172E",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.muted,
    backgroundColor: "#0E0A14",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  checkboxMark: {
    color: "#140E1D",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 18,
  },
  confirmCopy: {
    flex: 1,
    gap: 4,
  },
  confirmText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  confirmHint: {
    color: "#FFB84D",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  legalRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  legalLink: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "800",
  },
  validationText: {
    color: "#FFB0B0",
    fontSize: 13,
    alignSelf: "stretch",
  },
  successText: {
    color: "#BFE8C8",
    fontSize: 14,
    lineHeight: 20,
    alignSelf: "stretch",
  },
  errorText: {
    alignSelf: "stretch",
    color: "#FFD8DE",
    backgroundColor: "#2B161B",
    borderColor: "#8E4656",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    alignSelf: "stretch",
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#140E1D",
    textAlign: "center",
    fontSize: 16,
    lineHeight: 20,
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
