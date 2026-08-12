import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { ThemeType } from "../types";
import type { PlannedSplit } from "../lib/splitSchedule";
import { isPastDate } from "../lib/calendarDates";

type Props = {
  t: ThemeType;
  selectedDate: string;
  plannedSplit: PlannedSplit;
  completedDates: string[];
  loggedDates: string[];
  onKeepSchedule: () => void;
  onShiftCycle: () => void;
  onMarkSkipped: () => void;
};

export function MissedWorkoutPrompt({
  t,
  selectedDate,
  plannedSplit,
  completedDates,
  loggedDates,
  onKeepSchedule,
  onShiftCycle,
  onMarkSkipped,
}: Props) {
  const missed =
    isPastDate(selectedDate) &&
    !plannedSplit.isRestDay &&
    !completedDates.includes(selectedDate) &&
    !loggedDates.includes(selectedDate);

  if (!missed) return null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: "rgba(255,159,10,0.12)",
          borderColor: "rgba(255,159,10,0.28)",
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Ionicons name="warning-outline" size={18} color="#ff9f0a" />
        <Text style={[styles.title, { color: t.text }]}>
          Missed {plannedSplit.splitName}
        </Text>
      </View>

      <Text style={[styles.body, { color: t.mutedText }]}>
        This planned workout passed without logs. Keep the schedule, shift your cycle, or mark it skipped.
      </Text>

      <View style={styles.actions}>
        <Action label="Keep" onPress={onKeepSchedule} t={t} />
        <Action label="Shift" onPress={onShiftCycle} t={t} primary />
        <Action label="Skip" onPress={onMarkSkipped} t={t} />
      </View>
    </View>
  );
}

function Action({
  label,
  onPress,
  t,
  primary,
}: {
  label: string;
  onPress: () => void;
  t: ThemeType;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.action,
        {
          backgroundColor: primary ? t.link : t.cardAlt,
          borderColor: primary ? t.link : t.border,
        },
      ]}
    >
      <Text style={[styles.actionText, { color: primary ? "#fff" : t.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  title: {
    fontSize: 15,
    fontWeight: "900",
  },
  body: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
  },
  actions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  action: {
    flex: 1,
    minHeight: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "900",
  },
});
