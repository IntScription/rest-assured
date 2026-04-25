"use client";

import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { buildCoachAskContext } from "@/src/features/coach/lib/coach-queries";
import { askCoach } from "@/src/features/coach/api/askCoach";
import { useLocalCoach } from "@/src/features/coach/hooks/useLocalCoach";
import {
  getCoachDisplayLabel,
  getCoachRuntimeMode,
} from "@/src/features/coach/services/coach-runtime";
import CoachBackHeader from "@/src/features/coach/components/CoachBackHeader";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  message: string;
  created_at: string;
};

const QUICK_PROMPTS = [
  "Am I ready for a heavy session today?",
  "What should I do for pull day tomorrow?",
  "How should I adjust training this week?",
  "What is my biggest recovery weakness right now?",
];

export default function AskCoachScreen() {
  const t = useAppTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const localCoach = useLocalCoach();
  const runtimeMode = getCoachRuntimeMode();

  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      if (!active) return;
      setUserId(uid);

      if (!uid) {
        setLoading(false);
        return;
      }

      const { data: rows, error } = await supabase
        .from("coach_conversations")
        .select("id, role, message, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (error) setMessages([]);
      else setMessages((rows as Message[]) ?? []);

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const canUseLocal =
    runtimeMode === "local_ai" || (runtimeMode === "auto" && localCoach.isAvailable);

  const canUseHosted =
    runtimeMode === "hosted_ai" || runtimeMode === "auto";

  const modeLabel = useMemo(
    () => getCoachDisplayLabel({ canUseLocal, canUseHosted }),
    [canUseLocal, canUseHosted]
  );

  const handleSend = async (forcedPrompt?: string) => {
    if (!userId || sending) return;

    const userText = (forcedPrompt ?? input).trim();
    if (!userText) return;

    try {
      setSending(true);
      setInput("");

      const optimisticUser: Message = {
        id: `local-user-${Date.now()}`,
        role: "user",
        message: userText,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticUser]);

      await supabase.from("coach_conversations").insert({
        user_id: userId,
        role: "user",
        message: userText,
        context: {},
      });

      const context = await buildCoachAskContext(userId);

      if (canUseLocal) {
        try {
          const result = await localCoach.askLocalCoach(userText, context);

          const { data: insertedAssistant, error } = await supabase
            .from("coach_conversations")
            .insert({
              user_id: userId,
              role: "assistant",
              message: result.message,
              context: {
                source: "local",
                model: result.model,
              },
            })
            .select("id, role, message, created_at")
            .single();

          if (error) throw error;

          setMessages((prev) => [
            ...prev,
            {
              id: insertedAssistant.id,
              role: insertedAssistant.role,
              message: insertedAssistant.message,
              created_at: insertedAssistant.created_at,
            },
          ]);

          return;
        } catch (localError) {
          if (!canUseHosted) {
            throw localError;
          }
        }
      }

      if (canUseHosted) {
        const assistantRow = await askCoach(userId, userText);

        setMessages((prev) => [
          ...prev,
          {
            id: assistantRow.id,
            role: assistantRow.role,
            message: assistantRow.message,
            created_at: assistantRow.created_at,
          },
        ]);

        return;
      }

      Alert.alert(
        "AI unavailable",
        "Neither on-device AI nor cloud AI is available right now."
      );
    } catch (error: any) {
      Alert.alert("Ask Coach failed", String(error?.message ?? "Something went wrong."));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: t.background }]}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <CoachBackHeader
            title="Ask Coach"
            subtitle="Ask about training, recovery, or performance."
            t={t}
          />
        </View>

        <View
          style={[
            styles.headerCard,
            {
              backgroundColor: t.cardAlt,
              borderColor: t.border,
            },
          ]}
        >
          <View
            style={[
              styles.modePill,
              {
                backgroundColor: t.card,
                borderColor: t.border,
              },
            ]}
          >
            <View
              style={[
                styles.modeDot,
                {
                  backgroundColor: canUseLocal
                    ? "#22c55e"
                    : canUseHosted
                      ? "#3b82f6"
                      : "#94a3b8",
                },
              ]}
            />
            <Text style={[styles.modeText, { color: t.text }]}>
              {modeLabel}
            </Text>
          </View>
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: t.card,
                  borderColor: t.border,
                },
              ]}
            >
              <Text style={[styles.emptyTitle, { color: t.text }]}>
                Start a conversation
              </Text>
              <Text style={[styles.emptyText, { color: t.mutedText }]}>
                Coach already knows your profile, recovery, insights, and recent training context.
              </Text>

              <View style={styles.promptWrap}>
                {QUICK_PROMPTS.map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    style={[
                      styles.promptChip,
                      {
                        backgroundColor: t.cardAlt,
                        borderColor: t.border,
                      },
                    ]}
                    onPress={() => handleSend(prompt)}
                    disabled={sending}
                  >
                    <Text style={[styles.promptChipText, { color: t.text }]}>
                      {prompt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isUser = item.role === "user";

              return (
                <View
                  style={[
                    styles.messageBubble,
                    {
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      backgroundColor: isUser ? t.primaryBg : t.card,
                      borderColor: isUser ? t.primaryBg : t.border,
                    },
                  ]}
                >
                  <View style={styles.messageHeader}>
                    <Text
                      style={[
                        styles.messageRole,
                        {
                          color: isUser ? t.primaryText : t.mutedText,
                        },
                      ]}
                    >
                      {isUser ? "You" : "Coach"}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.messageText,
                      {
                        color: isUser ? t.primaryText : t.text,
                      },
                    ]}
                  >
                    {item.message}
                  </Text>
                </View>
              );
            }}
            ListFooterComponent={
              sending ? (
                <View
                  style={[
                    styles.typingBubble,
                    {
                      backgroundColor: t.card,
                      borderColor: t.border,
                    },
                  ]}
                >
                  <Text style={[styles.typingText, { color: t.mutedText }]}>
                    Coach is thinking...
                  </Text>
                </View>
              ) : null
            }
          />
        )}

        <View
          style={[
            styles.inputBar,
            {
              borderTopColor: t.border,
              backgroundColor: t.background,
            },
          ]}
        >
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: t.card,
                borderColor: t.border,
              },
            ]}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask Coach something..."
              placeholderTextColor={t.mutedText}
              style={[
                styles.input,
                {
                  color: t.text,
                },
              ]}
              multiline
            />
          </View>

          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={sending || !input.trim()}
            style={[
              styles.sendButton,
              {
                backgroundColor: t.primaryBg,
                opacity: sending || !input.trim() ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-up" size={18} color={t.primaryText} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  headerCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  modePill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  modeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  emptyWrap: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  promptWrap: {
    gap: 10,
  },
  promptChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  promptChipText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: "84%",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageHeader: {
    marginBottom: 6,
  },
  messageRole: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
  },
  typingBubble: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 6,
  },
  typingText: {
    fontSize: 13,
    fontWeight: "600",
  },

  inputBar: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  inputWrap: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  input: {
    minHeight: 44,
    maxHeight: 120,
    fontSize: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
