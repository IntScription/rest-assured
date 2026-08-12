import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { Program, Split, ThemeType } from "../types";
import { addDays, getTodayDateString, parseDateString } from "../lib/calendarDates";
import { getSplitForDate } from "../lib/splitSchedule";

type Props = {
  t: ThemeType;
  selectedDate: string;
  activeProgram: Program | null;
  splits: Split[];
  completedDates: string[];
  loggedDates: string[];
  skippedDates?: string[];
  onSelectDate: (date: string) => void;
};

export function UpcomingWeekStrip({
  t,
  selectedDate,
  activeProgram,
  splits,
  completedDates,
  loggedDates,
  skippedDates = [],
  onSelectDate,
}: Props) {
  const today = getTodayDateString();
  const anchorDate =
    activeProgram?.schedule_anchor_date ||
    activeProgram?.created_at?.slice(0, 10) ||
    today;

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const date = addDays(today, index);
      return {
        date,
        planned: getSplitForDate({ date, anchorDate, splits }),
      };
    });
  }, [anchorDate, splits, today]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: t.text }]}>Upcoming week</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {days.map((item) => {
          const date = parseDateString(item.date);
          const isSelected = selectedDate === item.date;
          const completed = completedDates.includes(item.date);
          const logged = loggedDates.includes(item.date);
          const skipped = skippedDates.includes(item.date);

          const tint = completed
            ? t.success ?? "#30d158"
            : skipped
              ? "#ff9f0a"
              : logged
                ? t.link
                : item.planned.isRestDay
                  ? "#34c759"
                  : t.mutedText;

          return (
            <TouchableOpacity
              key={item.date}
              onPress={() => onSelectDate(item.date)}
              activeOpacity={0.84}
              style={[
                styles.dayCard,
                {
                  backgroundColor: isSelected ? `${t.link}18` : t.cardAlt,
                  borderColor: isSelected ? t.link : t.border,
                },
              ]}
            >
              <Text style={[styles.dow, { color: t.mutedText }]}>
                {date.toLocaleDateString(undefined, { weekday: "short" })}
              </Text>

              <Text style={[styles.num, { color: t.text }]}>
                {date.getDate()}
              </Text>

              <Text style={[styles.split, { color: tint }]} numberOfLines={1}>
                {item.planned.splitName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
  },
  heading: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "900",
  },
  row: {
    gap: 8,
    paddingRight: 2,
  },
  dayCard: {
    width: 86,
    minHeight: 94,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
  },
  dow: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  num: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "900",
  },
  split: {
    marginTop: 5,
    fontSize: 11.5,
    fontWeight: "800",
    maxWidth: "100%",
  },
});
