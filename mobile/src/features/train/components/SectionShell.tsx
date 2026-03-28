import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
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
      style={{
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.card,
        borderRadius: 28,
        padding,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      }}
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
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 14,
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text
          style={{
            color: t.text,
            fontSize: 13,
            fontWeight: "800",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            opacity: 0.72,
            marginBottom: 5,
          }}
        >
          {title}
        </Text>

        {!!subtitle && (
          <Text
            style={{
              color: t.text,
              fontSize: 24,
              fontWeight: "800",
              letterSpacing: -0.45,
              lineHeight: 30,
            }}
          >
            {subtitle}
          </Text>
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
      style={{
        backgroundColor: t.cardAlt,
        borderRadius: 20,
        paddingHorizontal: 18,
        paddingVertical: 18,
        alignItems: "center",
        borderWidth: 1,
        borderColor: t.border,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: t.card,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
          borderWidth: 1,
          borderColor: t.border,
        }}
      >
        <Ionicons name={icon} size={24} color={t.mutedText} />
      </View>

      <Text style={{ color: t.text, fontSize: 16, fontWeight: "800" }}>{title}</Text>

      <Text style={{ color: t.mutedText, marginTop: 6, textAlign: "center", lineHeight: 20 }}>
        {message}
      </Text>

      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.85}
          style={{
            marginTop: 14,
            backgroundColor: t.link,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
