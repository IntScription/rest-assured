import React from "react";
import { Text, TouchableOpacity, View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Program, ThemeType } from "../types";
import { getProgramAccent, getProgramInitials } from "../utils";

const IS_IOS = Platform.OS === "ios";

function InlineActions({
  onEdit,
  onDelete,
  border,
  card,
  mutedText,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  border: string;
  card: string;
  mutedText: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginLeft: 10,
      }}
    >
      {onEdit ? (
        <TouchableOpacity
          onPress={onEdit}
          hitSlop={10}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: border,
            backgroundColor: card,
          }}
        >
          <Ionicons name="create-outline" size={16} color={mutedText} />
        </TouchableOpacity>
      ) : null}

      {onDelete ? (
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={10}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: border,
            backgroundColor: card,
          }}
        >
          <Ionicons name="trash-outline" size={16} color="#ff453a" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function TrainProgramCard({
  program,
  isActive,
  splitCount,
  busy,
  t,
  onPress,
  onEdit,
  onDelete,
}: {
  program: Program;
  isActive: boolean;
  splitCount: number;
  busy: boolean;
  t: ThemeType;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accent = getProgramAccent(program.id);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.88}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: 20,
        backgroundColor: isActive ? t.cardAlt : t.background,
        borderWidth: 1.2,
        borderColor: isActive ? "rgba(10,132,255,0.45)" : t.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        shadowColor: "#000",
        shadowOpacity: IS_IOS ? (isActive ? 0.12 : 0.05) : 0,
        shadowRadius: isActive ? 18 : 10,
        shadowOffset: { width: 0, height: isActive ? 10 : 6 },
        elevation: isActive ? 3 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 8 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: accent.bg,
            marginRight: 12,
          }}
        >
          <Text style={{ color: accent.text, fontWeight: "800", fontSize: 13 }}>
            {getProgramInitials(program.name)}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
            {program.name}
          </Text>

          <Text style={{ color: t.mutedText, marginTop: 5, fontSize: 12.5 }}>
            {isActive ? "Currently selected" : "Tap to select"}
          </Text>

          <Text style={{ color: t.mutedText, marginTop: 4, fontSize: 12.5 }}>
            {splitCount} {splitCount === 1 ? "split" : "splits"}
          </Text>
        </View>
      </View>

      {IS_IOS ? (
        <InlineActions
          onEdit={onEdit}
          onDelete={onDelete}
          border={t.border}
          card={t.card}
          mutedText={t.mutedText}
        />
      ) : null}
    </TouchableOpacity>
  );
}
