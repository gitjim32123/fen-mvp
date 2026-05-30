import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { getConversation, getConversationLifecycle, getMessages, sendMessage } from "../../../lib/messaging";
import { hasReported, submitReport } from "../../../lib/reports";
import { supabase } from "../../../lib/supabase";
import type { Conversation, Message } from "../../../lib/types";
import { FeedbackNotice, LoadingState, SignInRequired } from "../../../components/ui/Premium";

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<(Conversation & { poster?: { display_name: string }; worker?: { display_name: string } }) | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [conversationFeedback, setConversationFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [reportingConversation, setReportingConversation] = useState(false);
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
    setSendError(null);
    setConversationFeedback(null);
    loadConversation(active);
    return () => { active = false; };
  }, [loadConversation]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setSendError(null);
      setConversationFeedback(null);
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
      setConversationFeedback(null);
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
  const conversationLifecycle = getConversationLifecycle(conversation, currentUserId);
  const isReadOnly = !conversationLifecycle.isActive;

  async function handleReportConversation() {
    if (!currentUserId) {
      setSendError("Sign in before reporting this conversation.");
      Alert.alert("Sign in required", "Sign in before reporting this conversation.");
      return;
    }
    if (!conversation?.job_id || !conversationId) {
      setConversationFeedback({ type: "error", text: "Report could not be sent because this conversation is missing job details." });
      return;
    }
    try {
      setReportingConversation(true);
      setSendError(null);
      setConversationFeedback(null);
      const alreadyReported = await hasReported(conversation.job_id, currentUserId);
      if (!alreadyReported) {
        await submitReport({
          jobId: conversation.job_id,
          reporterId: currentUserId,
          reason: "Inappropriate content",
          details: `Reported from conversation ${conversationId}. User was advised to keep screenshots if unsafe.`,
        });
      }
      const text = alreadyReported
        ? "You have already sent a report for this job. Please keep screenshots if unsafe."
        : "Report sent. Please keep screenshots if unsafe.";
      setConversationFeedback({ type: "success", text });
      Alert.alert("Report sent", text);
    } catch (err: any) {
      console.log("Could not report conversation", err?.message);
      const text = "Report could not be sent. Please keep screenshots if unsafe.";
      setConversationFeedback({ type: "error", text });
      Alert.alert("Could not send report", text);
    } finally {
      setReportingConversation(false);
    }
  }

  if (loading) {
    return <LoadingState text="Loading conversation..." fullScreen />;
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
          <Pressable style={styles.smallButton} onPress={handleReportConversation} disabled={reportingConversation}>
            <Text style={styles.smallButtonText}>{reportingConversation ? "Reporting..." : "Report conversation"}</Text>
          </Pressable>
        </View>
      </View>

      {isReadOnly ? (
        <FeedbackNotice
          type="warning"
          text={
            isCompleted
              ? "This job is completed. This conversation is kept for your records."
              : isCancelled
                ? "This job was cancelled. Any new arrangement requires a new agreement."
                : isArchived
                  ? "This conversation has been archived and is read-only."
                  : conversationLifecycle.reason
          }
        />
      ) : (
        <FeedbackNotice type="info" text="Keep arrangements clear. FEN does not process payments in this MVP." />
      )}

      <View style={styles.guidancePanel}>
        <Text style={styles.guidanceTitle}>Use messages to agree the details</Text>
        <Text style={styles.guidanceBullet}>• Confirm the exact task, time, place, and any tools needed.</Text>
        <Text style={styles.guidanceBullet}>• Agree any payment directly before the job starts.</Text>
        <Text style={styles.guidanceBullet}>• Do not share sensitive personal or financial details.</Text>
        <Text style={styles.guidanceBullet}>• If a job is cancelled or completed, start a new agreement before doing anything else.</Text>
      </View>

      {conversationFeedback ? (
        <View style={styles.feedbackWrap}>
          <FeedbackNotice type={conversationFeedback.type} text={conversationFeedback.text} />
        </View>
      ) : null}

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
              {isReadOnly
                ? "This FEN chat closed before any messages were sent."
                : "Start with the task, time, place, and anything the other person should know."}
            </Text>
          </View>
        }
      />

      <View style={styles.inputRow}>
        {sendError ? <FeedbackNotice type={sendError.startsWith("Message sent") ? "warning" : "error"} text={sendError} /> : null}
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
    lineHeight: 23,
    fontWeight: "800",
    marginTop: 10,
  },
  headerSubtitle: {
    color: "#B56CFF",
    fontSize: 13,
    lineHeight: 18,
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
    maxWidth: "100%",
  },
  smallButtonText: {
    color: "#E7D9FF",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    textAlign: "center",
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
  guidancePanel: {
    backgroundColor: "#171024",
    borderBottomWidth: 1,
    borderBottomColor: "#231A33",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 5,
  },
  guidanceTitle: {
    color: "#E7D9FF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
  },
  guidanceBullet: {
    color: "#CBB8F1",
    fontSize: 12,
    lineHeight: 17,
  },
  feedbackWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  messageBubble: {
    maxWidth: "86%",
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
    flexWrap: "wrap",
    gap: 10,
  },
  sendError: {
    color: "#FFB0B0",
    fontSize: 13,
  },
  input: {
    flex: 1,
    minWidth: 190,
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
    minHeight: 42,
    minWidth: 84,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#140E1D",
    fontSize: 15,
    lineHeight: 19,
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
