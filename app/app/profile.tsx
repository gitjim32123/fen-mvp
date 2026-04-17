import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { getProfile, signOut, updateProfile } from "../../lib/auth";
import type { Profile } from "../../lib/types";
import type { TransportMode } from "../../lib/types";

const TRANSPORT_OPTIONS: { value: TransportMode; label: string }[] = [
  { value: "walk", label: "Walk" },
  { value: "cycle", label: "Cycle" },
  { value: "drive", label: "Drive" },
  { value: "public_transport", label: "Public transport" },
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
  const [editTransport, setEditTransport] = useState<TransportMode>("walk");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await getProfile();
        if (!active) return;
        setProfile(data);
        if (data) {
          setEditDisplayName(data.display_name || "");
          setEditPostcode(data.postcode || "");
          setEditBio(data.bio || "");
          setEditTransport(data.transport_mode || "walk");
        }
      } catch {
        if (!active) return;
        setProfile(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  async function handleLogout() {
    try {
      await signOut();
      router.replace("/auth/sign-in");
    } catch (err: any) {
      Alert.alert("Could not sign out", err?.message || "Try again.");
    }
  }

  function startEditing() {
    if (profile) {
      setEditDisplayName(profile.display_name || "");
      setEditPostcode(profile.postcode || "");
      setEditBio(profile.bio || "");
      setEditTransport(profile.transport_mode || "walk");
    }
    setEditing(true);
  }

  async function handleSave() {
    if (!editDisplayName.trim()) {
      Alert.alert("Name required", "Enter a display name.");
      return;
    }
    try {
      setSaving(true);
      await updateProfile({
        display_name: editDisplayName.trim(),
        postcode: editPostcode.trim().toUpperCase(),
        bio: editBio.trim() || undefined,
        transport_mode: editTransport,
      });
      const updated = await getProfile();
      setProfile(updated);
      setEditing(false);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (err: any) {
      Alert.alert("Could not save", err?.message || "Try again.");
    } finally {
      setSaving(false);
    }
  }

  const transportLabel = profile?.transport_mode === "walk" ? "Walk"
    : profile?.transport_mode === "cycle" ? "Cycle"
    : profile?.transport_mode === "drive" ? "Drive"
    : profile?.transport_mode === "public_transport" ? "Public transport"
    : "Unspecified";

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B56CFF" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Keep your details simple and easy to update.</Text>

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
              onChangeText={(v) => setEditPostcode(v.toUpperCase())}
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

      <View style={styles.trustCard}>
        <Text style={styles.trustTitle}>About FEN</Text>
        <Text style={styles.trustText}>FEN connects people who need local help with people nearby who can help. FEN is a platform — it does not provide, guarantee, or supervise the work itself.</Text>
        <Text style={styles.trustText}>Users are responsible for their own safety. Always meet in safe, public-feeling places and use your own judgement.</Text>
        <Text style={styles.trustText}>FEN does not process payments in MVP. Any money is agreed and exchanged directly between users.</Text>
        <Text style={styles.trustText}>FEN is not liable for disputes, losses, or cancellations between users. You are responsible for any jobs you post, accept, or cancel.</Text>
        <Text style={styles.trustText}>Subscription tiers such as Worker Plus may be introduced later. Your current plan is shown above.</Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={handleLogout}>
        <Text style={styles.primaryButtonText}>Logout</Text>
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
});
