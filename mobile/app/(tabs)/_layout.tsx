import React from "react";
import { Tabs } from "expo-router";

import CustomTabBar from "@/components/navigation/CustomTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: false,
        freezeOnBlur: false,
        tabBarHideOnKeyboard: false,
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 0,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />

      <Tabs.Screen
        name="train/index"
        options={{
          title: "Train",
        }}
      />

      <Tabs.Screen
        name="skills/index"
        options={{
          title: "Skills",
        }}
      />

      <Tabs.Screen
        name="coach/index"
        options={{
          title: "Coach",
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />

      <Tabs.Screen
        name="skills/[skillId]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
