import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { signUp } from "../../lib/auth";
import { TrustBanner } from "../../components/ui/Premium";
import { useTheme, useThemeMode } from "../../components/ui/ThemeProvider";
import type { Theme } from "../../components/ui/theme";
import type { TransportMode } from "../../lib/types";

const TRANSPORT_OPTIONS: { value: TransportMode; label: string }[] = [
  { value: "walk", label: "Walk" },
  { value: "cycle", label: "Cycle" },
  { value: "drive", label: "Drive" },
  { value: "public_transport", label: "Public transport" },
  { value: "unspecified", label: "Not sure" },
];

export default function SignUpScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { mode, setThemeMode } = useThemeMode();
  const darkModeEnabled = mode === "dark";

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

        <View style={styles.appearanceRow}>
          <Text style={styles.appearanceText}>Dark mode</Text>
          <Switch
            value={darkModeEnabled}
            onValueChange={(enabled: boolean) => {
              void setThemeMode(enabled ? "dark" : "light");
            }}
            thumbColor={theme.colors.accent}
            trackColor={{ false: theme.colors.borderStrong, true: theme.colors.accent }}
          />
        </View>

        <TextInput placeholder="Display name" placeholderTextColor={theme.colors.placeholder} style={styles.input} value={displayName} onChangeText={setDisplayName} editable={!loading} />
        <TextInput placeholder="Email" placeholderTextColor={theme.colors.placeholder} style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!loading} />
        <TextInput placeholder="Postcode" placeholderTextColor={theme.colors.placeholder} style={styles.input} autoCapitalize="characters" value={postcode} onChangeText={setPostcode} editable={!loading} />
        <TextInput placeholder="Password" placeholderTextColor={theme.colors.placeholder} style={styles.input} secureTextEntry value={password} onChangeText={setPassword} editable={!loading} />
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
            {understandsPlatform ? <Text style={styles.checkboxMark}>OK</Text> : null}
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
          {loading ? <ActivityIndicator size="small" color={theme.colors.accentText} /> : <Text style={styles.primaryButtonText}>Create account</Text>}
        </Pressable>

        <Pressable onPress={() => router.push("/auth/sign-in")}>
          <Text style={styles.altText}>Already have an account? Sign in</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    keyboard: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    screen: {
      flex: 1,
      backgroundColor: theme.colors.bg,
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
      color: theme.colors.text,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "800",
    },
    subtitle: {
      alignSelf: "stretch",
      color: theme.colors.muted,
      fontSize: 16,
      lineHeight: 23,
      marginBottom: 6,
      textAlign: "center",
    },
    appearanceRow: {
      alignSelf: "stretch",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      marginTop: -4,
    },
    appearanceText: {
      color: theme.colors.muted,
      fontSize: 13,
      fontWeight: "800",
    },
    input: {
      alignSelf: "stretch",
      backgroundColor: theme.colors.inputBg,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 15,
      color: theme.colors.text,
      fontSize: 16,
    },
    sectionLabel: {
      alignSelf: "stretch",
      textAlign: "center",
      color: theme.colors.text,
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
      backgroundColor: theme.colors.chipBg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      maxWidth: "100%",
    },
    optionChipActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.chipActiveBg,
    },
    optionChipText: {
      color: theme.colors.muted,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "700",
      textAlign: "center",
    },
    optionChipTextActive: {
      color: theme.colors.text,
    },
    confirmBox: {
      alignSelf: "stretch",
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
    },
    confirmBoxActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.surfaceAlt,
    },
    checkbox: {
      width: 28,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.muted,
      backgroundColor: theme.colors.bg,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    checkboxActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accent,
    },
    checkboxMark: {
      color: theme.colors.accentText,
      fontSize: 10,
      fontWeight: "900",
      lineHeight: 13,
    },
    confirmCopy: {
      flex: 1,
      gap: 4,
    },
    confirmText: {
      color: theme.colors.muted,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "700",
    },
    confirmHint: {
      color: theme.colors.warningText,
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
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: "800",
    },
    validationText: {
      color: theme.colors.dangerText,
      fontSize: 13,
      alignSelf: "stretch",
    },
    successText: {
      color: theme.colors.successText,
      backgroundColor: theme.colors.successBg,
      borderColor: theme.colors.success,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      lineHeight: 20,
      alignSelf: "stretch",
    },
    errorText: {
      alignSelf: "stretch",
      color: theme.colors.dangerText,
      backgroundColor: theme.colors.dangerBg,
      borderColor: theme.colors.danger,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      lineHeight: 18,
    },
    primaryButton: {
      alignSelf: "stretch",
      backgroundColor: theme.colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      marginTop: 4,
    },
    primaryButtonText: {
      color: theme.colors.accentText,
      textAlign: "center",
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "800",
    },
    disabledButton: {
      opacity: 0.5,
    },
    altText: {
      color: theme.colors.text,
      textAlign: "center",
      fontSize: 15,
      fontWeight: "700",
      marginTop: 4,
    },
  });
}
