import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { getConversation, getMessages, sendMessage } from "../../../lib/messaging";
import { supabase } from "../../../lib/supabase";
import type { Conversation, Message } from "../../../lib/types";
import { SignInRequired } from "../../../components/ui/Premium";

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<(Conversation & { job?: { title: string; status?: string }; poster?: { display_name: string }; worker?: { display_name: string } }) | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [requiresSignIn, setRequiresSignIn] = useState(false);

  const loadConversation = useCallback(async (active = true, showSpinner = true) => {
      if (!conversationId) {
        setErrorText("Conversation not found.");
        setLoading(false);
        return;
      }
      try {
        if (showSpinner) setLoading(true);
        setErrorText(null);
        setRequiresSignIn(false);
        const { data: { user } } = await supabase.auth.getUser();
        if (active) setCurrentUserId(user?.id ?? null);
        if (!user) {
          if (active) {
            setMessages([]);
            setConversation(null);
            setRequiresSignIn(true);
          }
          return;
        }

        const [conv, data] = await Promise.all([
          getConversation(conversationId),
          getMessages(conversationId),
        ]);
        if (active) setConversation(conv as any);
        if (active) setMessages(data);
      } catch (err: any) {
        console.log("Could not load messages", err?.message);
        if (active) setErrorText("Could not open this conversation.");
      } finally {
        if (active) setLoading(false);
      }
  }, [conversationId]);

  useEffect(() => {
    let active = true;
    loadConversation(active);
    return () => { active = false; };
  }, [loadConversation]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadConversation(active, false);
      return () => { active = false; };
    }, [loadConversation])
  );

  useEffect(() => {
    let active = true;
    const timer = setInterval(() => {
      loadConversation(active, false);
    }, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loadConversation]);

  async function handleSend() {
    if (!newMessage.trim()) {
      setSendError("Enter a message before sending.");
      return;
    }
    if (!conversationId || !currentUserId) {
      setSendError("Could not send because the conversation or user is missing.");
      return;
    }
    try {
      setSending(true);
      setSendError(null);
      const msg = await sendMessage(conversationId, "", newMessage.trim());
      setMessages((prev) => [...prev, msg as Message]);
      setNewMessage("");
      await loadConversation(true, false);
      if ((msg as any).activity_warning) {
        setSendError(`Message sent, but recent activity could not refresh: ${(msg as any).activity_warning}`);
      }
    } catch (err: any) {
      setSendError(err?.message || "Message could not be sent.");
      Alert.alert("Could not send", err?.message || "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  if (errorText) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Messages unavailable</Text>
        <Text style={styles.errorText}>{errorText}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isPoster = conversation?.poster_id === currentUserId;
  const otherName = isPoster
    ? conversation?.worker?.display_name || "Worker"
    : conversation?.poster?.display_name || "Poster";
  const jobTitle = conversation?.job?.title || "Job conversation";
  const isCompleted = conversation?.job?.status === "completed";
  const isCancelled = conversation?.job?.status === "cancelled";
  const isArchived = !!conversation?.is_archived;
  const isReadOnly = isCancelled || isCompleted || isArchived;

  function handleReportConversation() {
    if (!currentUserId) {
      setSendError("Sign in before reporting this conversation.");
      Alert.alert("Sign in required", "Sign in before reporting this conversation.");
      return;
    }
    setSendError("Report noted locally for MVP. Please keep screenshots.");
    Alert.alert(
      "Report noted locally for MVP. Please keep screenshots and do not continue if unsafe."
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B56CFF" />
        <Text style={styles.loadingText}>Loading conversation…</Text>
      </View>
    );
  }

  if (requiresSignIn) {
    return (
      <View style={styles.signInContainer}>
        <SignInRequired title="Sign in to view this conversation" text="Messages are private and only available to the selected poster and helper." />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{otherName}</Text>
        <Text style={styles.headerSubtitle}>{jobTitle}</Text>
        <Text style={styles.statusText}>Status: {conversation?.job?.status || "unknown"}</Text>
        <View style={styles.headerActions}>
          {conversation?.job_id ? (
            <Pressable style={styles.smallButton} onPress={() => router.push(`/app/job/${conversation.job_id}`)}>
              <Text style={styles.smallButtonText}>Open job</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.smallButton} onPress={handleReportConversation}>
            <Text style={styles.smallButtonText}>Report conversation</Text>
          </Pressable>
        </View>
      </View>

      {isReadOnly ? (
        <View style={styles.cancelledBanner}>
          <Text style={styles.cancelledText}>
            {isCompleted
              ? "This job is completed. This conversation is kept for your records."
              : isArchived
                ? "This conversation has been archived and is read-only."
                : "This job was cancelled. Any new arrangement requires a new agreement."}
          </Text>
        </View>
      ) : (
        <View style={styles.safetyBanner}>
          <Text style={styles.safetyText}>Keep arrangements clear. FEN does not process MVP payments.</Text>
        </View>
      )}

      <FlatList
        data={messages}
        keyExtractor={(item: Message) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }: { item: Message }) => {
          const isMe = item.sender_id === currentUserId;
          return (
            <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
              <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                {item.body}
              </Text>
              <Text style={[styles.messageTime, isMe ? styles.myMessageText : styles.theirMessageText]}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {isReadOnly ? "No messages were sent before this job closed." : "No messages yet. Start the conversation!"}
            </Text>
          </View>
        }
      />

      <View style={styles.inputRow}>
        {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
        <View style={styles.composerRow}>
          <TextInput
            style={styles.input}
            placeholder={isReadOnly ? "Chat is read-only" : "Type a message..."}
            placeholderTextColor="#8D79AF"
            value={newMessage}
            onChangeText={setNewMessage}
            editable={!sending && !isReadOnly}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <Pressable
            style={[styles.sendButton, (!newMessage.trim() || sending || isReadOnly) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending || isReadOnly}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#140E1D" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E0A14",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#231A33",
  },
  backText: {
    color: "#B56CFF",
    fontSize: 16,
    fontWeight: "700",
  },
  headerTitle: {
    color: "#E7D9FF",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 10,
  },
  headerSubtitle: {
    color: "#B56CFF",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  statusText: {
    color: "#A590C9",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  smallButton: {
    backgroundColor: "#171024",
    borderColor: "#3A2B52",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: "#E7D9FF",
    fontSize: 13,
    fontWeight: "800",
  },
  safetyBanner: {
    backgroundColor: "#20172E",
    borderBottomWidth: 1,
    borderBottomColor: "#5B3A87",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  safetyText: {
    color: "#CBB8F1",
    fontSize: 13,
    lineHeight: 18,
  },
  cancelledBanner: {
    backgroundColor: "#2B161B",
    borderBottomWidth: 1,
    borderBottomColor: "#8E4656",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelledText: {
    color: "#FFB0B0",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#B56CFF",
  },
  theirMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#171024",
    borderWidth: 1,
    borderColor: "#3A2B52",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  myMessageText: {
    color: "#140E1D",
  },
  theirMessageText: {
    color: "#E7D9FF",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#A590C9",
    fontSize: 14,
    textAlign: "center",
  },
  inputRow: {
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#231A33",
  },
  composerRow: {
    flexDirection: "row",
    gap: 10,
  },
  sendError: {
    color: "#FFB0B0",
    fontSize: 13,
  },
  input: {
    flex: 1,
    backgroundColor: "#171024",
    borderWidth: 1,
    borderColor: "#3A2B52",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#E7D9FF",
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: "#B56CFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#140E1D",
    fontSize: 15,
    fontWeight: "800",
  },
  centered: {
    flex: 1,
    backgroundColor: "#0E0A14",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  signInContainer: {
    flex: 1,
    backgroundColor: "#0E0A14",
    padding: 20,
    justifyContent: "center",
  },
  loadingText: {
    color: "#CBB8F1",
    marginTop: 12,
    fontSize: 15,
  },
  errorTitle: {
    color: "#E7D9FF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  errorText: {
    color: "#CBB8F1",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 18,
  },
  backButton: {
    backgroundColor: "#B56CFF",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backButtonText: {
    color: "#140E1D",
    fontSize: 15,
    fontWeight: "800",
  },
});
