import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/src/theme/theme";

export default function CoachInsightCard({
  title,
  summary,
  accent,
}: {
  title: string;
  summary: string;
  accent?: string;
}) {
  const t = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View
        style={[
          styles.accent,
          { backgroundColor: accent ?? t.primaryBg },
        ]}
      />
      <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      <Text style={[styles.summary, { color: t.mutedText }]}>{summary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  accent: {
    width: 42,
    height: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
  },
});
