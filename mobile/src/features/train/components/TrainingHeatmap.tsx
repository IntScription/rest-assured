import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { ThemeType } from "../types";
import { addDays, getTodayDateString } from "../lib/calendarDates";

type Props = {
  t: ThemeType;
  completedDates: string[];
  loggedDates: string[];
  missedDates?: string[];
  skippedDates?: string[];
  prDates?: string[];
  onSelectDate?: (date: string) => void;
};

export function TrainingHeatmap({
  t,
  completedDates,
  loggedDates,
  missedDates = [],
  skippedDates = [],
  prDates = [],
  onSelectDate,
}: Props) {
  const today = getTodayDateString();

  const days = useMemo(() => {
    return Array.from({ length: 35 }).map((_, index) => addDays(today, index - 34));
  }, [today]);

  const completedSet = new Set(completedDates);
  const loggedSet = new Set(loggedDates);
  const missedSet = new Set(missedDates);
  const skippedSet = new Set(skippedDates);
  const prSet = new Set(prDates);

  function colorFor(date: string) {
    if (prSet.has(date)) return "#a855f7";
    if (completedSet.has(date)) return "#30d158";
    if (loggedSet.has(date)) return t.link;
    if (missedSet.has(date) || skippedSet.has(date)) return "#ff9f0a";
    return `${t.mutedText}35`;
  }

  return (
    <View style={[styles.card, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: t.text }]}>Training heatmap</Text>
        <Text style={[styles.sub, { color: t.mutedText }]}>Last 35 days</Text>
      </View>

      <View style={styles.grid}>
        {days.map((date) => (
          <TouchableOpacity
            key={date}
            disabled={!onSelectDate}
            onPress={() => onSelectDate?.(date)}
            activeOpacity={0.8}
            style={[styles.dot, { backgroundColor: colorFor(date) }]}
          />
        ))}
      </View>

      <View style={styles.legend}>
        <Legend color="#30d158" label="Done" t={t} />
        <Legend color={t.link} label="Logged" t={t} />
        <Legend color="#a855f7" label="PR" t={t} />
        <Legend color="#ff9f0a" label="Missed" t={t} />
      </View>
    </View>
  );
}

function Legend({ color, label, t }: { color: string; label: string; t: ThemeType }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: t.mutedText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "900",
  },
  sub: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 4,
  },
  legend: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "800",
  },
});
