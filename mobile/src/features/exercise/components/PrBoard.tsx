import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DASHBOARD_CELL_WIDTH } from "../constants";
import type { RecordShortcut, ThemeLike } from "../types";

type Props = {
  t: ThemeLike;
  items: RecordShortcut[];
  onPressRecord: (logId: string | null) => void;
};

export default function PrBoard({ t, items, onPressRecord }: Props) {
  return (
    <View style={[styles.prBoardCard, { backgroundColor: t.card, borderColor: t.border }]}> 
      <View style={styles.prBoardHeader}>
        <View>
          <Text style={[styles.prBoardEyebrow, { color: t.mutedText }]}>PR Board</Text>
          <Text style={[styles.prBoardTitle, { color: t.text }]}>Current records</Text>
        </View>
        <Ionicons name="trophy-outline" size={18} color={t.text} />
      </View>

      <View style={styles.prBoardGrid}>
        {items.map((record) => (
          <TouchableOpacity
            key={record.key}
            onPress={() => onPressRecord(record.logId)}
            activeOpacity={0.88}
            style={[styles.prBoardItem, { backgroundColor: t.cardAlt, borderColor: t.border }]}
          >
            <View style={styles.prBoardItemTop}>
              <View style={[styles.prBoardDot, { backgroundColor: record.accent }]} />
              <Text style={[styles.prBoardLabel, { color: t.mutedText }]}>{record.label}</Text>
            </View>
            <Text style={[styles.prBoardValue, { color: t.text }]} numberOfLines={2}>
              {record.value}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prBoardCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  prBoardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  prBoardEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 3,
  },
  prBoardTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.25,
  },
  prBoardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  prBoardItem: {
    width: DASHBOARD_CELL_WIDTH,
    minHeight: 94,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    justifyContent: "space-between",
  },
  prBoardItemTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  prBoardDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  prBoardLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  prBoardValue: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },
});
