import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { signIn } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { TrustBanner } from "../../components/ui/Premium";
import { useTheme, useThemeMode } from "../../components/ui/ThemeProvider";
import type { Theme } from "../../components/ui/theme";

function getSignInErrorMessage(error: any) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid") || message.includes("credentials") || message.includes("password")) {
    return "Email or password is incorrect.";
  }
  if (message.includes("email") && message.includes("confirm")) {
    return "Check your email and confirm your account before signing in.";
  }
  return "Could not sign in. Check your details and try again.";
}

function getPasswordResetErrorMessage(error: any) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("rate limit") || message.includes("too many") || message.includes("email rate")) {
    return "Please wait a few minutes before requesting another reset email.";
  }
  if (message.includes("invalid") && message.includes("email")) {
    return "Enter a valid email address.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "Could not connect. Check your internet connection and try again.";
  }
  return "Could not send reset instructions. Check the email and try again.";
}

export default function SignInScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { mode, setThemeMode } = useThemeMode();
  const darkModeEnabled = mode === "dark";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [resetCooldown, setResetCooldown] = useState(0);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = setTimeout(() => setResetCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resetCooldown]);

  async function handleSignIn() {
    setErrorText(null);
    if (!email.trim() || !password.trim()) {
      setErrorText("Enter your email and password.");
      Alert.alert("Missing fields", "Enter your email and password.");
      return;
    }
    try {
      setLoading(true);
      await signIn(email.trim(), password);
      router.replace("/app");
    } catch (err: any) {
      const message = getSignInErrorMessage(err);
      setErrorText(message);
      Alert.alert("Sign in failed", message);
    } finally {
      setLoading(false);
    }
  }

  function openResetPanel() {
    setResetEmail(email.trim());
    setResetMessage(null);
    setResetOpen(true);
  }

  async function handlePasswordReset() {
    const targetEmail = resetEmail.trim();
    setResetMessage(null);
    if (!targetEmail) {
      setResetMessage({ type: "error", text: "Enter the email address for your FEN account." });
      return;
    }
    if (resetCooldown > 0) {
      setResetMessage({ type: "error", text: `Please wait ${resetCooldown}s before requesting another reset email.` });
      return;
    }
    try {
      setResetLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail);
      if (error) throw error;
      setResetCooldown(45);
      setResetMessage({
        type: "success",
        text: "If that email is registered, Supabase will send password reset instructions.",
      });
    } catch (err: any) {
      console.log("Password reset request failed", err);
      setResetCooldown(45);
      setResetMessage({
        type: "error",
        text: getPasswordResetErrorMessage(err),
      });
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Image source={require("../../assets/images/fen-logo.png")} style={styles.icon} />

        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Fast Earn Nearby connects local jobs with nearby people who can help.</Text>

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

        <View style={styles.notice}>
          <Text style={styles.noticeText}>Please verify your email before posting, applying, or messaging.</Text>
        </View>

        <TrustBanner title="MVP payments">
          FEN does not process payments in this MVP. Any payment is agreed directly between users.
        </TrustBanner>

        <TextInput placeholder="Email" placeholderTextColor={theme.colors.placeholder} style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!loading} />
        <TextInput placeholder="Password" placeholderTextColor={theme.colors.placeholder} style={styles.input} secureTextEntry value={password} onChangeText={setPassword} editable={!loading} />

        {resetOpen ? (
          <View style={styles.resetPanel}>
            <View style={styles.resetHeader}>
              <View style={styles.resetHeaderText}>
                <Text style={styles.resetTitle}>Reset password</Text>
                <Text style={styles.resetSubtitle}>Enter your email and we will send reset instructions.</Text>
              </View>
              <Pressable onPress={() => setResetOpen(false)} disabled={resetLoading} hitSlop={10}>
                <Text style={styles.resetClose}>Close</Text>
              </Pressable>
            </View>
            <TextInput
              placeholder="Account email"
              placeholderTextColor={theme.colors.placeholder}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={resetEmail}
              onChangeText={setResetEmail}
              editable={!resetLoading}
            />
            {resetMessage ? (
              <Text style={resetMessage.type === "success" ? styles.resetSuccessText : styles.errorText}>
                {resetMessage.text}
              </Text>
            ) : null}
            <Pressable
              style={[styles.secondaryButton, (resetLoading || resetCooldown > 0) && styles.disabledButton]}
              onPress={handlePasswordReset}
              disabled={resetLoading || resetCooldown > 0}
            >
              {resetLoading ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : (
                <Text style={styles.secondaryButtonText}>
                  {resetCooldown > 0 ? `Try again in ${resetCooldown}s` : "Send reset email"}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <Pressable style={[styles.primaryButton, loading && styles.disabledButton]} onPress={handleSignIn} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={theme.colors.accentText} /> : <Text style={styles.primaryButtonText}>Sign in</Text>}
        </Pressable>

        <Pressable style={styles.forgotLink} onPress={openResetPanel} disabled={loading}>
          <Text style={styles.forgotLinkText}>Forgot password?</Text>
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable onPress={() => router.push("/legal/terms")}><Text style={styles.legalLink}>Terms</Text></Pressable>
          <Pressable onPress={() => router.push("/legal/privacy")}><Text style={styles.legalLink}>Privacy</Text></Pressable>
          <Pressable onPress={() => router.push("/legal/safety")}><Text style={styles.legalLink}>Safety</Text></Pressable>
          <Pressable onPress={() => router.push("/legal/payments")}><Text style={styles.legalLink}>Payments</Text></Pressable>
        </View>

        <Pressable onPress={() => router.push("/auth/sign-up")}>
          <Text style={styles.altText}>Need an account? Register</Text>
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
      color: theme.colors.text,
      fontSize: 31,
      fontWeight: "800",
    },
    subtitle: {
      color: theme.colors.muted,
      fontSize: 16,
      lineHeight: 23,
      marginBottom: 8,
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
    notice: {
      backgroundColor: theme.colors.surfaceAlt,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      marginBottom: 4,
    },
    noticeText: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    input: {
      backgroundColor: theme.colors.inputBg,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 15,
      color: theme.colors.text,
      fontSize: 16,
    },
    primaryButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      marginTop: 4,
    },
    primaryButtonText: {
      color: theme.colors.accentText,
      textAlign: "center",
      fontSize: 17,
      fontWeight: "800",
    },
    secondaryButton: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 14,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      textAlign: "center",
      fontSize: 15,
      fontWeight: "800",
    },
    disabledButton: {
      opacity: 0.5,
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
    resetSuccessText: {
      alignSelf: "stretch",
      color: theme.colors.successText,
      backgroundColor: theme.colors.successBg,
      borderColor: theme.colors.success,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      lineHeight: 18,
    },
    forgotLink: {
      alignSelf: "stretch",
      alignItems: "center",
      marginTop: -2,
    },
    forgotLinkText: {
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: "800",
    },
    resetPanel: {
      alignSelf: "stretch",
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
      borderRadius: 18,
      padding: 14,
      gap: 12,
    },
    resetHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    resetHeaderText: {
      flex: 1,
      gap: 4,
    },
    resetTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "800",
    },
    resetSubtitle: {
      color: theme.colors.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    resetClose: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: "800",
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
    altText: {
      color: theme.colors.text,
      textAlign: "center",
      fontSize: 15,
      fontWeight: "700",
      marginTop: 4,
    },
  });
}
