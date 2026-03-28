import React, { useCallback, useMemo } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Split, ThemeType } from "../types";
import { getProgramAccent } from "../utils";

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

type TrainSplitRowProps = {
  item: Split;
  displayOrder: number;
  isActive: boolean;
  busy: boolean;
  t: ThemeType;
  onDrag: () => void;
  onEditItem: (item: Split) => void;
  onDeleteItem: (id: string, type: "program" | "split") => void;
};

const TrainSplitRow = React.memo(function TrainSplitRow({
  item,
  displayOrder,
  isActive,
  busy,
  t,
  onDrag,
  onEditItem,
  onDeleteItem,
}: TrainSplitRowProps) {
  const splitAccent = useMemo(() => getProgramAccent(displayOrder), [displayOrder]);
  const handleEdit = useCallback(() => onEditItem(item), [item, onEditItem]);
  const handleDelete = useCallback(() => onDeleteItem(item.id, "split"), [item.id, onDeleteItem]);

  return (
    <TouchableOpacity
      onLongPress={onDrag}
      delayLongPress={180}
      disabled={busy}
      activeOpacity={0.88}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 18,
        marginBottom: 6,
        backgroundColor: isActive ? t.cardAlt : t.card,
        borderWidth: 1,
        borderColor: isActive ? t.link : t.border,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 8 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: splitAccent.bg,
            marginRight: 10,
          }}
        >
          <Text style={{ color: splitAccent.text, fontWeight: "800", fontSize: 11.5 }}>
            {String(displayOrder + 1).padStart(2, "0")}
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={{ color: t.text, fontSize: 15, fontWeight: "700" }} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.cardAlt,
            borderWidth: 1,
            borderColor: t.border,
          }}
        >
          <Ionicons name="reorder-three-outline" size={16} color={t.mutedText} />
        </View>

        {IS_IOS ? (
          <InlineActions
            onEdit={handleEdit}
            onDelete={handleDelete}
            border={t.border}
            card={t.card}
            mutedText={t.mutedText}
          />
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

export default TrainSplitRow;
