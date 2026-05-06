import { memo, useCallback } from "react";
import {
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Program, ThemeType } from "../types";
import { getProgramAccent, getProgramInitials } from "../utils";

type Props = {
  program: Program;
  isActive: boolean;
  splitCount: number;
  busy: boolean;
  t: ThemeType;
  onPress: () => void;
  onManage: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isImported?: boolean;
  importedByUsername?: string | null;
};

function stopThen(event: GestureResponderEvent, action: () => void) {
  event.stopPropagation?.();
  action();
}

function TrainProgramCard({
  program,
  isActive,
  splitCount,
  busy,
  t,
  onPress,
  onManage,
  onShare,
  onEdit,
  onDelete,
  isImported = false,
  importedByUsername,
}: Props) {
  const accent = getProgramAccent(program.id);

  const handleManage = useCallback(
    (event: GestureResponderEvent) => stopThen(event, onManage),
    [onManage]
  );

  const handleShare = useCallback(
    (event: GestureResponderEvent) => stopThen(event, onShare),
    [onShare]
  );

  const handleEdit = useCallback(
    (event: GestureResponderEvent) => stopThen(event, onEdit),
    [onEdit]
  );

  const handleDelete = useCallback(
    (event: GestureResponderEvent) => stopThen(event, onDelete),
    [onDelete]
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.9}
      style={[
        styles.card,
        {
          backgroundColor: isActive ? t.cardAlt : t.background,
          borderColor: isActive ? t.link : t.border,
          opacity: busy ? 0.78 : 1,
        },
      ]}
    >
      <View style={styles.left}>
        <View style={[styles.avatar, { backgroundColor: accent.bg }]}>
          <Text style={[styles.avatarText, { color: accent.text }]}>
            {getProgramInitials(program.name)}
          </Text>
        </View>

        <View style={styles.copy}>
          <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
            {program.name}
          </Text>

          <Text style={[styles.meta, { color: t.mutedText }]}>
            {isActive ? "Currently selected" : "Tap to select"}
          </Text>

          <Text style={[styles.meta, { color: t.mutedText }]} numberOfLines={1}>
            {splitCount} {splitCount === 1 ? "split" : "splits"}
            {isImported
              ? ` · imported${importedByUsername ? ` from @${importedByUsername}` : ""}`
              : ""}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleManage}
          disabled={busy}
          hitSlop={10}
          activeOpacity={0.75}
          style={[
            styles.iconButton,
            styles.manageButton,
            { borderColor: t.border, backgroundColor: t.card },
          ]}
        >
          <Ionicons name="layers-outline" size={17} color={t.mutedText} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleShare}
          disabled={busy}
          hitSlop={10}
          activeOpacity={0.75}
          style={[styles.iconButton, { borderColor: t.border, backgroundColor: t.card }]}
        >
          <Ionicons name="share-social-outline" size={16} color={t.mutedText} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleEdit}
          disabled={busy}
          hitSlop={10}
          activeOpacity={0.75}
          style={[styles.iconButton, { borderColor: t.border, backgroundColor: t.card }]}
        >
          <Ionicons name="create-outline" size={16} color={t.mutedText} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDelete}
          disabled={busy}
          hitSlop={10}
          activeOpacity={0.75}
          style={[styles.iconButton, { borderColor: t.border, backgroundColor: t.card }]}
        >
          <Ionicons name="trash-outline" size={16} color="#ff453a" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default memo(TrainProgramCard);

const styles = StyleSheet.create({
  card: {
    width: "100%",
    alignSelf: "stretch",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontWeight: "900",
    fontSize: 13,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
  },
  meta: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 10,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  manageButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
});
