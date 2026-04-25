import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/src/theme/theme";

type Props = {
  title: string;
  children: React.ReactNode;
};

export default function CoachSectionCard({ title, children }: Props) {
  const t = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
});
