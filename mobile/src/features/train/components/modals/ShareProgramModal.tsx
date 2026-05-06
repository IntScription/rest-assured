import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

import { supabase } from "@/src/lib/supabase";
import FancyModalShell from "../FancyModalShell";
import type { Program, ThemeType } from "../../types";

type SearchStatus = "idle" | "searching" | "found" | "not_found";

type Props = {
  visible: boolean;
  program: Program | null;
  userId: string | null;
  profileUsername?: string | null;
  t: ThemeType;
  onClose: () => void;
  onSuccess: (target?: any) => void;
};

function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

export function ShareProgramModal({
  visible,
  program,
  userId,
  profileUsername,
  t,
  onClose,
  onSuccess,
}: Props) {
  const [shareUsername, setShareUsername] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareSearchStatus, setShareSearchStatus] = useState<SearchStatus>("idle");
  const [sharePreviewTarget, setSharePreviewTarget] = useState<any | null>(null);

  const searchReqId = useRef(0);

  useEffect(() => {
    if (!visible) {
      setShareUsername("");
      setShareBusy(false);
      setShareMessage(null);
      setShareSearchStatus("idle");
      setSharePreviewTarget(null);
      searchReqId.current += 1;
    }
  }, [visible]);

  useEffect(() => {
    const clean = normalizeUsername(shareUsername);

    if (!visible || !clean) {
      setShareSearchStatus("idle");
      setShareMessage(null);
      setSharePreviewTarget(null);
      return;
    }

    const reqId = ++searchReqId.current;
    setShareSearchStatus("searching");
    setShareMessage(null);
    setSharePreviewTarget(null);

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("search_profiles_by_username", { q: clean });

        if (reqId !== searchReqId.current) return;
        if (error) throw error;

        const exact = (data ?? []).find((item: any) => item.username === clean);

        if (!exact) {
          setShareSearchStatus("not_found");
          setShareMessage("Username does not exist.");
          return;
        }

        if (exact.id === userId) {
          setShareSearchStatus("not_found");
          setShareMessage("Cannot share with yourself.");
          return;
        }

        setShareSearchStatus("found");
        setShareMessage(
          exact.display_name
            ? `Found @${exact.username} · ${exact.display_name}`
            : `Found @${exact.username}`
        );
        setSharePreviewTarget(exact);
      } catch {
        if (reqId !== searchReqId.current) return;

        setShareSearchStatus("not_found");
        setShareMessage("Could not verify username.");
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [shareUsername, userId, visible]);

  const canShare =
    !!userId &&
    !!program &&
    !!profileUsername &&
    !!sharePreviewTarget &&
    shareSearchStatus === "found" &&
    !shareBusy;

  const close = useCallback(() => {
    if (shareBusy) return;
    onClose();
  }, [onClose, shareBusy]);

  const sendShare = useCallback(async () => {
    if (!canShare || !userId || !program || !profileUsername || !sharePreviewTarget) return;

    try {
      setShareBusy(true);

      const { error } = await supabase.from("program_shares").insert([
        {
          program_id: program.id,
          shared_by_user_id: userId,
          shared_with_user_id: sharePreviewTarget.id,
          status: "pending",
          program_name_snapshot: program.name,
          shared_by_username_snapshot: profileUsername,
        },
      ]);

      if (error) throw error;

      onSuccess(sharePreviewTarget);
      Toast.show({
        type: "success",
        text1: "Program shared",
        text2: `Sent to @${sharePreviewTarget.username}`,
      });
      onClose();
    } catch (error: any) {
      const message = String(error?.message ?? "Could not share program");
      setShareSearchStatus("not_found");
      setShareMessage(
        message.toLowerCase().includes("duplicate")
          ? "A pending request already exists."
          : message
      );
    } finally {
      setShareBusy(false);
    }
  }, [canShare, onClose, onSuccess, profileUsername, program, sharePreviewTarget, userId]);

  const inputBorder =
    shareSearchStatus === "found"
      ? "#30d158"
      : shareSearchStatus === "not_found"
        ? "#ff453a"
        : t.inputBorder;

  return (
    <FancyModalShell
      visible={visible}
      onClose={close}
      title="Share program"
      subtitle={program?.name ?? "Share a program"}
      t={t}
      enableSwipeDismiss={!shareBusy}
      swipeDismissArea="sheet"
      showCloseButton={false}
      sheetMaxHeight="48%"
      contentStyle={styles.content}
      footer={
        <TouchableOpacity
          onPress={sendShare}
          disabled={!canShare}
          activeOpacity={0.88}
          style={[
            styles.shareButton,
            {
              backgroundColor: t.link,
              opacity: canShare ? 1 : 0.5,
            },
          ]}
        >
          {shareBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="share-social-outline" size={17} color="white" />
              <Text style={styles.shareButtonText}>Share</Text>
            </>
          )}
        </TouchableOpacity>
      }
    >
      <TextInput
        value={shareUsername}
        onChangeText={setShareUsername}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        editable={!shareBusy}
        placeholder="@username"
        placeholderTextColor={t.mutedText}
        style={[
          styles.input,
          {
            borderColor: inputBorder,
            backgroundColor: t.inputBg,
            color: t.text,
          },
        ]}
      />

      <View style={styles.messageWrap}>
        {shareSearchStatus === "searching" ? (
          <View style={styles.messageRow}>
            <ActivityIndicator size="small" color={t.text} />
            <Text style={[styles.messageText, { color: t.mutedText }]}>Checking...</Text>
          </View>
        ) : shareMessage ? (
          <View style={styles.messageRow}>
            <Ionicons
              name={shareSearchStatus === "found" ? "checkmark-circle" : "close-circle"}
              size={16}
              color={shareSearchStatus === "found" ? "#30d158" : "#ff453a"}
            />
            <Text
              style={[
                styles.messageText,
                { color: shareSearchStatus === "found" ? "#30d158" : "#ff453a" },
              ]}
              numberOfLines={2}
            >
              {shareMessage}
            </Text>
          </View>
        ) : (
          <Text style={[styles.messageText, { color: t.mutedText }]}>Type exact username.</Text>
        )}
      </View>

      {!profileUsername ? (
        <View style={[styles.warningCard, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
          <Text style={[styles.warningText, { color: t.mutedText }]}>
            Set username in Profile before sharing.
          </Text>
        </View>
      ) : null}
    </FancyModalShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 0,
  },
  input: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    fontWeight: "700",
  },
  messageWrap: {
    minHeight: 24,
    marginTop: 8,
    justifyContent: "center",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  messageText: {
    flex: 1,
    fontWeight: "700",
    lineHeight: 17,
    fontSize: 12.5,
  },
  warningCard: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
  },
  warningText: {
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 17,
  },
  shareButton: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    marginBottom: 2,
  },
  shareButtonText: {
    color: "white",
    fontWeight: "900",
    fontSize: 15,
  },
});
