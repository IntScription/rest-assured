"use client";

import { Stack } from "expo-router";
import { StatusBar, StyleSheet, View } from "react-native";

const AUTH_BG = "#050712";

export default function AuthLayout() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={AUTH_BG} />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          animationDuration: 180,
          contentStyle: {
            backgroundColor: AUTH_BG,
          },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH_BG,
  },
});
