import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { archiveInactiveConversations, filterActiveConversations, getConversationLifecycle, getConversations } from "../../../lib/messaging";
import { supabase } from "../../../lib/supabase";
import type { Conversation } from "../../../lib/types";
import { EmptyState, FeedbackNotice, LoadingState, SignInRequired } from "../../../components/ui/Premium";
import { confirmAction } from "../../../lib/confirmAction";

function ConversationCard({
  conversation,
  currentUserId,
}: {
  conversation: Conversation & { poster?: { display_name: string }; worker?: { display_name: string } };
  currentUserId: string | null;
}) {
  if (!conversation.id) {
    return (
      <View style={[styles.card, styles.cardDisabled]}>
        <Text style={styles.name}>Conversation unavailable</Text>
        <Text style={styles.preview}>This conversation is missing its id.</Text>
      </View>
    );
  }

  const isPoster = conversation.poster_id === currentUserId;
  const otherName = isPoster
    ? conversation.worker?.display_name || "Worker"
    : conversation.poster?.display_name || "Poster";
  const jobTitle = conversation.job?.title || "Unknown job";
  const lifecycle = getConversationLifecycle(conversation, currentUserId);

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/app/messages/${conversation.id}`)}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{otherName}</Text>
        <Text style={styles.role}>{isPoster ? "Worker" : "Poster"}</Text>
        {conversation.is_archived ? <Text style={styles.archived}>Archived</Text> : null}
      </View>
      <Text style={styles.job}>{jobTitle}</Text>
      <Text style={styles.preview}>{lifecycle.isActive ? "Tap to open conversation" : lifecycle.label}</Text>
      {conversation.updated_at ? <Text style={styles.activity}>Recent activity: {new Date(conversation.updated_at).toLocaleDateString()}</Text> : null}
    </Pressable>
  );
}

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<(Conversation & { poster?: { display_name: string }; worker?: { display_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [clearingOld, setClearingOld] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadConversations = useCallback(async (active = true, showSpinner = true) => {
      try {
        if (showSpinner) setLoading(true);
        setErrorText(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        if (!user) {
          setCurrentUserId(null);
          setConversations([]);
          return;
        }
        setCurrentUserId(user.id);
        const data = await getConversations();
        if (!active) return;
        setConversations((data as any[]).filter((conv) => conv?.id));
      } catch (err: any) {
        if (!active) return;
        setErrorText(err?.message || "Could not load conversations.");
      } finally {
        if (active) setLoading(false);
      }
  }, []);

  useEffect(() => {
    let active = true;
    loadConversations(active);
    return () => { active = false; };
  }, [loadConversations]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setActionMessage(null);
      loadConversations(active, false);
      return () => { active = false; };
    }, [loadConversations])
  );

  useEffect(() => {
    let active = true;
    const timer = setInterval(() => {
      loadConversations(active, false);
    }, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loadConversations]);

  async function handleClearOldChats() {
    confirmAction({
      title: "Clear old chats?",
      message: "Only inactive conversations will be hidden. Active chats will stay visible.",
      confirmText: "Clear",
      onConfirm: async () => {
        try {
          setClearingOld(true);
          const cleared = await archiveInactiveConversations();
          await loadConversations(true, false);
          if (cleared === 0) {
            setActionMessage({ type: "error", text: "No old chats to clear." });
            Alert.alert("No old chats to clear", "There are no inactive chats to clear.");
            return;
          }
          setActionMessage({ type: "success", text: `${cleared} old chat${cleared === 1 ? "" : "s"} cleared.` });
          Alert.alert("Old chats cleared", `${cleared} old chat${cleared === 1 ? "" : "s"} cleared.`);
        } catch (err: any) {
          console.log("Could not clear old chats", err);
          const message = err?.message || "Something went wrong.";
          setActionMessage({ type: "error", text: message });
          Alert.alert("Could not clear chats", message);
        } finally {
          setClearingOld(false);
        }
      },
    });
  }

  if (loading) {
    return <LoadingState text="Loading messages..." fullScreen />;
  }

  if (!currentUserId) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <SignInRequired title="Sign in to view messages" text="Messages are only available after a worker is selected for a job. Sign in to view your conversations." />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>Each conversation is tied to one job and stays text-only in MVP.</Text>
      <FeedbackNotice type="info" text="FEN chats help posters and helpers agree details after applying or selecting." />
      <Pressable style={styles.clearButton} onPress={handleClearOldChats} disabled={clearingOld}>
        <Text style={styles.clearButtonText}>{clearingOld ? "Clearing..." : "Clear old inactive chats"}</Text>
      </Pressable>

      {errorText ? (
        <FeedbackNotice type="error" text={errorText} />
      ) : null}

      {actionMessage ? (
        <FeedbackNotice type={actionMessage.type} text={actionMessage.text} />
      ) : null}

      {filterActiveConversations(conversations, currentUserId).length === 0 ? (
        <EmptyState
          title="No conversations yet"
          text="When you apply for a job or select a worker, your FEN chats will appear here."
        />
      ) : (
        filterActiveConversations(conversations, currentUserId).map((conv) => (
          <ConversationCard key={conv.id} conversation={conv} currentUserId={currentUserId} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0E0A14" },
  content: { padding: 20, paddingBottom: 110, gap: 14 },
  title: { color: "#E7D9FF", fontSize: 30, fontWeight: "800", marginTop: 8 },
  subtitle: { color: "#CBB8F1", fontSize: 16, lineHeight: 23, marginBottom: 2 },
  card: { backgroundColor: "#171024", borderWidth: 1, borderColor: "#231A33", borderRadius: 18, padding: 16, gap: 8 },
  cardDisabled: { opacity: 0.65 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  name: { color: "#E7D9FF", fontSize: 17, fontWeight: "800", flex: 1 },
  role: { color: "#B56CFF", fontSize: 12, fontWeight: "800" },
  archived: { color: "#CBB8F1", fontSize: 12, fontWeight: "700" },
  job: { color: "#B56CFF", fontSize: 14, fontWeight: "700" },
  preview: { color: "#CBB8F1", fontSize: 15, lineHeight: 22 },
  activity: { color: "#A590C9", fontSize: 12, fontWeight: "700" },
  clearButton: { backgroundColor: "#171024", borderColor: "#3A2B52", borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  clearButtonText: { color: "#CBB8F1", textAlign: "center", fontSize: 14, fontWeight: "800" },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  loadingText: { color: "#CBB8F1", fontSize: 15, marginTop: 12 },
  errorBox: { backgroundColor: "#2B161B", borderColor: "#8E4656", borderWidth: 1, borderRadius: 14, padding: 14 },
  errorText: { color: "#FFD8DE", fontSize: 14, lineHeight: 20 },
  successBox: { backgroundColor: "#102619", borderColor: "#2F7A45", borderWidth: 1, borderRadius: 14, padding: 14 },
  successText: { color: "#C8F7D2", fontSize: 14, lineHeight: 20, fontWeight: "700" },
  emptyText: { color: "#CBB8F1", fontSize: 15, textAlign: "center", lineHeight: 22 },
});
