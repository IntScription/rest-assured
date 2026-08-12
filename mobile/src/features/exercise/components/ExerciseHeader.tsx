import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PR_COLORS } from "../constants";
import { getHeaderTitle } from "../utils/formatters";
import type { ThemeLike } from "../types";

type Props = {
  t: ThemeLike;
  exerciseName: string;
  splitName: string | null;
  restSecondsLeft: number;
  statusIcon: keyof typeof Ionicons.glyphMap;
  statusLabel: string;
  onBack: () => void;
};

function ExerciseHeader({
  t,
  exerciseName,
  splitName,
  restSecondsLeft,
  statusIcon,
  statusLabel,
  onBack,
}: Props) {
  const activeColor = restSecondsLeft > 0 ? PR_COLORS.recent : t.text;

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [
          styles.backBtn,
          { backgroundColor: t.card, borderColor: t.border },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="chevron-back" size={18} color={t.text} />
      </Pressable>

      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, { color: t.text }]} numberOfLines={1}>
          {getHeaderTitle(exerciseName)}
        </Text>
        {splitName ? (
          <Text style={[styles.headerSubtitle, { color: t.mutedText }]} numberOfLines={1}>
            {splitName}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.headerStatusChip,
          {
            backgroundColor: t.card,
            borderColor: restSecondsLeft > 0 ? PR_COLORS.recent : t.border,
          },
        ]}
      >
        <Ionicons name={statusIcon} size={14} color={activeColor} />
        <Text numberOfLines={1} style={[styles.headerStatusText, { color: activeColor }]}> 
          {statusLabel}
        </Text>
      </View>
    </View>
  );
}

export default memo(ExerciseHeader);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    marginBottom: 10,
    minHeight: 52,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
  },
  headerStatusChip: {
    minWidth: 74,
    maxWidth: 96,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 9,
  },
  headerStatusText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
