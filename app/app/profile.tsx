import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { getProfile, signOut, updateProfile } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/types";
import type { TransportMode } from "../../lib/types";
import { InfoMetric, SignInRequired, TrustBanner } from "../../components/ui/Premium";

const TRANSPORT_OPTIONS: { value: TransportMode; label: string }[] = [
  { value: "walk", label: "Walk" },
  { value: "cycle", label: "Cycle" },
  { value: "drive", label: "Drive" },
  { value: "public_transport", label: "Public transport" },
  { value: "unspecified", label: "Not sure" },
];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPostcode, setEditPostcode] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editTransport, setEditTransport] = useState<TransportMode>("unspecified");
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        if (!user) {
          setCurrentUserId(null);
          setProfile(null);
          return;
        }
        setCurrentUserId(user.id);
        const data = await getProfile();
        if (!active) return;
        setProfile(data);
        if (data) {
          setEditDisplayName(data.display_name || "");
          setEditPostcode(data.postcode || "");
          setEditBio(data.bio || "");
          setEditTransport(data.transport_mode || "unspecified");
        }
      } catch (err: any) {
        if (!active) return;
        setProfile(null);
        setActionMessage({ type: "error", text: err?.message || "Could not load your profile." });
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  async function handleLogout() {
    try {
      setActionMessage(null);
      setLoggingOut(true);
      await signOut();
      router.replace("/auth/sign-in");
    } catch (err: any) {
      const message = err?.message || "Try again.";
      setActionMessage({ type: "error", text: message });
      Alert.alert("Could not sign out", message);
    } finally {
      setLoggingOut(false);
    }
  }

  function startEditing() {
    if (profile) {
      setEditDisplayName(profile.display_name || "");
      setEditPostcode(profile.postcode || "");
      setEditBio(profile.bio || "");
      setEditTransport(profile.transport_mode || "unspecified");
    }
    setEditing(true);
  }

  async function handleSave() {
    setActionMessage(null);
    if (!currentUserId) {
      setActionMessage({ type: "error", text: "Sign in before updating your profile." });
      Alert.alert("Sign in required", "Sign in before updating your profile.");
      return;
    }
    if (!editDisplayName.trim()) {
      setActionMessage({ type: "error", text: "Enter a display name." });
      Alert.alert("Name required", "Enter a display name.");
      return;
    }
    try {
      setSaving(true);
      await updateProfile({
        display_name: editDisplayName.trim(),
        postcode: editPostcode.trim().toUpperCase(),
        bio: editBio.trim() || null,
        transport_mode: editTransport,
      });
      const updated = await getProfile();
      setProfile(updated);
      setEditing(false);
      setActionMessage({ type: "success", text: "Your profile has been updated." });
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (err: any) {
      const message = err?.message || "Try again.";
      setActionMessage({ type: "error", text: message });
      Alert.alert("Could not save", message);
    } finally {
      setSaving(false);
    }
  }

  const transportLabel = profile?.transport_mode === "walk" ? "Walk"
    : profile?.transport_mode === "cycle" ? "Cycle"
    : profile?.transport_mode === "drive" ? "Drive"
    : profile?.transport_mode === "public_transport" ? "Public transport"
    : "Unspecified";
  const completeness = [
    profile?.display_name,
    profile?.postcode,
    profile?.bio,
    profile?.transport_mode && profile.transport_mode !== "unspecified",
  ].filter(Boolean).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B56CFF" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  if (!currentUserId) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <SignInRequired title="Sign in to view profile" text="Your profile, account details, and settings are only available after sign-in." />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Keep your details simple and easy to update.</Text>

      {actionMessage ? (
        <Text style={actionMessage.type === "success" ? styles.successText : styles.inlineErrorText}>
          {actionMessage.text}
        </Text>
      ) : null}

      {editing ? (
        <>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              style={styles.fieldInput}
              value={editDisplayName}
              onChangeText={setEditDisplayName}
              placeholder="Your name"
              placeholderTextColor="#8D79AF"
              editable={!saving}
            />

            <Text style={styles.fieldLabel}>Postcode</Text>
            <TextInput
              style={styles.fieldInput}
              value={editPostcode}
              onChangeText={(v: string) => setEditPostcode(v.toUpperCase())}
              placeholder="e.g. SW1A 1AA"
              placeholderTextColor="#8D79AF"
              autoCapitalize="characters"
              editable={!saving}
            />

            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldTextArea]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="A short description about yourself (optional)"
              placeholderTextColor="#8D79AF"
              multiline
              textAlignVertical="top"
              editable={!saving}
            />

            <Text style={styles.fieldLabel}>Transport</Text>
            <View style={styles.transportRow}>
              {TRANSPORT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.transportChip, editTransport === opt.value && styles.transportChipActive]}
                  onPress={() => !saving && setEditTransport(opt.value)}
                  disabled={saving}
                >
                  <Text style={[styles.transportChipText, editTransport === opt.value && styles.transportChipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.editActions}>
            <Pressable style={[styles.primaryButton, saving && styles.disabledButton]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#140E1D" /> : <Text style={styles.primaryButtonText}>Save changes</Text>}
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setEditing(false)} disabled={saving}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.name}>{profile?.display_name || "No name set"}</Text>
            <Text style={styles.meta}>{profile?.postcode || "—"} · {transportLabel}</Text>
            <Text style={styles.bio}>{profile?.bio || "No bio yet."}</Text>
          </View>

          <View style={styles.metricsRow}>
            <InfoMetric label="Profile" value={`${Math.round((completeness / 4) * 100)}%`} />
            <InfoMetric label="Completed" value={String(profile?.completed_jobs_count ?? 0)} />
            <InfoMetric label="Plan" value={profile?.plan_tier === "worker_plus" ? "Plus" : "Free"} />
          </View>

          <View style={styles.card}>
            <InfoRow label="Display name" value={profile?.display_name || "—"} />
            <InfoRow label="Postcode" value={profile?.postcode || "—"} />
            <InfoRow label="Transport" value={transportLabel} />
            <InfoRow label="Plan" value={profile?.plan_tier === "worker_plus" ? "Worker Plus" : "Free"} />
            <InfoRow label="Completed jobs" value={String(profile?.completed_jobs_count ?? 0)} />
          </View>

          <Pressable style={styles.secondaryButton} onPress={startEditing}>
            <Text style={styles.secondaryButtonText}>Edit profile</Text>
          </Pressable>
        </>
      )}

      <TrustBanner title="About FEN">
        FEN connects people for local jobs. It does not provide the work, employ helpers, or process payments in MVP.
      </TrustBanner>

      <View style={styles.legalRow}>
        <Pressable onPress={() => router.push("/legal/terms")}><Text style={styles.legalLink}>Terms</Text></Pressable>
        <Pressable onPress={() => router.push("/legal/privacy")}><Text style={styles.legalLink}>Privacy</Text></Pressable>
        <Pressable onPress={() => router.push("/legal/safety")}><Text style={styles.legalLink}>Safety</Text></Pressable>
        <Pressable onPress={() => router.push("/legal/payments")}><Text style={styles.legalLink}>Payments</Text></Pressable>
      </View>

      <Pressable style={[styles.primaryButton, loggingOut && styles.disabledButton]} onPress={handleLogout} disabled={loggingOut}>
        {loggingOut ? <ActivityIndicator size="small" color="#140E1D" /> : <Text style={styles.primaryButtonText}>Logout</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0E0A14",
  },
  content: {
    padding: 20,
    paddingBottom: 110,
    gap: 14,
  },
  title: {
    color: "#E7D9FF",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 8,
  },
  subtitle: {
    color: "#CBB8F1",
    fontSize: 16,
    lineHeight: 23,
  },
  card: {
    backgroundColor: "#171024",
    borderWidth: 1,
    borderColor: "#231A33",
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  name: {
    color: "#E7D9FF",
    fontSize: 22,
    fontWeight: "800",
  },
  meta: {
    color: "#B56CFF",
    fontSize: 14,
    fontWeight: "700",
  },
  bio: {
    color: "#CBB8F1",
    fontSize: 15,
    lineHeight: 22,
  },
  infoRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#231A33",
  },
  infoLabel: {
    color: "#A590C9",
    fontSize: 13,
    marginBottom: 4,
  },
  infoValue: {
    color: "#E7D9FF",
    fontSize: 16,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  secondaryButton: {
    backgroundColor: "#171024",
    borderWidth: 1,
    borderColor: "#231A33",
    borderRadius: 16,
    paddingVertical: 16,
  },
  secondaryButtonText: {
    color: "#E7D9FF",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
  },
  primaryButton: {
    backgroundColor: "#B56CFF",
    borderRadius: 16,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: "#140E1D",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.5,
  },
  editActions: {
    gap: 12,
  },
  fieldLabel: {
    color: "#A590C9",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 8,
  },
  fieldInput: {
    backgroundColor: "#0E0A14",
    borderColor: "#3A2B52",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#E7D9FF",
    fontSize: 15,
  },
  fieldTextArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  transportRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  transportChip: {
    backgroundColor: "#0E0A14",
    borderColor: "#3A2B52",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  transportChipActive: {
    backgroundColor: "#2A1E3D",
    borderColor: "#B56CFF",
  },
  transportChipText: {
    color: "#A590C9",
    fontSize: 13,
    fontWeight: "700",
  },
  transportChipTextActive: {
    color: "#F0E2FF",
  },
  centered: {
    flex: 1,
    backgroundColor: "#0E0A14",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#CBB8F1",
    fontSize: 15,
    marginTop: 12,
  },
  inlineErrorText: {
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
  successText: {
    color: "#C8F7D2",
    backgroundColor: "#102619",
    borderColor: "#2F7A45",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  trustCard: {
    backgroundColor: "#20172E",
    borderWidth: 1,
    borderColor: "#5B3A87",
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  trustTitle: {
    color: "#E7D9FF",
    fontSize: 16,
    fontWeight: "800",
  },
  trustText: {
    color: "#CBB8F1",
    fontSize: 14,
    lineHeight: 20,
  },
  legalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  legalLink: {
    color: "#B56CFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
