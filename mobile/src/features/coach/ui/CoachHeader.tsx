import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/src/theme/theme";

export default function CoachHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const t = useAppTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: t.mutedText }]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
