import { useEffect, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAppTheme } from "@/src/theme/theme";

const TABS = ["Progress", "Explore", "Challenges"] as const;

export type SkillsTabKey = "progress" | "explore" | "challenges";

const TAB_KEYS: SkillsTabKey[] = ["progress", "explore", "challenges"];

export default function SkillsSegmentedControl({
  value,
  onChange,
}: {
  value: SkillsTabKey;
  onChange: (value: SkillsTabKey) => void;
}) {
  const t = useAppTheme();
  const [width, setWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const index = TAB_KEYS.indexOf(value);
  const tabWidth = width > 0 ? width / TABS.length : 0;

  useEffect(() => {
    if (!tabWidth) return;

    Animated.spring(translateX, {
      toValue: index * tabWidth,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.9,
    }).start();
  }, [index, tabWidth, translateX]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.wrapper}>
      <View
        onLayout={handleLayout}
        style={[
          styles.container,
          {
            backgroundColor: t.card,
            borderColor: t.border,
          },
        ]}
      >
        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              {
                width: tabWidth - 4,
                transform: [{ translateX: translateX }],
                backgroundColor: t.background,
                borderColor: t.border,
              },
            ]}
          />
        )}

        {TABS.map((label, i) => {
          const key = TAB_KEYS[i];
          const focused = value === key;

          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              style={styles.tab}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: focused ? t.text : t.mutedText,
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  container: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 2,
    position: "relative",
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    position: "absolute",
    left: 2,
    top: 2,
    bottom: 2,
    borderRadius: 14,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
});
