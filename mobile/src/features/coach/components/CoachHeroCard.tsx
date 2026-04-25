import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/src/theme/theme";

type Props = {
  title: string;
  subtitle: string;
};

export default function CoachHeroCard({ title, subtitle }: Props) {
  const t = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
      <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: t.mutedText }]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
