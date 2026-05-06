import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getConversation, getMessages, sendMessage } from "../../../lib/messaging";
import { supabase } from "../../../lib/supabase";
import type { Conversation, Message } from "../../../lib/types";

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<(Conversation & { job?: { title: string }; poster?: { display_name: string }; worker?: { display_name: string } }) | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!conversationId) {
        setErrorText("Conversation not found.");
        setLoading(false);
        return;
      }
      try {
        setErrorText(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (active) setCurrentUserId(user?.id ?? null);

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
    }
    load();
    return () => { active = false; };
  }, [conversationId]);

  async function handleSend() {
    if (!newMessage.trim() || !conversationId || !currentUserId) return;
    try {
      setSending(true);
      setSendError(null);
      const msg = await sendMessage(conversationId, "", newMessage.trim());
      setMessages((prev) => [...prev, msg as Message]);
      setNewMessage("");
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B56CFF" />
        <Text style={styles.loadingText}>Loading conversation…</Text>
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
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isMe = item.sender_id === currentUserId;
          return (
            <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
              <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                {item.body}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
          </View>
        }
      />

      <View style={styles.inputRow}>
        {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
        <View style={styles.composerRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message…"
            placeholderTextColor="#8D79AF"
            value={newMessage}
            onChangeText={setNewMessage}
            editable={!sending}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <Pressable
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
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
