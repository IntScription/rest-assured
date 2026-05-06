import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SuggestionAction, ThemeLike } from "../types";
import type { CoachNextSetInsight } from "../utils/coachNextSetInsight";

type Props = {
  t: ThemeLike;
  insight: CoachNextSetInsight;
  suggestionActions: SuggestionAction[];
  currentVolume: number;
  lastLabel: string;
  bestLabel: string;
};

export default function SmartNextSetCard({
  t,
  insight,
  suggestionActions,
  currentVolume,
  lastLabel,
  bestLabel,
}: Props) {
  const toneColor = useMemo(() => {
    if (insight.tone === "push") return t.success ?? "#10B981";
    if (insight.tone === "caution") return t.danger ?? "#EF4444";
    if (insight.tone === "hold") return "#F59E0B";
    return t.link;
  }, [insight.tone, t.danger, t.link, t.success]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.cardAlt,
          borderColor: toneColor,
          shadowColor: toneColor,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrap, { backgroundColor: t.card, borderColor: t.border }]}>
            <Ionicons name="sparkles-outline" size={17} color={toneColor} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: t.mutedText }]}>Coach insight</Text>
            <Text style={[styles.title, { color: t.text }]}>{insight.title}</Text>
          </View>
        </View>

        <View style={[styles.volumeChip, { backgroundColor: t.card, borderColor: t.border }]}> 
          <Text style={[styles.volumeText, { color: t.text }]}>Vol {currentVolume}</Text>
        </View>
      </View>

      <Text style={[styles.body, { color: t.mutedText }]}>{insight.body}</Text>

      <View style={styles.snapshotRow}>
        <View style={[styles.snapshotCell, { backgroundColor: t.card, borderColor: t.border }]}> 
          <Text style={[styles.snapshotLabel, { color: t.mutedText }]}>Last</Text>
          <Text style={[styles.snapshotValue, { color: t.text }]} numberOfLines={1}>{lastLabel}</Text>
        </View>

        <View style={[styles.snapshotCell, { backgroundColor: t.card, borderColor: t.border }]}> 
          <Text style={[styles.snapshotLabel, { color: t.mutedText }]}>Best</Text>
          <Text style={[styles.snapshotValue, { color: t.text }]} numberOfLines={1}>{bestLabel}</Text>
        </View>
      </View>

      {suggestionActions.length > 0 ? (
        <View style={styles.suggestionRow}>
          {suggestionActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              onPress={action.apply}
              activeOpacity={0.85}
              style={[styles.suggestionChip, { backgroundColor: t.card, borderColor: t.border }]}
            >
              <Ionicons name={action.icon} size={14} color={t.text} />
              <Text style={[styles.suggestionChipText, { color: t.text }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <Text style={[styles.disclaimer, { color: t.mutedText }]}>{insight.disclaimer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 22,
    padding: 13,
    shadowOpacity: 0.11,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 19,
  },
  volumeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  volumeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  body: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  snapshotRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  snapshotCell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
  },
  snapshotLabel: {
    fontSize: 11,
    fontWeight: "800",
  },
  snapshotValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "900",
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  suggestionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  disclaimer: {
    marginTop: 10,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
    opacity: 0.88,
  },
});
