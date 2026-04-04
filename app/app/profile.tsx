import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Keep your details simple and easy to update.</Text>

      <View style={styles.card}>
        <Text style={styles.name}>James</Text>
        <Text style={styles.meta}>DN11 · Drive</Text>
        <Text style={styles.bio}>Available for simple local help, collections, and small practical jobs.</Text>
      </View>

      <View style={styles.card}>
        <InfoRow label="Display name" value="James" />
        <InfoRow label="Postcode" value="DN11" />
        <InfoRow label="Transport" value="Drive" />
        <InfoRow label="Plan" value="Free" />
      </View>

      <Pressable style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Edit profile</Text>
      </Pressable>

      <Pressable style={styles.primaryButton}>
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
});
