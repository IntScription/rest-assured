import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/src/theme/theme";

export const CUSTOM_TAB_BAR_COLLAPSED_HEIGHT = 66;
export const CUSTOM_TAB_BAR_EXPANDED_HEIGHT = 72;
export const CUSTOM_TAB_BAR_END_GAP = 14;

const EXPANDED_AUTO_COLLAPSE_MS = 3600;

function getBottomDockInset(bottomInset: number) {
  if (Platform.OS === "ios") return Math.max(bottomInset - 14, 8);
  if (Platform.OS === "android") return Math.max(bottomInset, 8);
  return 8;
}

export function useCustomTabBarBottomPadding(extra = 26) {
  const insets = useSafeAreaInsets();

  return (
    getBottomDockInset(insets.bottom) +
    CUSTOM_TAB_BAR_COLLAPSED_HEIGHT +
    CUSTOM_TAB_BAR_END_GAP +
    extra
  );
}

type TabConfig = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type Palette = {
  isDark: boolean;
  blurTint: "light" | "dark";
  shellBg: string;
  shellBorder: string;
  shellInnerBorder: string;
  chipBg: string;
  chipFocusedBg: string;
  chipBorder: string;
  chipFocusedBorder: string;
  subtleBg: string;
  modalScrim: string;
};

const TAB_META: Record<string, TabConfig> = {
  index: {
    label: "Home",
    icon: "home-outline",
  },
  "train/index": {
    label: "Train",
    icon: "barbell-outline",
  },
  "skills/index": {
    label: "Skills",
    icon: "flash-outline",
  },
  "coach/index": {
    label: "Coach",
    icon: "sparkles-outline",
  },
  profile: {
    label: "Profile",
    icon: "person-outline",
  },
};

function normalizeRouteName(routeName: string) {
  if (TAB_META[routeName]) return routeName;
  if (routeName.startsWith("train")) return "train/index";
  if (routeName.startsWith("skills")) return "skills/index";
  if (routeName.startsWith("coach")) return "coach/index";
  return routeName;
}

function getFocusedIcon(
  icon: keyof typeof Ionicons.glyphMap
): keyof typeof Ionicons.glyphMap {
  switch (icon) {
    case "home-outline":
      return "home";
    case "barbell-outline":
      return "barbell";
    case "flash-outline":
      return "flash";
    case "sparkles-outline":
      return "sparkles";
    case "person-outline":
      return "person";
    default:
      return icon;
  }
}

function getTabMeta(routeName: string): TabConfig {
  const normalized = normalizeRouteName(routeName);

  return (
    TAB_META[normalized] ?? {
      label: "App",
      icon: "ellipse-outline",
    }
  );
}

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const normalized =
    clean.length === 3
      ? clean
        .split("")
        .map((c) => c + c)
        .join("")
      : clean;

  const value = parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function isDarkColor(hex: string) {
  try {
    const { r, g, b } = hexToRgb(hex);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.5;
  } catch {
    return false;
  }
}

function getPalette(background: string): Palette {
  const dark = isDarkColor(background);

  if (dark) {
    return {
      isDark: true,
      blurTint: "dark",
      shellBg: "rgba(255,255,255,0.06)",
      shellBorder: "rgba(255,255,255,0.12)",
      shellInnerBorder: "rgba(255,255,255,0.14)",
      chipBg: "rgba(255,255,255,0.045)",
      chipFocusedBg: "rgba(255,255,255,0.12)",
      chipBorder: "rgba(255,255,255,0.08)",
      chipFocusedBorder: "rgba(255,255,255,0.18)",
      subtleBg: "rgba(255,255,255,0.08)",
      modalScrim: "rgba(0,0,0,0.16)",
    };
  }

  return {
    isDark: false,
    blurTint: "light",
    shellBg: "rgba(255,255,255,0.72)",
    shellBorder: "rgba(255,255,255,0.68)",
    shellInnerBorder: "rgba(255,255,255,0.82)",
    chipBg: "rgba(255,255,255,0.42)",
    chipFocusedBg: "rgba(255,255,255,0.88)",
    chipBorder: "rgba(0,0,0,0.06)",
    chipFocusedBorder: "rgba(0,0,0,0.1)",
    subtleBg: "rgba(255,255,255,0.62)",
    modalScrim: "rgba(0,0,0,0.1)",
  };
}

async function lightTap() {
  try {
    await Haptics.selectionAsync();
  } catch { }
}

async function softImpact() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch { }
}

type CompactTabButtonProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  textColor: string;
  palette: Palette;
  onPress: () => void;
};

function CompactTabButton({
  label,
  icon,
  textColor,
  palette,
  onPress,
}: CompactTabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.compactTabButton,
        {
          backgroundColor: palette.chipFocusedBg,
          borderColor: palette.chipFocusedBorder,
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.975 : 1 }],
        },
      ]}
    >
      <Ionicons name={getFocusedIcon(icon)} size={17} color={textColor} />

      <Text
        numberOfLines={1}
        style={[styles.compactTabLabel, { color: textColor }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type TimerCardLayoutProps = {
  title: string;
  time: string;
  isRunning: boolean;
  textColor: string;
  mutedColor: string;
  palette: Palette;
  pulseAnim: Animated.Value;
  activeDotColor: string;
  actions: React.ReactNode;
  bottomContent?: React.ReactNode;
};

function TimerCardLayout({
  title,
  time,
  isRunning,
  textColor,
  mutedColor,
  palette,
  pulseAnim,
  activeDotColor,
  actions,
  bottomContent,
}: TimerCardLayoutProps) {
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.45],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0],
  });

  return (
    <View
      style={[
        styles.timerCard,
        {
          backgroundColor: palette.chipFocusedBg,
          borderColor: palette.chipFocusedBorder,
        },
      ]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.utilityLeft}>
          <View style={styles.dotWrap}>
            {isRunning && (
              <Animated.View
                style={[
                  styles.timerDotPulse,
                  {
                    backgroundColor: activeDotColor,
                    opacity: pulseOpacity,
                    transform: [{ scale: pulseScale }],
                  },
                ]}
              />
            )}

            <View
              style={[
                styles.timerDot,
                {
                  backgroundColor: isRunning ? activeDotColor : mutedColor,
                },
              ]}
            />
          </View>

          <View style={styles.utilityTextWrap}>
            <Text
              numberOfLines={1}
              style={[styles.utilityLabel, { color: mutedColor }]}
            >
              {title}
            </Text>

            <Text
              numberOfLines={1}
              style={[styles.utilityTime, { color: textColor }]}
            >
              {time}
            </Text>
          </View>
        </View>

        <View style={styles.utilityActions}>{actions}</View>
      </View>

      {bottomContent ? bottomContent : null}
    </View>
  );
}

type UtilityTimerCardProps = {
  title: string;
  isRunning: boolean;
  elapsedSeconds: number;
  onToggle: () => void;
  onReset: () => void;
  textColor: string;
  mutedColor: string;
  palette: Palette;
  pulseAnim: Animated.Value;
  activeDotColor: string;
};

function UtilityTimerCard({
  title,
  isRunning,
  elapsedSeconds,
  onToggle,
  onReset,
  textColor,
  mutedColor,
  palette,
  pulseAnim,
  activeDotColor,
}: UtilityTimerCardProps) {
  return (
    <TimerCardLayout
      title={title}
      time={formatTime(elapsedSeconds)}
      isRunning={isRunning}
      textColor={textColor}
      mutedColor={mutedColor}
      palette={palette}
      pulseAnim={pulseAnim}
      activeDotColor={activeDotColor}
      actions={
        <>
          <Pressable
            onPress={onToggle}
            hitSlop={8}
            style={({ pressed }) => [
              styles.timerActionButton,
              {
                backgroundColor: palette.subtleBg,
                borderColor: palette.chipBorder,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <Ionicons
              name={isRunning ? "pause" : "play"}
              size={13}
              color={textColor}
            />

            <Text style={[styles.timerActionText, { color: textColor }]}>
              {isRunning ? "Stop" : "Start"}
            </Text>
          </Pressable>

          <Pressable
            onPress={onReset}
            hitSlop={8}
            style={({ pressed }) => [
              styles.resetButton,
              {
                backgroundColor: palette.subtleBg,
                borderColor: palette.chipBorder,
                opacity: pressed ? 0.82 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <Ionicons name="refresh" size={14} color={mutedColor} />
          </Pressable>
        </>
      }
    />
  );
}

type RestTimerCardProps = {
  isRunning: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  onReset: () => void;
  onOpenPicker: () => void;
  textColor: string;
  mutedColor: string;
  palette: Palette;
  pulseAnim: Animated.Value;
  activeDotColor: string;
};

function RestTimerCard({
  isRunning,
  remainingSeconds,
  totalSeconds,
  onReset,
  onOpenPicker,
  textColor,
  mutedColor,
  palette,
  pulseAnim,
  activeDotColor,
}: RestTimerCardProps) {
  const isIdle = totalSeconds === 0 || remainingSeconds === 0;

  const progress =
    !isIdle && totalSeconds > 0
      ? Math.min(
        1,
        Math.max(0, (totalSeconds - remainingSeconds) / totalSeconds)
      )
      : 0;

  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isIdle || !isRunning) {
      glowAnim.stopAnimation();
      glowAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [isRunning, isIdle, glowAnim]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.55],
  });

  return (
    <TimerCardLayout
      title="Rest timer"
      time={formatTime(remainingSeconds)}
      isRunning={isRunning}
      textColor={textColor}
      mutedColor={mutedColor}
      palette={palette}
      pulseAnim={pulseAnim}
      activeDotColor={activeDotColor}
      actions={
        <>
          <Pressable
            onPress={onOpenPicker}
            hitSlop={8}
            style={({ pressed }) => [
              styles.timerActionButton,
              {
                backgroundColor: palette.subtleBg,
                borderColor: palette.chipBorder,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <Ionicons name="options-outline" size={13} color={textColor} />

            <Text style={[styles.timerActionText, { color: textColor }]}>
              Set
            </Text>
          </Pressable>

          <Pressable
            onPress={onReset}
            hitSlop={8}
            style={({ pressed }) => [
              styles.resetButton,
              {
                backgroundColor: palette.subtleBg,
                borderColor: palette.chipBorder,
                opacity: pressed ? 0.82 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <Ionicons name="refresh" size={14} color={mutedColor} />
          </Pressable>
        </>
      }
      bottomContent={
        <View
          style={[
            styles.progressTrack,
            {
              backgroundColor: isIdle
                ? palette.isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.04)"
                : palette.subtleBg,
              borderColor: isIdle
                ? palette.chipBorder
                : palette.chipFocusedBorder,
            },
          ]}
        >
          {!isIdle && isRunning && (
            <Animated.View
              style={[
                styles.progressGlow,
                {
                  width: `${progress * 100}%`,
                  opacity: glowOpacity,
                  backgroundColor: activeDotColor,
                },
              ]}
            />
          )}

          <View
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: isIdle
                  ? palette.isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.08)"
                  : activeDotColor,
              },
            ]}
          />
        </View>
      }
    />
  );
}

type ExpandedTabButtonProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  textColor: string;
  mutedColor: string;
  palette: Palette;
  onPress: () => void;
};

function ExpandedTabButton({
  label,
  icon,
  focused,
  textColor,
  mutedColor,
  palette,
  onPress,
}: ExpandedTabButtonProps) {
  const color = focused ? textColor : mutedColor;
  const finalIcon = focused ? getFocusedIcon(icon) : icon;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.expandedTabButton,
        {
          backgroundColor: focused ? palette.chipFocusedBg : palette.chipBg,
          borderColor: focused
            ? palette.chipFocusedBorder
            : palette.chipBorder,
          opacity: pressed ? 0.86 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <View style={styles.expandedTabInner}>
        <Ionicons name={finalIcon} size={16} color={color} />

        <Text numberOfLines={1} style={[styles.expandedTabLabel, { color }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

type StepperPickerProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  textColor: string;
  mutedColor: string;
  palette: Palette;
};

function StepperPicker({
  label,
  value,
  onChange,
  min = 0,
  max = 59,
  textColor,
  mutedColor,
  palette,
}: StepperPickerProps) {
  const bump = async (delta: number) => {
    await lightTap();
    const next = Math.min(max, Math.max(min, value + delta));
    onChange(next);
  };

  return (
    <View
      style={[
        styles.stepperCard,
        {
          backgroundColor: palette.subtleBg,
          borderColor: palette.chipBorder,
        },
      ]}
    >
      <Text style={[styles.stepperLabel, { color: mutedColor }]}>{label}</Text>

      <Pressable
        onPress={() => bump(1)}
        hitSlop={8}
        style={({ pressed }) => [
          styles.stepperButton,
          {
            backgroundColor: palette.chipFocusedBg,
            borderColor: palette.chipFocusedBorder,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
      >
        <Ionicons name="chevron-up" size={18} color={textColor} />
      </Pressable>

      <View
        style={[
          styles.stepperValueWrap,
          {
            borderColor: palette.chipFocusedBorder,
            backgroundColor: palette.chipFocusedBg,
          },
        ]}
      >
        <Text style={[styles.stepperValue, { color: textColor }]}>
          {String(value).padStart(2, "0")}
        </Text>
      </View>

      <Pressable
        onPress={() => bump(-1)}
        hitSlop={8}
        style={({ pressed }) => [
          styles.stepperButton,
          {
            backgroundColor: palette.chipFocusedBg,
            borderColor: palette.chipFocusedBorder,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
      >
        <Ionicons name="chevron-down" size={18} color={textColor} />
      </Pressable>
    </View>
  );
}

export default function CustomTabBar(props: BottomTabBarProps) {
  const pathname = usePathname();

  const shouldHideTabBar =
    pathname.startsWith("/coach/onboarding") ||
    pathname.startsWith("/coach/measurements") ||
    pathname.startsWith("/coach/recovery") ||
    pathname.startsWith("/coach/ask") ||
    pathname.startsWith("/skills/");

  if (shouldHideTabBar) return null;

  return <CustomTabBarInner {...props} />;
}

function CustomTabBarInner({
  state,
  navigation,
}: BottomTabBarProps) {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const bottomDockInset = getBottomDockInset(insets.bottom);

  const palette = useMemo(() => getPalette(t.background), [t.background]);

  const visibleRoutes = useMemo(() => {
    const seen = new Set<string>();

    return state.routes.filter((route) => {
      const normalized = normalizeRouteName(route.name);

      if (!TAB_META[normalized]) return false;
      if (seen.has(normalized)) return false;

      seen.add(normalized);
      return true;
    });
  }, [state.routes]);

  const [expanded, setExpanded] = useState(false);

  const [workoutRunning, setWorkoutRunning] = useState(false);
  const [workoutSeconds, setWorkoutSeconds] = useState(0);

  const [restRunning, setRestRunning] = useState(false);
  const [restDurationSeconds, setRestDurationSeconds] = useState(0);
  const [restRemainingSeconds, setRestRemainingSeconds] = useState(0);

  const [restPickerVisible, setRestPickerVisible] = useState(false);
  const [draftMinutes, setDraftMinutes] = useState(1);
  const [draftSeconds, setDraftSeconds] = useState(0);

  const currentRoute = state.routes[state.index];
  const currentMeta = useMemo(
    () => getTabMeta(currentRoute.name),
    [currentRoute.name]
  );

  const expandedScrollRef = useRef<ScrollView>(null);
  const utilityPagerRef = useRef<ScrollView>(null);
  const hasMountedRestRef = useRef(false);

  const restDoneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const expandedCollapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const containerAnim = useRef(new Animated.Value(0)).current;
  const collapsedOpacity = useRef(new Animated.Value(1)).current;
  const expandedOpacity = useRef(new Animated.Value(0)).current;
  const expandedTranslate = useRef(new Animated.Value(6)).current;
  const dockPressAnim = useRef(new Animated.Value(0)).current;
  const pickerScale = useRef(new Animated.Value(0.94)).current;
  const pickerOpacity = useRef(new Animated.Value(0)).current;

  const workoutPulseAnim = useRef(new Animated.Value(0)).current;
  const restPulseAnim = useRef(new Animated.Value(0)).current;

  const shellHorizontalPadding = 12;
  const outerHorizontalInset = 7;
  const collapsedGap = 7;
  const expandedGap = 7;
  const visibleTabs = 4;

  const barInnerWidth = Math.max(
    0,
    width - shellHorizontalPadding * 2 - outerHorizontalInset * 2
  );

  const currentTabWidth = width < 380 ? 98 : 108;

  const utilityAreaWidth = Math.max(
    0,
    barInnerWidth - currentTabWidth - collapsedGap
  );

  const expandedTabWidth = Math.floor(
    (barInnerWidth - expandedGap * (visibleTabs - 1)) / visibleTabs
  );

  const activeVisibleIndex = useMemo(() => {
    const normalizedCurrent = normalizeRouteName(currentRoute.name);
    const idx = visibleRoutes.findIndex(
      (route) => normalizeRouteName(route.name) === normalizedCurrent
    );
    return idx >= 0 ? idx : 0;
  }, [currentRoute.name, visibleRoutes]);

  const shouldScrollExpanded = visibleRoutes.length > visibleTabs;

  const stopRestDoneHaptics = () => {
    if (restDoneIntervalRef.current) {
      clearInterval(restDoneIntervalRef.current);
      restDoneIntervalRef.current = null;
    }
  };

  const clearExpandedAutoCollapse = useCallback(() => {
    if (expandedCollapseTimeoutRef.current) {
      clearTimeout(expandedCollapseTimeoutRef.current);
      expandedCollapseTimeoutRef.current = null;
    }
  }, []);

  const scheduleExpandedAutoCollapse = useCallback(() => {
    clearExpandedAutoCollapse();

    expandedCollapseTimeoutRef.current = setTimeout(() => {
      setExpanded(false);
    }, EXPANDED_AUTO_COLLAPSE_MS);
  }, [clearExpandedAutoCollapse]);

  const triggerDockPressFeel = useCallback(() => {
    dockPressAnim.stopAnimation();
    dockPressAnim.setValue(0);

    Animated.sequence([
      Animated.spring(dockPressAnim, {
        toValue: 1,
        damping: 11,
        stiffness: 280,
        mass: 0.45,
        useNativeDriver: false,
      }),
      Animated.spring(dockPressAnim, {
        toValue: 0,
        damping: 14,
        stiffness: 240,
        mass: 0.55,
        useNativeDriver: false,
      }),
    ]).start();
  }, [dockPressAnim]);

  useEffect(() => {
    if (!expanded) {
      clearExpandedAutoCollapse();
      return;
    }

    scheduleExpandedAutoCollapse();

    return clearExpandedAutoCollapse;
  }, [expanded, clearExpandedAutoCollapse, scheduleExpandedAutoCollapse]);

  useEffect(() => {
    if (expanded) {
      Animated.parallel([
        Animated.spring(containerAnim, {
          toValue: 1,
          damping: 18,
          stiffness: 250,
          mass: 0.9,
          useNativeDriver: false,
        }),
        Animated.timing(collapsedOpacity, {
          toValue: 0,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(expandedOpacity, {
          toValue: 1,
          duration: 170,
          delay: 25,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(expandedTranslate, {
          toValue: 0,
          duration: 170,
          delay: 25,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      if (shouldScrollExpanded) {
        const maxStartIndex = Math.max(0, visibleRoutes.length - visibleTabs);
        const clampedIndex = Math.min(activeVisibleIndex, maxStartIndex);
        const targetX = clampedIndex * (expandedTabWidth + expandedGap);

        requestAnimationFrame(() => {
          expandedScrollRef.current?.scrollTo({
            x: targetX,
            animated: false,
          });
        });
      }
    } else {
      Animated.parallel([
        Animated.spring(containerAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 280,
          mass: 0.9,
          useNativeDriver: false,
        }),
        Animated.timing(expandedOpacity, {
          toValue: 0,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(expandedTranslate, {
          toValue: 6,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(collapsedOpacity, {
          toValue: 1,
          duration: 150,
          delay: 15,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [
    expanded,
    activeVisibleIndex,
    visibleRoutes.length,
    containerAnim,
    collapsedOpacity,
    expandedOpacity,
    expandedTranslate,
    expandedTabWidth,
    expandedGap,
    shouldScrollExpanded,
  ]);

  useEffect(() => {
    if (restPickerVisible) {
      pickerScale.setValue(0.94);
      pickerOpacity.setValue(0);

      Animated.parallel([
        Animated.spring(pickerScale, {
          toValue: 1,
          damping: 16,
          stiffness: 240,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(pickerOpacity, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [restPickerVisible, pickerOpacity, pickerScale]);

  useEffect(() => {
    if (!workoutRunning) {
      workoutPulseAnim.stopAnimation();
      workoutPulseAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(workoutPulseAnim, {
        toValue: 1,
        duration: 1300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );

    loop.start();

    return () => {
      loop.stop();
      workoutPulseAnim.setValue(0);
    };
  }, [workoutRunning, workoutPulseAnim]);

  useEffect(() => {
    if (!restRunning) {
      restPulseAnim.stopAnimation();
      restPulseAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(restPulseAnim, {
        toValue: 1,
        duration: 1300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );

    loop.start();

    return () => {
      loop.stop();
      restPulseAnim.setValue(0);
    };
  }, [restRunning, restPulseAnim]);

  useEffect(() => {
    if (!workoutRunning) return;

    const interval = setInterval(() => {
      setWorkoutSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [workoutRunning]);

  useEffect(() => {
    if (!restRunning) return;
    if (restRemainingSeconds <= 0) {
      setRestRunning(false);
      return;
    }

    const interval = setInterval(() => {
      setRestRemainingSeconds((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [restRunning, restRemainingSeconds]);

  useEffect(() => {
    if (!hasMountedRestRef.current) {
      hasMountedRestRef.current = true;
      return;
    }

    if (restRemainingSeconds === 0 && restDurationSeconds > 0) {
      stopRestDoneHaptics();

      const pulseDone = async () => {
        try {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        } catch { }

        setTimeout(async () => {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch { }
        }, 180);
      };

      pulseDone();

      restDoneIntervalRef.current = setInterval(() => {
        pulseDone();
      }, 1400);
    }

    return () => {
      if (restRemainingSeconds !== 0) {
        stopRestDoneHaptics();
      }
    };
  }, [restRemainingSeconds, restDurationSeconds]);

  useEffect(() => {
    return () => {
      stopRestDoneHaptics();
      clearExpandedAutoCollapse();
    };
  }, [clearExpandedAutoCollapse]);

  const handleWorkoutToggle = async () => {
    await lightTap();
    setWorkoutRunning((prev) => !prev);
  };

  const handleWorkoutReset = async () => {
    await softImpact();
    setWorkoutRunning(false);
    setWorkoutSeconds(0);
  };

  const handleRestReset = async () => {
    await softImpact();
    stopRestDoneHaptics();
    setRestRunning(false);
    setRestDurationSeconds(0);
    setRestRemainingSeconds(0);
    setDraftMinutes(0);
    setDraftSeconds(0);
  };

  const handleOpenRestPicker = async () => {
    await lightTap();
    const sourceSeconds =
      restRemainingSeconds > 0 ? restRemainingSeconds : restDurationSeconds;

    if (sourceSeconds > 0) {
      setDraftMinutes(Math.floor(sourceSeconds / 60));
      setDraftSeconds(sourceSeconds % 60);
    }

    setRestPickerVisible(true);
  };

  const handleCancelRestPicker = async () => {
    await lightTap();
    setRestPickerVisible(false);
  };

  const handleStartFromPicker = async () => {
    await softImpact();
    const total = draftMinutes * 60 + draftSeconds;
    if (total <= 0) return;

    stopRestDoneHaptics();
    setRestDurationSeconds(total);
    setRestRemainingSeconds(total);
    setRestRunning(true);
    setRestPickerVisible(false);
  };

  const handleExpandedInteractionStart = () => {
    if (!expanded) return;
    clearExpandedAutoCollapse();
  };

  const handleExpandedInteractionEnd = () => {
    if (!expanded) return;
    scheduleExpandedAutoCollapse();
  };

  const handleTabPress = async (routeName: string, isFocused: boolean) => {
    const normalizedTarget = normalizeRouteName(routeName);
    const route = state.routes.find(
      (r) => normalizeRouteName(r.name) === normalizedTarget
    );

    if (!route) return;

    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });

    if (event.defaultPrevented) return;

    if (isFocused) {
      await lightTap();
      triggerDockPressFeel();

      setExpanded((prev) => {
        const next = !prev;

        if (!next) {
          clearExpandedAutoCollapse();
        }

        return next;
      });

      return;
    }

    await softImpact();
    clearExpandedAutoCollapse();
    setExpanded(false);
    navigation.navigate(normalizedTarget as never);
  };

  const animatedHeight = containerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      CUSTOM_TAB_BAR_COLLAPSED_HEIGHT,
      CUSTOM_TAB_BAR_EXPANDED_HEIGHT,
    ],
  });

  const animatedRadius = containerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [25, 27],
  });

  const dockPressScale = dockPressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.018],
  });

  const dockPressLift = dockPressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -1.5],
  });


  return (
    <>

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.shell,
          {
            paddingBottom: bottomDockInset,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.outer,
            {
              height: animatedHeight,
              borderRadius: animatedRadius,
              backgroundColor: palette.shellBg,
              borderColor: palette.shellBorder,
              shadowColor: "#000",
              transform: [
                { translateY: dockPressLift },
                { scale: dockPressScale },
              ],
            },
          ]}
        >
          <BlurView
            intensity={palette.isDark ? 54 : 72}
            tint={palette.blurTint}
            style={StyleSheet.absoluteFillObject}
          />

          <Animated.View
            pointerEvents="none"
            style={[
              styles.glassBorder,
              {
                borderRadius: animatedRadius,
                borderColor: palette.shellInnerBorder,
              },
            ]}
          />

          <Animated.View
            pointerEvents={expanded ? "none" : "auto"}
            style={[
              styles.collapsedLayer,
              {
                opacity: collapsedOpacity,
              },
            ]}
          >
            <View style={[styles.currentTabWrap, { width: currentTabWidth }]}>
              <CompactTabButton
                label={currentMeta.label}
                icon={currentMeta.icon}
                textColor={t.text}
                palette={palette}
                onPress={() =>
                  handleTabPress(normalizeRouteName(currentRoute.name), true)
                }
              />
            </View>

            <View style={[styles.utilityPagerWrap, { width: utilityAreaWidth }]}>
              <ScrollView
                ref={utilityPagerRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                bounces={false}
                overScrollMode="never"
                contentInsetAdjustmentBehavior="never"
                snapToInterval={utilityAreaWidth}
                snapToAlignment="start"
                scrollEventThrottle={16}
                contentContainerStyle={styles.utilityPagerContent}
              >
                <View style={[styles.utilityPage, { width: utilityAreaWidth }]}>
                  <UtilityTimerCard
                    title="Workout timer"
                    isRunning={workoutRunning}
                    elapsedSeconds={workoutSeconds}
                    onToggle={handleWorkoutToggle}
                    onReset={handleWorkoutReset}
                    textColor={t.text}
                    mutedColor={t.mutedText}
                    palette={palette}
                    pulseAnim={workoutPulseAnim}
                    activeDotColor="#34c759"
                  />
                </View>

                <View style={[styles.utilityPage, { width: utilityAreaWidth }]}>
                  <RestTimerCard
                    isRunning={restRunning}
                    remainingSeconds={restRemainingSeconds}
                    totalSeconds={restDurationSeconds}
                    onReset={handleRestReset}
                    onOpenPicker={handleOpenRestPicker}
                    textColor={t.text}
                    mutedColor={t.mutedText}
                    palette={palette}
                    pulseAnim={restPulseAnim}
                    activeDotColor="#ff9f0a"
                  />
                </View>
              </ScrollView>
            </View>
          </Animated.View>

          <Animated.View
            pointerEvents={expanded ? "auto" : "none"}
            style={[
              styles.expandedLayer,
              {
                opacity: expandedOpacity,
                transform: [{ translateY: expandedTranslate }],
              },
            ]}
          >
            <ScrollView
              ref={expandedScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              scrollEnabled={shouldScrollExpanded}
              bounces={shouldScrollExpanded}
              alwaysBounceHorizontal={false}
              overScrollMode="never"
              contentInsetAdjustmentBehavior="never"
              snapToInterval={
                shouldScrollExpanded ? expandedTabWidth + expandedGap : undefined
              }
              disableIntervalMomentum={!shouldScrollExpanded}
              snapToAlignment="start"
              onTouchStart={handleExpandedInteractionStart}
              onTouchEnd={handleExpandedInteractionEnd}
              onTouchCancel={handleExpandedInteractionEnd}
              onScrollBeginDrag={handleExpandedInteractionStart}
              onScrollEndDrag={handleExpandedInteractionEnd}
              onMomentumScrollEnd={handleExpandedInteractionEnd}
              contentContainerStyle={[
                styles.tabsScrollContent,
                {
                  gap: expandedGap,
                  paddingHorizontal: 0,
                  width: shouldScrollExpanded ? undefined : barInnerWidth,
                },
              ]}
            >
              {visibleRoutes.map((route) => {
                const normalized = normalizeRouteName(route.name);
                const isFocused =
                  normalizeRouteName(currentRoute.name) === normalized;
                const meta = getTabMeta(normalized);

                return (
                  <View
                    key={normalized}
                    style={{
                      width: expandedTabWidth,
                    }}
                  >
                    <ExpandedTabButton
                      label={meta.label}
                      icon={meta.icon}
                      focused={isFocused}
                      textColor={t.text}
                      mutedColor={t.mutedText}
                      palette={palette}
                      onPress={() => handleTabPress(normalized, isFocused)}
                    />
                  </View>
                );
              })}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      <Modal
        visible={restPickerVisible}
        transparent
        animationType="none"
        onRequestClose={handleCancelRestPicker}
      >
        <Pressable
          style={[
            styles.modalBackdrop,
            {
              backgroundColor: palette.modalScrim,
              paddingBottom:
                bottomDockInset + CUSTOM_TAB_BAR_COLLAPSED_HEIGHT + 12,
            },
          ]}
          onPress={handleCancelRestPicker}
        >
          <Animated.View
            style={[
              styles.compactPickerCard,
              {
                backgroundColor: palette.chipFocusedBg,
                borderColor: palette.chipFocusedBorder,
                opacity: pickerOpacity,
                transform: [{ scale: pickerScale }],
              },
            ]}
          >
            <BlurView
              intensity={palette.isDark ? 48 : 70}
              tint={palette.blurTint}
              style={StyleSheet.absoluteFillObject}
            />

            <View
              style={[
                styles.modalInnerBorder,
                {
                  borderColor: palette.shellInnerBorder,
                },
              ]}
            />

            <Pressable onPress={() => { }} style={styles.compactPickerInner}>
              <View style={styles.compactPickerHeader}>
                <View>
                  <Text style={[styles.compactPickerTitle, { color: t.text }]}>
                    Rest
                  </Text>

                  <Text
                    style={[styles.compactPickerSubtitle, { color: t.mutedText }]}
                  >
                    Set time
                  </Text>
                </View>

                <Pressable
                  onPress={handleCancelRestPicker}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.compactCloseButton,
                    {
                      backgroundColor: palette.subtleBg,
                      borderColor: palette.chipBorder,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <Ionicons name="close" size={16} color={t.text} />
                </Pressable>
              </View>

              <View style={styles.steppersRow}>
                <StepperPicker
                  label="Min"
                  value={draftMinutes}
                  onChange={setDraftMinutes}
                  textColor={t.text}
                  mutedColor={t.mutedText}
                  palette={palette}
                />

                <Text style={[styles.compactDivider, { color: t.text }]}>:</Text>

                <StepperPicker
                  label="Sec"
                  value={draftSeconds}
                  onChange={setDraftSeconds}
                  textColor={t.text}
                  mutedColor={t.mutedText}
                  palette={palette}
                />
              </View>

              <View style={styles.compactPickerActions}>
                <Pressable
                  onPress={handleCancelRestPicker}
                  style={({ pressed }) => [
                    styles.compactPickerButton,
                    {
                      backgroundColor: palette.subtleBg,
                      borderColor: palette.chipBorder,
                      opacity: pressed ? 0.84 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.compactPickerButtonText, { color: t.mutedText }]}
                  >
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleStartFromPicker}
                  style={({ pressed }) => [
                    styles.compactPickerButton,
                    styles.compactPrimaryButton,
                    {
                      backgroundColor: palette.chipFocusedBg,
                      borderColor: palette.chipFocusedBorder,
                      opacity: pressed ? 0.84 : 1,
                    },
                  ]}
                >
                  <Ionicons name="play" size={14} color={t.text} />

                  <Text
                    style={[styles.compactPickerButtonText, { color: t.text }]}
                  >
                    Start
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({

  shell: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 999,
    paddingHorizontal: 12,
    paddingTop: 4,
    backgroundColor: "transparent",
  },

  outer: {
    position: "relative",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7,
    paddingVertical: 7,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.13,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 14,
      },
    }),
  },

  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },

  collapsedLayer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  expandedLayer: {
    ...StyleSheet.absoluteFillObject,
    top: 7,
    left: 7,
    right: 7,
    bottom: 7,
    justifyContent: "center",
  },

  currentTabWrap: {
    flexShrink: 0,
  },

  utilityPagerWrap: {
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 18,
  },

  utilityPagerContent: {
    alignItems: "center",
    paddingHorizontal: 3,
  },

  utilityPage: {
    justifyContent: "center",
    paddingHorizontal: 3,
  },

  compactTabButton: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  compactTabLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.15,
    textAlign: "center",
  },

  timerCard: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingVertical: 8,
    justifyContent: "center",
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 0,
  },

  utilityLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
    minWidth: 0,
  },

  utilityTextWrap: {
    justifyContent: "center",
    flexShrink: 1,
  },

  utilityLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: -0.05,
    marginBottom: 0,
  },

  utilityTime: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  progressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    marginTop: 6,
  },

  progressGlow: {
    position: "absolute",
    height: "100%",
    borderRadius: 999,
    zIndex: 1,
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  dotWrap: {
    width: 11,
    height: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  timerDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },

  timerDotPulse: {
    position: "absolute",
    width: 11,
    height: 11,
    borderRadius: 999,
  },

  utilityActions: {
    minWidth: 82,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  timerActionButton: {
    minHeight: 30,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  timerActionText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: -0.1,
  },

  resetButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  tabsScrollContent: {
    alignItems: "center",
  },

  expandedTabButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },

  expandedTabInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  expandedTabLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: -0.1,
    textAlign: "center",
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 18,
  },

  compactPickerCard: {
    alignSelf: "flex-end",
    width: 232,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },

  compactPickerInner: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },

  modalInnerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderRadius: 24,
  },

  compactPickerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  compactPickerTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  compactPickerSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },

  compactCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  steppersRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  compactDivider: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 12,
  },

  stepperCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 6,
  },

  stepperLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: -0.05,
  },

  stepperButton: {
    width: 38,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  stepperValueWrap: {
    minWidth: 58,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  stepperValue: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.35,
  },

  compactPickerActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  compactPickerButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },

  compactPrimaryButton: {
    shadowColor: "#000",
    ...Platform.select({
      ios: {
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 2,
      },
    }),
  },

  compactPickerButtonText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
});
