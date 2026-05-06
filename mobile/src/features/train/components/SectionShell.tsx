import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeType } from "../types";

export function SectionShell({
  children,
  t,
  padding = 18,
}: {
  children: React.ReactNode;
  t: ThemeType;
  padding?: number;
}) {
  return (
    <View
      style={[
        styles.shell,
        {
          borderColor: t.border,
          backgroundColor: t.card,
          padding,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  t,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  t: ThemeType;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={[styles.headerKicker, { color: t.text }]}>{title}</Text>

        {!!subtitle && (
          <Text style={[styles.headerTitle, { color: t.text }]}>{subtitle}</Text>
        )}
      </View>

      {action}
    </View>
  );
}

export function EmptyStateCard({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  t,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  t: ThemeType;
}) {
  return (
    <View
      style={[
        styles.emptyCard,
        {
          backgroundColor: t.cardAlt,
          borderColor: t.border,
        },
      ]}
    >
      <View
        style={[
          styles.emptyIcon,
          {
            backgroundColor: t.card,
            borderColor: t.border,
          },
        ]}
      >
        <Ionicons name={icon} size={24} color={t.mutedText} />
      </View>

      <Text style={[styles.emptyTitle, { color: t.text }]}>{title}</Text>

      <Text style={[styles.emptyMessage, { color: t.mutedText }]}>{message}</Text>

      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.85}
          style={[styles.emptyAction, { backgroundColor: t.link }]}
        >
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: "100%",
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: 28,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  headerKicker: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    opacity: 0.72,
    marginBottom: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.45,
    lineHeight: 30,
  },
  emptyCard: {
    width: "100%",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  emptyMessage: {
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyAction: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  emptyActionText: {
    color: "white",
    fontWeight: "800",
  },
});
