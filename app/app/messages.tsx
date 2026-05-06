import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { getConversations } from "../../lib/messaging";
import { supabase } from "../../lib/supabase";
import type { Conversation } from "../../lib/types";

function ConversationCard({
  conversation,
  currentUserId,
}: {
  conversation: Conversation & { job?: { title: string }; poster?: { display_name: string }; worker?: { display_name: string } };
  currentUserId: string | null;
}) {
  const isPoster = conversation.poster_id === currentUserId;
  const otherName = isPoster
    ? conversation.worker?.display_name || "Worker"
    : conversation.poster?.display_name || "Poster";
  const jobTitle = conversation.job?.title || "Unknown job";

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/app/messages/${conversation.id}`)}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{otherName}</Text>
        <Text style={styles.role}>{isPoster ? "Worker" : "Poster"}</Text>
        {conversation.is_archived ? <Text style={styles.archived}>Archived</Text> : null}
      </View>
      <Text style={styles.job}>{jobTitle}</Text>
      <Text style={styles.preview}>Tap to open conversation</Text>
    </Pressable>
  );
}

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<(Conversation & { job?: { title: string }; poster?: { display_name: string }; worker?: { display_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setErrorText(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (active) setCurrentUserId(user?.id ?? null);
        const data = await getConversations();
        if (!active) return;
        setConversations(data as any);
      } catch (err: any) {
        if (!active) return;
        setErrorText(err?.message || "Could not load conversations.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B56CFF" />
        <Text style={styles.loadingText}>Loading messages…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>Each conversation is tied to one job and stays text-only in MVP.</Text>

      {errorText ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : null}

      {conversations.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No conversations yet. Apply for a job or select a worker to start messaging.</Text>
        </View>
      ) : (
        conversations.map((conv) => (
          <ConversationCard key={conv.id} conversation={conv} currentUserId={currentUserId} />
        ))
      )}
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
    flex: 1,
  },
  role: {
    color: "#B56CFF",
    fontSize: 12,
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
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    color: "#CBB8F1",
    fontSize: 15,
    marginTop: 12,
  },
  errorBox: {
    backgroundColor: "#2B161B",
    borderColor: "#8E4656",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  errorText: {
    color: "#FFD8DE",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    color: "#CBB8F1",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
