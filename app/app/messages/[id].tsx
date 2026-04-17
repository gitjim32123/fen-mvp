import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getMessages, sendMessage } from "../../../lib/messaging";
import { supabase } from "../../../lib/supabase";
import type { Message } from "../../../lib/types";

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!conversationId) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (active) setCurrentUserId(user?.id ?? null);

        const data = await getMessages(conversationId);
        if (active) setMessages(data);
      } catch (err: any) {
        console.log("Could not load messages", err?.message);
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
      const msg = await sendMessage(conversationId, "", newMessage.trim());
      setMessages((prev) => [...prev, msg as Message]);
      setNewMessage("");
    } catch (err: any) {
      Alert.alert("Could not send", err?.message || "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

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
    flexDirection: "row",
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#231A33",
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
  },
  loadingText: {
    color: "#CBB8F1",
    marginTop: 12,
    fontSize: 15,
  },
});