import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type CoachBackHeaderProps = {
  title: string;
  subtitle?: string;
  t: any;
};

export default function CoachBackHeader({
  title,
  subtitle,
  t,
}: CoachBackHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[
          styles.backButton,
          {
            backgroundColor: t.card,
            borderColor: t.border,
          },
        ]}
        onPress={() => router.replace("/coach")}
      >
        <Ionicons name="chevron-back" size={18} color={t.text} />
        <Text style={[styles.backText, { color: t.text }]}>Coach</Text>
      </TouchableOpacity>

      <View style={styles.titleWrap}>
        <Text style={[styles.title, { color: t.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: t.mutedText }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  backText: {
    fontSize: 13,
    fontWeight: "700",
  },
  titleWrap: {
    gap: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
