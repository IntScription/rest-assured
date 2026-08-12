import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Program, ThemeType } from "../types";
import type { PlannedSplit } from "../lib/splitSchedule";
import {
  formatDisplayDate,
  getTodayDateString,
} from "../lib/calendarDates";

type Props = {
  t: ThemeType;
  selectedDate: string;
  activeProgram: Program | null;
  plannedSplit: PlannedSplit;
  completedDates: string[];
  loggedDates: string[];
};

export function TodaysMissionCard({
  t,
  selectedDate,
  activeProgram,
  plannedSplit,
  completedDates,
  loggedDates,
}: Props) {
  const isToday = selectedDate === getTodayDateString();
  const completed = completedDates.includes(selectedDate);
  const logged = loggedDates.includes(selectedDate);

  const status = completed
    ? "Completed"
    : logged
      ? "Logged"
      : plannedSplit.isRestDay
        ? "Recovery"
        : "Ready";

  const statusColor = completed
    ? t.success ?? "#30d158"
    : logged
      ? t.link
      : plannedSplit.isRestDay
        ? "#34c759"
        : t.link;

  return (
    <View style={[styles.card, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
      <View style={[styles.iconShell, { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}44` }]}>
        <Ionicons
          name={plannedSplit.isRestDay ? "leaf-outline" : "rocket-outline"}
          size={22}
          color={statusColor}
        />
      </View>

      <View style={styles.copy}>
        <Text style={[styles.kicker, { color: t.mutedText }]}>
          {isToday ? "Today's mission" : "Logging for"}
        </Text>

        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
          {activeProgram ? plannedSplit.splitName : "No active program"}
        </Text>

        <Text style={[styles.sub, { color: t.mutedText }]}>
          {formatDisplayDate(selectedDate)} • {status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconShell: {
    width: 48,
    height: 48,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 3,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sub: {
    marginTop: 3,
    fontSize: 12.5,
    fontWeight: "700",
  },
});
