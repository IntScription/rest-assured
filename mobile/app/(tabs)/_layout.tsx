import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/src/theme/theme";


export default function TabsLayout() {
  const t = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: false,
        freezeOnBlur: false,
        tabBarStyle: {
          backgroundColor: t.tabBarBg,
          borderTopColor: t.tabBarBorder,
        },
        tabBarActiveTintColor: t.text,
        tabBarInactiveTintColor: t.mutedText,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
