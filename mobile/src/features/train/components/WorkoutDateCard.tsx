import { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Program, Split, ThemeType } from "../types";
import { formatDisplayDate, getTodayDateString } from "../lib/calendarDates";
import { WorkoutCalendarModal } from "./modals/WorkoutCalendarModal";

type PlannedSplit = {
  splitId: string | null;
  splitName: string;
  isRestDay: boolean;
};

type Props = {
  t: ThemeType;
  selectedDate: string;
  activeProgram: Program | null;
  splits: Split[];
  completedDates?: string[];
  loggedDates?: string[];
  plannedSplit: PlannedSplit;
  onDateChange: (date: string) => void;
};

function isDarkTheme(t: ThemeType) {
  const value = String(t?.background ?? "").replace("#", "");
  if (value.length !== 6) return false;

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  return luminance < 0.5;
}

function getDateStatus({
  selectedDate,
  today,
  completedDates,
  loggedDates,
}: {
  selectedDate: string;
  today: string;
  completedDates: string[];
  loggedDates: string[];
}) {
  if (completedDates.includes(selectedDate)) return "Completed";
  if (loggedDates.includes(selectedDate)) return "Logged";
  if (selectedDate === today) return "Today";
  if (selectedDate > today) return "Upcoming";
  return "Past date";
}

function getStatusIcon(status: string): keyof typeof Ionicons.glyphMap {
  if (status === "Completed") return "checkmark-circle";
  if (status === "Logged") return "reader-outline";
  if (status === "Today") return "sunny-outline";
  if (status === "Upcoming") return "calendar-outline";
  return "time-outline";
}

export function WorkoutDateCard({
  t,
  selectedDate,
  activeProgram,
  splits,
  completedDates = [],
  loggedDates = [],
  plannedSplit,
  onDateChange,
}: Props) {
  const [calendarVisible, setCalendarVisible] = useState(false);

  const today = getTodayDateString();
  const isDark = isDarkTheme(t);

  const status = useMemo(
    () =>
      getDateStatus({
        selectedDate,
        today,
        completedDates,
        loggedDates,
      }),
    [completedDates, loggedDates, selectedDate, today]
  );

  const statusColor = useMemo(() => {
    if (status === "Completed") return t.success ?? "#16A34A";
    if (status === "Logged") return t.link;
    if (status === "Today") return "#F59E0B";
    if (status === "Upcoming") return "#8B5CF6";
    return t.mutedText;
  }, [status, t.link, t.mutedText, t.success]);

  const planColor = plannedSplit.isRestDay ? "#38BDF8" : t.link;

  return (
    <>
      <View
        style={[
          viewStyles.card,
          {
            backgroundColor: t.card,
            borderColor: t.border,
            shadowColor: isDark ? "#000000" : "#64748B",
          },
        ]}
      >
        <View pointerEvents="none" style={viewStyles.decorLayer}>
          <View
            style={[
              viewStyles.glowOrb,
              viewStyles.glowTop,
              { backgroundColor: `${t.link}22` },
            ]}
          />

          <View
            style={[
              viewStyles.glowOrb,
              viewStyles.glowBottom,
              {
                backgroundColor: isDark
                  ? "rgba(16,185,129,0.12)"
                  : "rgba(16,185,129,0.08)",
              },
            ]}
          />
        </View>

        <View style={viewStyles.topRow}>
          <View
            style={[
              viewStyles.iconShell,
              {
                backgroundColor: `${t.link}16`,
                borderColor: `${t.link}35`,
              },
            ]}
          >
            <Ionicons name="calendar-outline" size={22} color={t.link} />
          </View>

          <View style={viewStyles.titleWrap}>
            <Text style={[textStyles.kicker, { color: t.mutedText }]}>Training date</Text>

            <Text style={[textStyles.title, { color: t.text }]} numberOfLines={1}>
              {formatDisplayDate(selectedDate)}
            </Text>
          </View>
        </View>

        <View style={viewStyles.infoGrid}>
          <View
            style={[
              viewStyles.infoChip,
              {
                backgroundColor: t.cardAlt,
                borderColor: t.border,
              },
            ]}
          >
            <View style={viewStyles.infoChipTop}>
              <Ionicons
                name={plannedSplit.isRestDay ? "moon-outline" : "barbell-outline"}
                size={14}
                color={planColor}
              />

              <Text style={[textStyles.infoLabel, { color: t.mutedText }]}>Planned</Text>
            </View>

            <Text style={[textStyles.infoValue, { color: planColor }]} numberOfLines={1}>
              {plannedSplit.splitName}
            </Text>
          </View>

          <View
            style={[
              viewStyles.infoChip,
              {
                backgroundColor: t.cardAlt,
                borderColor: t.border,
              },
            ]}
          >
            <View style={viewStyles.infoChipTop}>
              <Ionicons name={getStatusIcon(status)} size={14} color={statusColor} />

              <Text style={[textStyles.infoLabel, { color: t.mutedText }]}>Status</Text>
            </View>

            <Text style={[textStyles.infoValue, { color: statusColor }]} numberOfLines={1}>
              {status}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setCalendarVisible(true)}
          activeOpacity={0.88}
          style={[viewStyles.openCalendarButton, { backgroundColor: t.link }]}
        >
          <Ionicons name="calendar-number-outline" size={17} color="#FFFFFF" />

          <Text style={textStyles.openCalendarText}>Open calendar</Text>
        </TouchableOpacity>

        {!activeProgram ? (
          <Text style={[textStyles.helperText, { color: t.mutedText }]}>Create or activate a program to use split planning.</Text>
        ) : splits.length === 0 ? (
          <Text style={[textStyles.helperText, { color: t.mutedText }]}>Add splits to this program to see planned training days.</Text>
        ) : null}
      </View>

      <WorkoutCalendarModal
        visible={calendarVisible}
        t={t}
        selectedDate={selectedDate}
        activeProgram={activeProgram}
        splits={splits}
        completedDates={completedDates}
        loggedDates={loggedDates}
        onClose={() => setCalendarVisible(false)}
        onSelectDate={onDateChange}
      />
    </>
  );
}

const viewStyles = StyleSheet.create<Record<string, ViewStyle>>({
  card: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 26,
    padding: 15,
    overflow: "hidden",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },

  decorLayer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },

  glowOrb: {
    position: "absolute",
    borderRadius: 999,
  },

  glowTop: {
    width: 180,
    height: 180,
    top: -100,
    right: -70,
  },

  glowBottom: {
    width: 150,
    height: 150,
    bottom: -90,
    left: -70,
  },

  topRow: {
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

  titleWrap: {
    flex: 1,
    minWidth: 0,
  },

  infoGrid: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },

  infoChip: {
    flex: 1,
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    justifyContent: "space-between",
  },

  infoChipTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  openCalendarButton: {
    marginTop: 13,
    minHeight: 46,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});

const textStyles = StyleSheet.create<Record<string, TextStyle>>({
  kicker: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },

  title: {
    marginTop: 3,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  infoLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  infoValue: {
    marginTop: 9,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
  },

  openCalendarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  helperText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    textAlign: "center",
  },
});
