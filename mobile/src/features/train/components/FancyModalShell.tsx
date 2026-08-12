import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeType } from "../types";

const IS_IOS = Platform.OS === "ios";
const ABSOLUTE_FILL = StyleSheet.absoluteFill;

type SwipeDismissArea = "sheet" | "handle";
type SizeValue = `${number}%` | number;

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  t: ThemeType;
  enableSwipeDismiss?: boolean;
  showCloseButton?: boolean;
  showDragHandle?: boolean;
  footer?: React.ReactNode;
  sheetMaxHeight?: SizeValue;
  sheetHeight?: SizeValue;
  sheetStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  swipeDismissArea?: SwipeDismissArea;
};

function isDarkHex(color?: string) {
  if (!color?.startsWith("#")) return false;

  const raw = color.replace("#", "");
  const hex = raw.length === 3 ? raw.split("").map((ch) => ch + ch).join("") : raw;
  const value = Number.parseInt(hex.slice(0, 6), 16);

  if (Number.isNaN(value)) return false;

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return 0.299 * r + 0.587 * g + 0.114 * b < 150;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function resolveSize(value: SizeValue | undefined, windowHeight: number, fallbackRatio: number) {
  if (typeof value === "number") return value;

  if (typeof value === "string" && value.endsWith("%")) {
    const pct = Number.parseFloat(value);
    if (!Number.isNaN(pct)) return Math.round(windowHeight * clamp(pct / 100, 0.32, 0.96));
  }

  return Math.round(windowHeight * fallbackRatio);
}

export default function FancyModalShell({
  visible,
  onClose,
  title,
  subtitle,
  children,
  t,
  enableSwipeDismiss = false,
  showCloseButton = true,
  showDragHandle = true,
  footer,
  sheetMaxHeight = "88%",
  sheetHeight,
  sheetStyle,
  contentStyle,
  swipeDismissArea = "sheet",
}: Props) {
  const { height: windowHeight } = useWindowDimensions();

  const resolvedMaxHeight = useMemo(
    () => resolveSize(sheetMaxHeight, windowHeight, 0.88),
    [sheetMaxHeight, windowHeight]
  );

  const resolvedHeight = useMemo(
    () => (sheetHeight ? resolveSize(sheetHeight, windowHeight, 0.82) : undefined),
    [sheetHeight, windowHeight]
  );

  const hasFixedHeight = typeof resolvedHeight === "number";

  const openOffset = Math.max(420, Math.round(windowHeight * 0.6));
  const closeOffset = Math.max(720, Math.round(windowHeight * 1.12));
  const dismissDistance = Math.max(92, Math.round(windowHeight * 0.11));

  const translateY = useRef(new Animated.Value(openOffset)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const isClosingRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const [mounted, setMounted] = useState(visible);

  const isDark = useMemo(() => isDarkHex(t.background) || isDarkHex(t.card), [t.background, t.card]);
  const blurTint = isDark ? "dark" : "light";
  const statusBarStyle = isDark ? "light-content" : "dark-content";

  const stopAnimations = useCallback(() => {
    translateY.stopAnimation();
    backdropOpacity.stopAnimation();
  }, [backdropOpacity, translateY]);

  const primeClosedState = useCallback(() => {
    stopAnimations();
    translateY.setValue(openOffset);
    backdropOpacity.setValue(0);
    isClosingRef.current = false;
    isAnimatingRef.current = false;
  }, [backdropOpacity, openOffset, stopAnimations, translateY]);

  const animateOpen = useCallback(() => {
    isClosingRef.current = false;
    isAnimatingRef.current = true;

    stopAnimations();
    translateY.setValue(openOffset);
    backdropOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 165,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 34,
        stiffness: 420,
        mass: 0.86,
        overshootClamping: true,
        restDisplacementThreshold: 0.22,
        restSpeedThreshold: 0.22,
      }),
    ]).start(() => {
      isAnimatingRef.current = false;
    });
  }, [backdropOpacity, openOffset, stopAnimations, translateY]);

  const finishClose = useCallback(() => {
    isAnimatingRef.current = false;
    isClosingRef.current = false;
    setMounted(false);
    onClose();
  }, [onClose]);

  const animateClose = useCallback(
    (velocity = 0) => {
      if (isClosingRef.current) return;

      isClosingRef.current = true;
      isAnimatingRef.current = true;
      stopAnimations();

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 105,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: closeOffset,
          duration: clamp(210 - Math.round(Math.abs(velocity) * 26), 135, 215),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          isAnimatingRef.current = false;
          isClosingRef.current = false;
          return;
        }

        finishClose();
      });
    },
    [backdropOpacity, closeOffset, finishClose, stopAnimations, translateY]
  );

  const resetSheetPosition = useCallback(
    (velocity = 0) => {
      if (isClosingRef.current) return;

      isAnimatingRef.current = true;

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 85,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          velocity: clamp(velocity, 0, 1.2),
          useNativeDriver: true,
          damping: 40,
          stiffness: 440,
          mass: 0.9,
          overshootClamping: true,
          restDisplacementThreshold: 0.18,
          restSpeedThreshold: 0.18,
        }),
      ]).start(() => {
        isAnimatingRef.current = false;
      });
    },
    [backdropOpacity, translateY]
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      requestAnimationFrame(animateOpen);
      return;
    }

    if (mounted && !isClosingRef.current && !isAnimatingRef.current) {
      setMounted(false);
      primeClosedState();
    }
  }, [animateOpen, mounted, primeClosedState, visible]);

  const handleRequestClose = useCallback(() => {
    animateClose();
  }, [animateClose]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!enableSwipeDismiss || isClosingRef.current) return false;

          const movingDown = gestureState.dy > 7;
          const verticalIntent = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.12;

          return movingDown && verticalIntent;
        },
        onPanResponderGrant: () => {
          if (!enableSwipeDismiss || isClosingRef.current) return;
          stopAnimations();
        },
        onPanResponderMove: (_, gestureState) => {
          if (!enableSwipeDismiss || isClosingRef.current) return;

          const nextY = Math.max(0, gestureState.dy);
          const progress = clamp(nextY / closeOffset, 0, 1);

          translateY.setValue(nextY);
          backdropOpacity.setValue(1 - progress * 0.86);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!enableSwipeDismiss || isClosingRef.current) return;

          const enoughDistance = gestureState.dy > dismissDistance;
          const enoughVelocity = gestureState.dy > 24 && gestureState.vy > 0.82;

          if (enoughDistance || enoughVelocity) {
            animateClose(gestureState.vy);
            return;
          }

          resetSheetPosition(Math.max(0, -gestureState.vy));
        },
        onPanResponderTerminate: () => {
          if (!enableSwipeDismiss || isClosingRef.current) return;
          resetSheetPosition();
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [
      animateClose,
      backdropOpacity,
      closeOffset,
      dismissDistance,
      enableSwipeDismiss,
      resetSheetPosition,
      stopAnimations,
      translateY,
    ]
  );

  const sheetPanHandlers =
    enableSwipeDismiss && swipeDismissArea === "sheet" ? panResponder.panHandlers : {};

  const handlePanHandlers =
    enableSwipeDismiss && swipeDismissArea === "handle" ? panResponder.panHandlers : {};

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      <StatusBar barStyle={statusBarStyle} translucent backgroundColor="transparent" />

      <KeyboardAvoidingView behavior={IS_IOS ? "padding" : undefined} style={styles.flex}>
        <View style={styles.stage}>
          <Animated.View
            pointerEvents="none"
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          >
            <BlurView intensity={42} tint={blurTint} style={ABSOLUTE_FILL} />
            <View
              style={[
                ABSOLUTE_FILL,
                { backgroundColor: isDark ? "rgba(0,0,0,0.24)" : "rgba(0,0,0,0.16)" },
              ]}
            />
          </Animated.View>

          <Pressable style={ABSOLUTE_FILL} onPress={handleRequestClose} />

          <Animated.View
            {...sheetPanHandlers}
            style={[
              styles.sheet,
              {
                height: resolvedHeight,
                maxHeight: resolvedMaxHeight,
                backgroundColor: t.card,
                borderColor: t.border,
                shadowOpacity: isDark ? 0.32 : 0.14,
                transform: [{ translateY }],
              },
              !showDragHandle && styles.sheetNoHandle,
              sheetStyle,
            ]}
          >
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={[styles.sheetInner, hasFixedHeight ? styles.sheetInnerFixed : styles.sheetInnerAuto]}
            >
              {showDragHandle ? (
                <Pressable
                  {...handlePanHandlers}
                  hitSlop={{ top: 10, bottom: 10, left: 100, right: 100 }}
                  style={styles.handleWrap}
                >
                  <View style={[styles.handle, { backgroundColor: t.border }]} />
                </Pressable>
              ) : null}

              <View
                style={[
                  styles.header,
                  !showDragHandle && styles.headerNoHandle,
                  { paddingRight: showCloseButton ? 44 : 0 },
                ]}
              >
                {showCloseButton ? (
                  <TouchableOpacity
                    onPress={handleRequestClose}
                    hitSlop={10}
                    activeOpacity={0.72}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    style={[
                      styles.closeButton,
                      { backgroundColor: t.cardAlt, borderColor: t.border },
                    ]}
                  >
                    <Ionicons name="close" size={18} color={t.mutedText} />
                  </TouchableOpacity>
                ) : null}

                <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
                  {title}
                </Text>

                {!!subtitle && (
                  <Text style={[styles.subtitle, { color: t.mutedText }]}>{subtitle}</Text>
                )}
              </View>

              <View style={[hasFixedHeight ? styles.contentFixed : styles.contentAuto, contentStyle]}>
                {children}
              </View>

              {!!footer && (
                <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.card }]}>
                  {footer}
                </View>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stage: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    shadowColor: "#000",
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  sheetNoHandle: {
    paddingTop: 20,
  },
  sheetInner: {
    minHeight: 0,
  },
  sheetInnerFixed: {
    flex: 1,
  },
  sheetInnerAuto: {
    flexShrink: 1,
  },
  handleWrap: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    paddingHorizontal: 44,
    paddingTop: 4,
    paddingBottom: 8,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 999,
  },
  header: {
    marginBottom: 16,
    position: "relative",
  },
  headerNoHandle: {
    marginBottom: 14,
  },
  closeButton: {
    position: "absolute",
    top: 2,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    zIndex: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.7,
    lineHeight: 33,
  },
  subtitle: {
    marginTop: 6,
    lineHeight: 20,
    fontSize: 14,
  },
  contentFixed: {
    flex: 1,
    minHeight: 0,
  },
  contentAuto: {
    flexShrink: 1,
    minHeight: 0,
  },
  footer: {
    marginHorizontal: -20,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
