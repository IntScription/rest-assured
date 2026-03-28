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
