import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeType } from "../types";

const IS_IOS = Platform.OS === "ios";

export default function FancyModalShell({
  visible,
  onClose,
  title,
  subtitle,
  children,
  t,
  enableSwipeDismiss = false,
  showCloseButton = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  t: ThemeType;
  enableSwipeDismiss?: boolean;
  showCloseButton?: boolean;
}) {
  const SHEET_OPEN_OFFSET = 420;
  const SHEET_CLOSE_OFFSET = 520;

  const translateY = useRef(new Animated.Value(SHEET_OPEN_OFFSET)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      translateY.stopAnimation();
      backdropOpacity.stopAnimation();
      translateY.setValue(SHEET_OPEN_OFFSET);
      backdropOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 24,
          stiffness: 360,
          mass: 0.82,
          overshootClamping: false,
          restDisplacementThreshold: 0.4,
          restSpeedThreshold: 0.4,
        }),
      ]).start();

      return;
    }

    translateY.stopAnimation();
    backdropOpacity.stopAnimation();
    translateY.setValue(SHEET_OPEN_OFFSET);
    backdropOpacity.setValue(0);
    isClosingRef.current = false;
  }, [visible, translateY, backdropOpacity]);

  const finishClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    onClose();
  }, [onClose]);

  const closeAnimated = useCallback(
    (velocity = 1.9) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: SHEET_CLOSE_OFFSET,
          velocity: Math.max(1.4, velocity),
          damping: 22,
          stiffness: 320,
          mass: 0.72,
          overshootClamping: true,
          restDisplacementThreshold: 0.5,
          restSpeedThreshold: 0.5,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onClose();
        } else {
          isClosingRef.current = false;
        }
      });
    },
    [backdropOpacity, onClose, translateY]
  );

  const resetSheetPosition = useCallback(
    (velocity = 0) => {
      Animated.spring(translateY, {
        toValue: 0,
        velocity: Math.max(0, velocity),
        useNativeDriver: true,
        damping: 26,
        stiffness: 380,
        mass: 0.82,
        overshootClamping: false,
        restDisplacementThreshold: 0.4,
        restSpeedThreshold: 0.4,
      }).start();
    },
    [translateY]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!enableSwipeDismiss) return false;
          const verticalIntent = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.08;
          return verticalIntent && gestureState.dy > 3;
        },
        onPanResponderGrant: () => {
          if (!enableSwipeDismiss) return;
          translateY.stopAnimation();
          backdropOpacity.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          if (!enableSwipeDismiss) return;
          const nextY = Math.max(0, gestureState.dy);
          translateY.setValue(nextY);
          const progress = Math.min(1, nextY / SHEET_CLOSE_OFFSET);
          backdropOpacity.setValue(1 - progress * 0.92);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!enableSwipeDismiss) return;
          const shouldClose = gestureState.dy > 72 || gestureState.vy > 1.05;
          if (shouldClose) {
            closeAnimated(gestureState.vy);
            return;
          }
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 110,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start();
          resetSheetPosition(Math.max(0, -gestureState.vy));
        },
        onPanResponderTerminate: () => {
          if (!enableSwipeDismiss) return;
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 110,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start();
          resetSheetPosition();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [backdropOpacity, closeAnimated, enableSwipeDismiss, resetSheetPosition, translateY]
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={finishClose}>
      <KeyboardAvoidingView behavior={IS_IOS ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              opacity: backdropOpacity,
            }}
          >
            <BlurView
              intensity={42}
              tint={t.background === "#000000" || t.background === "#0b0b0c" ? "dark" : "light"}
              style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundColor: "rgba(0,0,0,0.16)",
              }}
            />
          </Animated.View>

          <Pressable
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            onPress={() => closeAnimated()}
          />

          <Animated.View
            {...(enableSwipeDismiss ? panResponder.panHandlers : {})}
            style={{
              width: "100%",
              maxHeight: "86%",
              backgroundColor: t.card,
              paddingHorizontal: 20,
              paddingTop: 14,
              paddingBottom: 26,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              borderWidth: 1,
              borderColor: t.border,
              shadowColor: "#000",
              shadowOpacity: 0.14,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: -8 },
              elevation: 16,
              transform: [{ translateY }],
            }}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View
                style={{
                  alignItems: "center",
                  marginBottom: 14,
                  paddingTop: 2,
                  paddingBottom: 6,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 5,
                    borderRadius: 999,
                    backgroundColor: t.border,
                  }}
                />
              </View>

              <View
                style={{
                  marginBottom: 16,
                  position: "relative",
                  paddingRight: showCloseButton ? 40 : 0,
                }}
              >
                {showCloseButton ? (
                  <TouchableOpacity
                    onPress={() => closeAnimated()}
                    hitSlop={10}
                    activeOpacity={0.7}
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 0,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: t.cardAlt,
                      borderWidth: 1,
                      borderColor: t.border,
                    }}
                  >
                    <Ionicons name="close" size={18} color={t.mutedText} />
                  </TouchableOpacity>
                ) : null}

                <Text
                  style={{
                    color: t.text,
                    fontSize: 28,
                    fontWeight: "800",
                    letterSpacing: -0.7,
                  }}
                >
                  {title}
                </Text>

                {!!subtitle && (
                  <Text style={{ color: t.mutedText, marginTop: 6, lineHeight: 20, fontSize: 14 }}>
                    {subtitle}
                  </Text>
                )}
              </View>

              {children}
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
