import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { archiveInactiveConversations, filterActiveConversations, getConversationLifecycle, getConversations } from "../../../lib/messaging";
import { supabase } from "../../../lib/supabase";
import type { Conversation } from "../../../lib/types";
import { EmptyState, FeedbackNotice, LoadingState, SignInRequired } from "../../../components/ui/Premium";
import { confirmAction } from "../../../lib/confirmAction";
import { useTheme } from "../../../components/ui/ThemeProvider";
import type { Theme } from "../../../components/ui/theme";

function ConversationCard({
  conversation,
  currentUserId,
}: {
  conversation: Conversation & { poster?: { display_name: string }; worker?: { display_name: string } };
  currentUserId: string | null;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

function createStyles(theme: Theme) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: 20, paddingBottom: 110, gap: 14 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: "800", marginTop: 8 },
  subtitle: { color: theme.colors.muted, fontSize: 16, lineHeight: 23, marginBottom: 2 },
  card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 18, padding: 16, gap: 8 },
  cardDisabled: { opacity: 0.65 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  name: { color: theme.colors.text, fontSize: 17, fontWeight: "800", flex: 1 },
  role: { color: theme.colors.accent, fontSize: 12, fontWeight: "800" },
  archived: { color: theme.colors.muted, fontSize: 12, fontWeight: "700" },
  job: { color: theme.colors.accent, fontSize: 14, fontWeight: "700" },
  preview: { color: theme.colors.muted, fontSize: 15, lineHeight: 22 },
  activity: { color: theme.colors.subtle, fontSize: 12, fontWeight: "700" },
  clearButton: { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong, borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  clearButtonText: { color: theme.colors.muted, textAlign: "center", fontSize: 14, fontWeight: "800" },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  loadingText: { color: theme.colors.muted, fontSize: 15, marginTop: 12 },
  errorBox: { backgroundColor: theme.colors.dangerBg, borderColor: theme.colors.danger, borderWidth: 1, borderRadius: 14, padding: 14 },
  errorText: { color: theme.colors.dangerText, fontSize: 14, lineHeight: 20 },
  successBox: { backgroundColor: theme.colors.successBg, borderColor: theme.colors.success, borderWidth: 1, borderRadius: 14, padding: 14 },
  successText: { color: theme.colors.successText, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  emptyText: { color: theme.colors.muted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  });
}
