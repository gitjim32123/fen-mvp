import { ScrollView, StyleSheet, Text, View } from "react-native";

function Conversation({ name, job, preview, archived = false }: { name: string; job: string; preview: string; archived?: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{name}</Text>
        {archived ? <Text style={styles.archived}>Archived</Text> : null}
      </View>
      <Text style={styles.job}>{job}</Text>
      <Text style={styles.preview}>{preview}</Text>
    </View>
  );
}

export default function MessagesScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>Each conversation is tied to one job and stays text-only in MVP.</Text>

      <Conversation name="Sarah" job="Help move a sofa" preview="I can come round after 3pm if that still works for you." />
      <Conversation name="Tom" job="Garden tidy-up" preview="Thanks, I have the tools and can start this morning." />
      <Conversation name="Jade" job="Parcel drop-off" preview="Completed now, thanks again." archived />
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
    marginBottom: 2,
  },
  card: {
    backgroundColor: "#171024",
    borderWidth: 1,
    borderColor: "#231A33",
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  name: {
    color: "#E7D9FF",
    fontSize: 17,
    fontWeight: "800",
  },
  archived: {
    color: "#CBB8F1",
    fontSize: 12,
    fontWeight: "700",
  },
  job: {
    color: "#B56CFF",
    fontSize: 14,
    fontWeight: "700",
  },
  preview: {
    color: "#CBB8F1",
    fontSize: 15,
    lineHeight: 22,
  },
});
