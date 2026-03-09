"use client";

import { Slot } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { useAppTheme } from "@/src/theme/theme";

export default function AuthLayout() {
  const t = useAppTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
      <StatusBar barStyle={t.primaryText === "#000000" ? "dark-content" : "light-content"} />
      <Slot />
    </SafeAreaView>
  );
}
