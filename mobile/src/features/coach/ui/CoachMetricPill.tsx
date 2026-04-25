import { Text, View, StyleSheet } from "react-native";
import { useAppTheme } from "@/src/theme/theme";

export default function CoachMetricPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const t = useAppTheme();

  return (
    <View style={[styles.pill, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
      <Text style={[styles.label, { color: t.mutedText }]}>{label}</Text>
      <Text style={[styles.value, { color: t.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 88,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: "800",
  },
});
