import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  Easing,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Toast from "react-native-toast-message";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { formatDistanceToNow } from "date-fns";

import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { useIsOnline } from "@/hooks/use-is-online";
import { cacheGetJson, cacheKey, cacheSetJson } from "@/src/lib/offline-cache";
import {
  normalizeUsername,
  validateUsername,
  useUsernameAvailability,
} from "@/src/hooks/use-username-availability";
import OnboardingBanner from "@/src/components/OnboardingBanner";
import {
  getOnboardingStep,
  isOnboardingActive,
  setOnboardingStep,
  stopOnboarding,
} from "@/src/lib/onboarding";
import { publishActiveProgram, type Program as StoreProgram } from "@/src/store/active-program";

type Program = {
  id: string;
  name: string;
  is_active: boolean | null;
  user_id: string;
  created_at: string | null;
};

function normalizeProgram(program: Partial<Program> & { id: string; name: string }): Program {
  return {
    id: program.id,
    name: program.name,
    is_active: program.is_active ?? false,
    user_id: program.user_id ?? "",
    created_at: program.created_at ?? null,
  };
}

type Split = {
  id: string;
  name: string;
  program_id: string;
  order_index: number;
  user_id?: string;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type PendingShare = {
  id: string;
  status: string;
  created_at: string | null;
  program_name: string;
  sender_username: string | null;
};

type SentShare = {
  id: string;
  status: string;
  created_at: string | null;
  program_name: string;
  receiver_username: string | null;
};

type AppNotice = {
  id: string;
  title: string;
  message: string;
  kind: "update" | "info" | string;
  created_at?: string | null;
};

type ProgramImport = {
  program_id: string;
  shared_by_user_id: string | null;
  shared_by_username: string | null;
};

type ShareSearchResult = {
  id: string;
  username: string;
  display_name?: string | null;
};

type ShareSearchStatus = "idle" | "searching" | "found" | "not_found";

type AcceptShareRpcResponse = {
  share_id: string;
  imported_program_id: string;
  import_id: string;
};

type RawShareRow = {
  id: string;
  status: string;
  created_at: string | null;
  program_id: string;
  shared_by_user_id: string;
  shared_with_user_id: string;
};

type RawImportRow = {
  program_id: string;
  shared_by_user_id: string | null;
};

const CACHE_VERSION = "profile-v4";
const AVATAR_BUCKET = "avatars";
const SHARE_SEARCH_DEBOUNCE_MS = 350;
const BIO_MAX_LENGTH = 160;
const IS_IOS = Platform.OS === "ios";

type ThemeType = ReturnType<typeof useAppTheme>;


if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const safeHaptics = {
  async selection() {
    try {
      const Haptics = await import("expo-haptics");
      await Haptics.selectionAsync();
    } catch { }
  },
  async impact(style: "light" | "medium" | "heavy" = "light") {
    try {
      const Haptics = await import("expo-haptics");
      const map = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      };
      await Haptics.impactAsync(map[style]);
    } catch { }
  },
  async notify(type: "success" | "warning" | "error" = "success") {
    try {
      const Haptics = await import("expo-haptics");
      const map = {
        success: Haptics.NotificationFeedbackType.Success,
        warning: Haptics.NotificationFeedbackType.Warning,
        error: Haptics.NotificationFeedbackType.Error,
      };
      await Haptics.notificationAsync(map[type]);
    } catch { }
  },
};

function InlineActions({
  onShare,
  onEdit,
  onDelete,
  border,
  card,
  mutedText,
}: {
  onShare?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  border: string;
  card: string;
  mutedText: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginLeft: 10,
      }}
    >
      {onShare ? (
        <TouchableOpacity
          onPress={onShare}
          hitSlop={10}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: border,
            backgroundColor: card,
          }}
        >
          <Ionicons name="share-social-outline" size={16} color={mutedText} />
        </TouchableOpacity>
      ) : null}

      {onEdit ? (
        <TouchableOpacity
          onPress={onEdit}
          hitSlop={10}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: border,
            backgroundColor: card,
          }}
        >
          <Ionicons name="create-outline" size={16} color={mutedText} />
        </TouchableOpacity>
      ) : null}

      {onDelete ? (
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={10}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: border,
            backgroundColor: card,
          }}
        >
          <Ionicons name="trash-outline" size={16} color="#ff453a" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function SectionShell({
  children,
  t,
  padding = 18,
}: {
  children: React.ReactNode;
  t: any;
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

function SectionHeader({
  title,
  subtitle,
  action,
  t,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  t: any;
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

function GlassPill({
  label,
  icon,
  onPress,
  count,
  t,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  count?: number;
  t: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.cardAlt,
        paddingHorizontal: 15,
        paddingVertical: 11,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Ionicons name={icon} size={16} color={t.text} />
      <Text style={{ color: t.text, fontWeight: "700", fontSize: 14.5 }}>
        {label}
        {typeof count === "number" && count > 0 ? ` (${count})` : ""}
      </Text>
    </TouchableOpacity>
  );
}


function EmptyStateCard({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  t,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  t: any;
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
          activeOpacity={0.82}
          style={{
            marginTop: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 14,
            backgroundColor: t.link,
          }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function MiniStatCard({
  label,
  value,
  icon,
  t,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  t: any;
}) {
  return (
    <View
      style={{
        minWidth: "47%",
        flex: 1,
        backgroundColor: t.cardAlt,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: t.border,
        padding: 14,
      }}
    >
      <Ionicons name={icon} size={16} color={t.mutedText} />
      <Text style={{ color: t.text, fontSize: 20, fontWeight: "800", marginTop: 10 }}>
        {value}
      </Text>
      <Text style={{ color: t.mutedText, marginTop: 4, fontSize: 12.5 }}>{label}</Text>
    </View>
  );
}

function SubsectionLabel({ label, t }: { label: string; t: any }) {
  return (
    <Text
      style={{
        color: t.mutedText,
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 0.45,
        textTransform: "uppercase",
        marginBottom: 10,
      }}
    >
      {label}
    </Text>
  );
}

function NotificationRow({
  item,
  t,
}: {
  item: { title: string; message: string; kind: "update" | "share" | "info" };
  t: any;
}) {
  const iconName =
    item.kind === "update"
      ? "sparkles-outline"
      : item.kind === "share"
        ? "share-social-outline"
        : "information-circle-outline";

  return (
    <View
      style={{
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
        flexDirection: "row",
        alignItems: "flex-start",
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: t.cardAlt,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
          borderWidth: 1,
          borderColor: t.border,
        }}
      >
        <Ionicons name={iconName as any} size={18} color={t.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 15 }}>{item.title}</Text>
        <Text style={{ color: t.mutedText, marginTop: 4, lineHeight: 19 }}>{item.message}</Text>
      </View>
    </View>
  );
}

function FancyModalShell({
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
  t: any;
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

  const closeAnimated = useCallback((velocity = 1.9) => {
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
  }, [backdropOpacity, onClose, translateY]);

  const resetSheetPosition = useCallback((velocity = 0) => {
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
  }, [translateY]);

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

function AvatarCircle({
  size,
  profile,
  initials,
  avatarRing,
  textColor,
}: {
  size: number;
  profile: Profile | null;
  initials: string;
  avatarRing: { borderColor: string; outerBg: string; innerBg: string; shadowColor: string };
  textColor: string;
}) {
  const outerRadius = size / 2;
  const ringWidth = 2;
  const ringGap = 3;
  const innerSize = Math.max(size - (ringWidth + ringGap) * 2, 0);
  const innerRadius = innerSize / 2;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: outerRadius,
        padding: ringGap,
        backgroundColor: avatarRing.outerBg,
        borderWidth: ringWidth,
        borderColor: avatarRing.borderColor,
        overflow: "hidden",
        shadowColor: avatarRing.shadowColor,
        shadowOpacity: 0.16,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <View
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: innerRadius,
          backgroundColor: avatarRing.innerBg,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {profile?.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={{ width: "100%", height: "100%", borderRadius: innerRadius }}
            resizeMode="cover"
          />
        ) : (
          <Text style={{ color: textColor, fontWeight: "800", fontSize: size * 0.28 }}>
            {initials}
          </Text>
        )}
      </View>
    </View>
  );
}

const getInitials = (profile: Profile | null) => {
  const source = profile?.display_name?.trim() || profile?.username?.trim() || "U";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
};

function fileExtFromName(name?: string | null) {
  if (!name || !name.includes(".")) return "jpg";
  return name.split(".").pop()?.toLowerCase() || "jpg";
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "Just now";
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return "Just now";
  }
}

function getStatusTone(status: string, t: any) {
  if (status === "accepted") {
    return { bg: "rgba(48,209,88,0.12)", border: "rgba(48,209,88,0.28)", text: "#30d158" };
  }
  if (status === "declined") {
    return { bg: "rgba(255,69,58,0.12)", border: "rgba(255,69,58,0.28)", text: "#ff453a" };
  }
  return { bg: t.cardAlt, border: t.border, text: t.text };
}

function getProgramAccent(seed: number | string) {
  const accents = [
    { bg: "rgba(10,132,255,0.12)", text: "#0a84ff" },
    { bg: "rgba(94,92,230,0.12)", text: "#5e5ce6" },
    { bg: "rgba(255,159,10,0.12)", text: "#ff9f0a" },
    { bg: "rgba(48,209,88,0.12)", text: "#30d158" },
    { bg: "rgba(191,90,242,0.12)", text: "#bf5af2" },
  ];

  const hash = typeof seed === "number"
    ? seed
    : Array.from(seed).reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 7);

  return accents[Math.abs(hash) % accents.length];
}

function getProgramInitials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return "P";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

function normalizeSplitOrder(items: Split[]): Split[] {
  return items.map((item, index) => ({ ...item, order_index: index }));
}


type SplitRowProps = {
  item: Split;
  displayOrder: number;
  isActive: boolean;
  busy: boolean;
  t: ThemeType;
  activeProgramName: string;
  onDrag: () => void;
  onEditItem: (item: Split) => void;
  onDeleteItem: (id: string, type: "program" | "split") => void;
};

const SplitRow = React.memo(function SplitRow({
  item,
  displayOrder,
  isActive,
  busy,
  t,
  activeProgramName,
  onDrag,
  onEditItem,
  onDeleteItem,
}: SplitRowProps) {
  const splitAccent = useMemo(() => getProgramAccent(displayOrder), [displayOrder]);
  const handleEdit = useCallback(() => onEditItem(item), [item, onEditItem]);
  const handleDelete = useCallback(() => onDeleteItem(item.id, "split"), [item.id, onDeleteItem]);

  return (
    <ScaleDecorator>
      <TouchableOpacity
        onLongPress={onDrag}
        delayLongPress={180}
        disabled={busy}
        activeOpacity={0.88}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 20,
          marginBottom: 10,
          backgroundColor: isActive ? t.cardAlt : t.card,
          borderWidth: 1,
          borderColor: isActive ? t.link : t.border,
          shadowColor: "#000",
          shadowOpacity: isActive ? 0.1 : 0.05,
          shadowRadius: isActive ? 18 : 10,
          shadowOffset: { width: 0, height: isActive ? 10 : 6 },
          elevation: isActive ? 3 : 1,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 8 }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: splitAccent.bg,
              marginRight: 12,
            }}
          >
            <Text style={{ color: splitAccent.text, fontWeight: "800", fontSize: 13 }}>
              {String(displayOrder + 1).padStart(2, "0")}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
              {item.name}
            </Text>

            <Text style={{ color: t.mutedText, marginTop: 5, fontSize: 12.5 }}>
              Split {displayOrder + 1} in {activeProgramName}
            </Text>

            <Text style={{ color: t.mutedText, marginTop: 4, fontSize: 12.5 }}>
              Ready for training • Long press and drag to reorder
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.cardAlt,
              borderWidth: 1,
              borderColor: t.border,
            }}
          >
            <Ionicons name="reorder-three-outline" size={18} color={t.mutedText} />
          </View>

          {IS_IOS && (
            <InlineActions
              onEdit={handleEdit}
              onDelete={handleDelete}
              border={t.border}
              card={t.card}
              mutedText={t.mutedText}
            />
          )}
        </View>
      </TouchableOpacity>
    </ScaleDecorator>
  );
}, (prev, next) => (
  prev.item.id === next.item.id &&
  prev.item.name === next.item.name &&
  prev.item.order_index === next.item.order_index &&
  prev.displayOrder === next.displayOrder &&
  prev.isActive === next.isActive &&
  prev.busy === next.busy &&
  prev.activeProgramName === next.activeProgramName &&
  prev.t === next.t &&
  prev.onDrag === next.onDrag &&
  prev.onEditItem === next.onEditItem &&
  prev.onDeleteItem === next.onDeleteItem
));

export default function ProfileScreen() {
  const t = useAppTheme();
  const isOnline = useIsOnline();
  const router = useRouter();

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState<string>("idle");
  const [tutorialProgramId, setTutorialProgramId] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [programsExpanded, setProgramsExpanded] = useState(false);
  const [splitsExpanded, setSplitsExpanded] = useState(false);

  const [pendingShares, setPendingShares] = useState<PendingShare[]>([]);
  const [sentShares, setSentShares] = useState<SentShare[]>([]);
  const [appNotices, setAppNotices] = useState<AppNotice[]>([]);
  const [programImports, setProgramImports] = useState<Record<string, ProgramImport>>({});

  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [programSearch, setProgramSearch] = useState("");
  const [programFilter, setProgramFilter] = useState<"all" | "own" | "imported">("all");
  const [programSort, setProgramSort] = useState<"active" | "newest" | "name">("active");
  const [splitCountsByProgram, setSplitCountsByProgram] = useState<Record<string, number>>({});

  const [modal, setModal] = useState<{
    visible: boolean;
    type: "program" | "split";
    value: string;
    mode: "create" | "rename";
    targetId: string | null;
  }>({
    visible: false,
    type: "program",
    value: "",
    mode: "create",
    targetId: null,
  });

  const [profileSheetVisible, setProfileSheetVisible] = useState(false);
  const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [splitDragActive, setSplitDragActive] = useState(false);
  const [sharedVisible, setSharedVisible] = useState(false);

  const [bioValue, setBioValue] = useState("");
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null);
  const [usernameTyping, setUsernameTyping] = useState(false);
  const [settledUsernameState, setSettledUsernameState] = useState<{
    normalized: string;
    status: "available" | "taken" | "invalid";
    message: string | null;
  } | null>(null);

  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareProgram, setShareProgram] = useState<Program | null>(null);
  const [shareSearch, setShareSearch] = useState("");
  const [shareResults, setShareResults] = useState<ShareSearchResult[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareSearchStatus, setShareSearchStatus] = useState<ShareSearchStatus>("idle");
  const [shareSearchError, setShareSearchError] = useState<string | null>(null);

  const programsRef = useRef<Program[]>([]);
  const splitsRef = useRef<Split[]>([]);
  const shareSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    programsRef.current = programs;
  }, [programs]);

  useEffect(() => {
    splitsRef.current = splits;
  }, [splits]);

  useEffect(() => {
    return () => {
      if (usernameTypingTimeoutRef.current) {
        clearTimeout(usernameTypingTimeoutRef.current);
      }
    };
  }, []);

  const programsReqId = useRef(0);
  const splitsReqId = useRef(0);
  const shareSearchReqId = useRef(0);

  const cacheId = useMemo(() => (userId ? cacheKey([CACHE_VERSION, userId]) : null), [userId]);
  const avatarInitials = useMemo(() => getInitials(profile), [profile]);
  const activeProgram = useMemo(
    () => programs.find((p) => p.id === activeProgramId) ?? null,
    [programs, activeProgramId]
  );
  const canSharePrograms = !!profile?.username;
  const trimmedBio = useMemo(() => profile?.bio?.trim() ?? "", [profile?.bio]);
  const bioPreview = useMemo(() => {
    if (!trimmedBio) return null;
    return trimmedBio.length > 96 ? `${trimmedBio.slice(0, 96).trimEnd()}…` : trimmedBio;
  }, [trimmedBio]);

  const {
    value: usernameValue,
    setValue: setUsernameValue,
    normalizedValue: normalizedUsername,
    validationError: liveUsernameValidationError,
    status: usernameStatus,
    statusMessage: usernameStatusMessage,
    isChecking: usernameChecking,
    checkAvailabilityNow,
    reset: resetUsernameState,
  } = useUsernameAvailability({
    initialUsername: profile?.username,
    userId,
    debounceMs: 350,
  });

  const currentUsernameNormalized = useMemo(
    () => normalizeUsername(profile?.username ?? ""),
    [profile?.username]
  );

  const usernameHasChanged = normalizedUsername !== currentUsernameNormalized;

  useEffect(() => {
    if (!usernameHasChanged || liveUsernameValidationError) {
      setSettledUsernameState(null);
      return;
    }

    if (!usernameChecking && (usernameStatus === "available" || usernameStatus === "taken" || usernameStatus === "invalid")) {
      const stableMessage =
        usernameStatus === "available"
          ? "Username is available"
          : usernameStatus === "taken"
            ? "Username is not available"
            : usernameStatusMessage ?? "Invalid username";

      setSettledUsernameState({
        normalized: normalizedUsername,
        status: usernameStatus,
        message: stableMessage,
      });
    }
  }, [
    liveUsernameValidationError,
    normalizedUsername,
    usernameChecking,
    usernameHasChanged,
    usernameStatus,
    usernameStatusMessage,
  ]);

  const settledUsernameForCurrent = useMemo(() => {
    if (!settledUsernameState) return null;
    return settledUsernameState.normalized === normalizedUsername ? settledUsernameState : null;
  }, [normalizedUsername, settledUsernameState]);

  const usernameFieldState = useMemo(() => {
    if (usernameError) {
      return { color: "#ff453a", icon: "close-circle" as const, text: usernameError, loading: false };
    }

    if (!usernameHasChanged) {
      return {
        color: t.mutedText,
        icon: "information-circle-outline" as const,
        text: "Use 3–20 lowercase letters, numbers, or underscores.",
        loading: false,
      };
    }

    if (usernameBusy) {
      return {
        color: t.mutedText,
        icon: "time-outline" as const,
        text: "Saving profile…",
        loading: false,
      };
    }

    if (usernameTyping) {
      return {
        color: t.mutedText,
        icon: "time-outline" as const,
        text: "Checking username…",
        loading: true,
      };
    }

    if (liveUsernameValidationError) {
      return {
        color: "#ff453a",
        icon: "close-circle" as const,
        text: liveUsernameValidationError,
        loading: false,
      };
    }

    if (settledUsernameForCurrent?.status === "available") {
      return {
        color: "#30d158",
        icon: "checkmark-circle" as const,
        text: "Username is available",
        loading: false,
      };
    }

    if (settledUsernameForCurrent?.status === "taken" || settledUsernameForCurrent?.status === "invalid") {
      return {
        color: "#ff453a",
        icon: "close-circle" as const,
        text:
          settledUsernameForCurrent.status === "taken"
            ? "Username is not available"
            : settledUsernameForCurrent.message ?? "Invalid username",
        loading: false,
      };
    }

    if (usernameChecking) {
      return {
        color: t.mutedText,
        icon: "time-outline" as const,
        text: "Checking username…",
        loading: true,
      };
    }

    return {
      color: t.mutedText,
      icon: "information-circle-outline" as const,
      text: "Use 3–20 lowercase letters, numbers, or underscores.",
      loading: false,
    };
  }, [
    liveUsernameValidationError,
    settledUsernameForCurrent,
    t.mutedText,
    usernameBusy,
    usernameChecking,
    usernameError,
    usernameHasChanged,
    usernameTyping,
  ]);


  const avatarRing = useMemo(() => {
    const dark = t.background === "#000000" || t.background === "#0b0b0c";
    return {
      borderColor: dark ? "rgba(120,180,255,0.9)" : "rgba(10,132,255,0.62)",
      outerBg: "transparent",
      innerBg: t.cardAlt,
      shadowColor: dark ? "rgba(120,180,255,0.4)" : "rgba(10,132,255,0.18)",
    };
  }, [t.background, t.cardAlt]);


  const notificationItems = useMemo(() => {
    const items: {
      id: string;
      title: string;
      message: string;
      kind: "update" | "share" | "info";
    }[] = [];

    pendingShares.forEach((share) => {
      items.push({
        id: `share-${share.id}`,
        title: "New shared program",
        message: `@${share.sender_username ?? "user"} shared "${share.program_name}"`,
        kind: "share",
      });
    });

    appNotices.forEach((notice) => {
      items.push({
        id: `notice-${notice.id}`,
        title: notice.title,
        message: notice.message,
        kind: notice.kind === "update" ? "update" : "info",
      });
    });

    return items;
  }, [appNotices, pendingShares]);

  const notificationSections = useMemo(() => {
    const shares = notificationItems.filter((item) => item.kind === "share");
    const updates = notificationItems.filter((item) => item.kind === "update");
    const info = notificationItems.filter((item) => item.kind === "info");

    return [
      { key: "shares", title: "Shares", items: shares },
      { key: "updates", title: "Updates", items: updates },
      { key: "info", title: "Announcements", items: info },
    ].filter((section) => section.items.length > 0);
  }, [notificationItems]);

  const importedPrograms = useMemo(() => {
    return programs
      .filter((p) => !!programImports[p.id])
      .map((p) => ({
        ...p,
        shared_by_username: programImports[p.id]?.shared_by_username ?? null,
      }));
  }, [programs, programImports]);


  const stats = useMemo(() => {
    const importedCount = programs.filter((p) => !!programImports[p.id]).length;
    const totalSplits = Object.values(splitCountsByProgram).reduce((sum, count) => sum + count, 0);
    return {
      totalPrograms: programs.length,
      totalSplits,
      importedPrograms: importedCount,
      pendingShares: pendingShares.length,
    };
  }, [programs, programImports, splitCountsByProgram, pendingShares.length]);

  const activeProgramSummary = activeProgram
    ? `${activeProgram.name} · ${splitCountsByProgram[activeProgram.id] ?? 0} ${(splitCountsByProgram[activeProgram.id] ?? 0) === 1 ? "split" : "splits"}`
    : "No active program selected";
  const hasPrograms = programs.length > 0;
  const hasSplits = splits.length > 0;
  const activeProgramName = activeProgram?.name ?? "program";
  const splitListContainerStyle = useMemo(
    () => ({
      flexGrow: 0,
      overflow: "visible" as const,
    }),
    []
  );
  const splitListContentContainerStyle = useMemo(
    () => ({
      paddingBottom: 2,
    }),
    []
  );
  const profileListContentContainerStyle = useMemo(
    () => ({
      paddingBottom: 28,
      flexGrow: 1,
    }),
    []
  );

  const filteredPrograms = useMemo(() => {
    if (!programsExpanded) return programs;

    const query = programSearch.trim().toLowerCase();

    let next = programs.filter((program) => {
      const matchesSearch = !query || program.name.toLowerCase().includes(query);
      const isImported = !!programImports[program.id];
      const matchesFilter =
        programFilter === "all"
          ? true
          : programFilter === "imported"
            ? isImported
            : !isImported;

      return matchesSearch && matchesFilter;
    });

    next = [...next].sort((a, b) => {
      if (programSort === "name") return a.name.localeCompare(b.name);
      if (programSort === "newest") {
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      }

      if (a.id === activeProgramId) return -1;
      if (b.id === activeProgramId) return 1;
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });

    return next;
  }, [programsExpanded, programs, programSearch, programFilter, programSort, programImports, activeProgramId]);

  const shareInputBorderColor = useMemo(() => {
    if (shareSearchStatus === "found") return "#30d158";
    if (shareSearchStatus === "not_found") return "#ff453a";
    return t.inputBorder;
  }, [shareSearchStatus, t.inputBorder]);

  const exactMatchedUser = useMemo(() => {
    const normalized = normalizeUsername(shareSearch);
    if (!normalized) return null;
    return shareResults.find((user) => user.username === normalized) ?? null;
  }, [shareResults, shareSearch]);

  const toggleProgramsExpanded = useCallback(async () => {
    await safeHaptics.selection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setProgramsExpanded((prev) => !prev);
  }, []);

  const toggleSplitsExpanded = useCallback(async () => {
    await safeHaptics.selection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSplitsExpanded((prev) => !prev);
  }, []);

  const closeModal = useCallback(() => {
    setModal((prev) => ({
      ...prev,
      visible: false,
      value: "",
      mode: "create",
      targetId: null,
    }));
  }, []);

  const openCreateProgram = useCallback(() => {
    void setOnboardingStep("create_program");
    setTourStep("create_program");
    setProgramsExpanded(true);
    setModal({ visible: true, type: "program", value: "", mode: "create", targetId: null });
  }, []);

  const openCreateSplit = useCallback(() => {
    void setOnboardingStep("create_split");
    setTourStep("create_split");
    setModal({ visible: true, type: "split", value: "", mode: "create", targetId: null });
  }, []);

  const openRename = useCallback((item: Program | Split, type: "program" | "split") => {
    setModal({ visible: true, type, value: item.name, mode: "rename", targetId: item.id });
  }, []);

  const openProfileSheet = useCallback(() => {
    resetUsernameState(profile?.username ?? "");
    setBioValue(profile?.bio ?? "");
    setUsernameError(null);
    setUsernameSuccess(null);
    setUsernameTyping(false);
    setSettledUsernameState(null);
    setProfileSheetVisible(true);
  }, [profile?.username, profile?.bio, resetUsernameState]);

  const openAvatarPreview = useCallback(() => {
    setAvatarPreviewVisible(true);
  }, []);

  const closeAvatarPreview = useCallback(() => {
    setAvatarPreviewVisible(false);
  }, []);

  const closeProfileSheet = useCallback(() => {
    if (usernameBusy || avatarBusy) return;
    setProfileSheetVisible(false);
    setUsernameError(null);
    setUsernameSuccess(null);
    setUsernameTyping(false);
  }, [usernameBusy, avatarBusy]);

  const resetShareUi = useCallback(() => {
    if (shareSearchTimeoutRef.current) {
      clearTimeout(shareSearchTimeoutRef.current);
      shareSearchTimeoutRef.current = null;
    }

    setShareModalVisible(false);
    setShareProgram(null);
    setShareSearch("");
    setShareResults([]);
    setShareMessage(null);
    setShareSearchStatus("idle");
    setShareSearchError(null);
  }, []);

  const openShareModal = useCallback(
    (program: Program) => {
      if (!profile?.username) {
        Alert.alert(
          "Create a username first",
          "You need a username before sharing programs with other users."
        );
        openProfileSheet();
        return;
      }

      setShareProgram(program);
      setShareSearch("");
      setShareResults([]);
      setShareMessage(null);
      setShareSearchStatus("idle");
      setShareSearchError(null);
      setShareModalVisible(true);
    },
    [profile?.username, openProfileSheet]
  );

  const closeShareModal = useCallback(() => {
    if (shareBusy) return;
    resetShareUi();
  }, [shareBusy, resetShareUi]);

  const fetchUsernamesByIds = useCallback(async (ids: string[]) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length) return new Map<string, string | null>();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", uniqueIds);

    if (error) {
      console.log("fetchUsernamesByIds error:", error);
      return new Map<string, string | null>();
    }

    return new Map<string, string | null>(
      (data ?? []).map((item: any) => [item.id, item.username ?? null])
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadTour = async () => {
        const active = await isOnboardingActive();
        const step = await getOnboardingStep();

        if (!mounted) return;

        setTourActive(active);
        setTourStep(typeof step === "string" ? step : "idle");
      };

      void loadTour();

      return () => {
        mounted = false;
      };
    }, [])
  );

  useEffect(() => {
    if (canSharePrograms) return;
    setSharedVisible(false);
    resetShareUi();
  }, [canSharePrograms, resetShareUi]);

  useEffect(() => {
    return () => {
      if (shareSearchTimeoutRef.current) {
        clearTimeout(shareSearchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error) {
        console.log("getUser error:", error);
        return;
      }
      setUserId(data?.user?.id ?? null);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.log("fetchProfile error:", error);
      return;
    }

    setProfile((data as Profile | null) ?? null);
  }, [userId]);

  const fetchPendingShares = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("program_shares")
      .select("id, status, created_at, program_id, shared_by_user_id, shared_with_user_id")
      .eq("shared_with_user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("fetchPendingShares error:", error);
      return;
    }

    const rows = (data ?? []) as RawShareRow[];
    const usernameMap = await fetchUsernamesByIds(rows.map((row) => row.shared_by_user_id));

    const mapped: PendingShare[] = rows.map((item) => ({
      id: item.id,
      status: item.status,
      created_at: item.created_at,
      program_name: "Shared Program",
      sender_username: usernameMap.get(item.shared_by_user_id) ?? null,
    }));

    setPendingShares(mapped);
  }, [userId, fetchUsernamesByIds]);

  const fetchSentShares = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("program_shares")
      .select("id, status, created_at, program_id, shared_by_user_id, shared_with_user_id")
      .eq("shared_by_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.log("fetchSentShares error:", error);
      return;
    }

    const rows = (data ?? []) as RawShareRow[];
    const receiverMap = await fetchUsernamesByIds(rows.map((row) => row.shared_with_user_id));
    const ownProgramNameMap = new Map(programsRef.current.map((p) => [p.id, p.name]));

    const mapped: SentShare[] = rows.map((item) => ({
      id: item.id,
      status: item.status,
      created_at: item.created_at,
      program_name: ownProgramNameMap.get(item.program_id) ?? "Program",
      receiver_username: receiverMap.get(item.shared_with_user_id) ?? null,
    }));

    setSentShares(mapped);
  }, [userId, fetchUsernamesByIds]);

  const fetchAppNotices = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("app_notices")
      .select("id, title, message, kind, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.log("fetchAppNotices skipped/error:", error.message);
      setAppNotices([]);
      return;
    }

    setAppNotices((data ?? []) as AppNotice[]);
  }, [userId]);

  const fetchProgramImports = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("program_imports")
      .select("program_id, shared_by_user_id")
      .eq("imported_by_user_id", userId);

    if (error) {
      console.log("fetchProgramImports error:", error);
      return;
    }

    const rows = (data ?? []) as RawImportRow[];
    const usernameMap = await fetchUsernamesByIds(
      rows.map((row) => row.shared_by_user_id).filter(Boolean) as string[]
    );

    const mapped: Record<string, ProgramImport> = {};

    rows.forEach((item) => {
      mapped[item.program_id] = {
        program_id: item.program_id,
        shared_by_user_id: item.shared_by_user_id,
        shared_by_username: item.shared_by_user_id
          ? usernameMap.get(item.shared_by_user_id) ?? null
          : null,
      };
    });

    setProgramImports(mapped);
  }, [userId, fetchUsernamesByIds]);

  const fetchSplitCounts = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("splits")
      .select("id, program_id")
      .eq("user_id", userId);

    if (error) {
      console.log("fetchSplitCounts error:", error);
      return;
    }

    const nextCounts: Record<string, number> = {};
    (data ?? []).forEach((item: any) => {
      const key = item.program_id as string;
      nextCounts[key] = (nextCounts[key] ?? 0) + 1;
    });

    setSplitCountsByProgram(nextCounts);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchProfile();
    fetchPendingShares();
    fetchSentShares();
    fetchAppNotices();
    fetchProgramImports();
    fetchSplitCounts();
  }, [userId, fetchProfile, fetchPendingShares, fetchSentShares, fetchAppNotices, fetchProgramImports, fetchSplitCounts]);

  const fetchPrograms = useCallback(async () => {
    if (!userId) return;
    if (!isOnline && programsRef.current.length > 0) return;

    const rid = ++programsReqId.current;

    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (rid !== programsReqId.current) return;

    if (error) {
      console.log("fetchPrograms error:", error);
      return;
    }

    const list = ((data ?? []) as any[]).map((item) => normalizeProgram(item));
    setPrograms(list);

    setActiveProgramId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev;
      const dbActive = list.find((p) => p.is_active)?.id ?? null;
      if (dbActive) return dbActive;
      return list.length ? list[0].id : null;
    });
  }, [userId, isOnline]);

  const fetchSplits = useCallback(
    async (programId: string) => {
      if (!userId || !programId) return;
      if (!isOnline && splitsRef.current.length > 0) return;

      const rid = ++splitsReqId.current;

      const { data, error } = await supabase
        .from("splits")
        .select("*")
        .eq("user_id", userId)
        .eq("program_id", programId)
        .order("order_index");

      if (rid !== splitsReqId.current) return;

      if (error) {
        console.log("fetchSplits error:", error);
        return;
      }

      setSplits(normalizeSplitOrder((data ?? []) as Split[]));
    },
    [userId, isOnline]
  );

  const handleRefresh = useCallback(async () => {
    if (!userId) return;

    try {
      setRefreshing(true);
      await Promise.all([
        fetchProfile(),
        fetchPendingShares(),
        fetchSentShares(),
        fetchAppNotices(),
        fetchProgramImports(),
        fetchPrograms(),
        fetchSplitCounts(),
        activeProgramId ? fetchSplits(activeProgramId) : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    userId,
    activeProgramId,
    fetchAppNotices,
    fetchPendingShares,
    fetchProfile,
    fetchProgramImports,
    fetchPrograms,
    fetchSentShares,
    fetchSplitCounts,
    fetchSplits,
  ]);

  useEffect(() => {
    if (!userId || !cacheId) return;

    let mounted = true;
    (async () => {
      const cached = await cacheGetJson<{
        programs: Program[];
        splitsByProgram: Record<string, Split[]>;
        activeProgramId: string | null;
      }>(cacheId);

      if (!mounted) return;

      if (cached?.programs?.length) setPrograms(cached.programs);
      if (cached?.activeProgramId) setActiveProgramId(cached.activeProgramId);

      if (cached?.activeProgramId && cached?.splitsByProgram?.[cached.activeProgramId]) {
        setSplits(cached.splitsByProgram[cached.activeProgramId]);
      }

      await fetchPrograms();
    })();

    return () => {
      mounted = false;
    };
  }, [userId, cacheId, fetchPrograms]);

  useEffect(() => {
    if (!userId) return;

    splitsReqId.current += 1;

    if (!activeProgramId) {
      setSplits([]);
      return;
    }

    fetchSplits(activeProgramId);
  }, [userId, activeProgramId, fetchSplits]);

  useEffect(() => {
    if (!userId || !cacheId) return;

    (async () => {
      if (programs.length === 0) {
        await cacheSetJson(cacheId, { programs: [], splitsByProgram: {}, activeProgramId: null });
        return;
      }

      const existing = (await cacheGetJson<any>(cacheId)) ?? {};
      const splitsByProgram = { ...(existing.splitsByProgram ?? {}) };

      if (activeProgramId) splitsByProgram[activeProgramId] = splits;

      await cacheSetJson(cacheId, { programs, splitsByProgram, activeProgramId });
    })();
  }, [userId, cacheId, programs, splits, activeProgramId]);

  useEffect(() => {
    if (!userId) return;
    fetchSentShares();
  }, [programs, userId, fetchSentShares]);

  const handlePickAvatar = useCallback(async () => {
    if (!userId) return;

    try {
      setAvatarBusy(true);

      let ImagePicker: typeof import("expo-image-picker");
      try {
        ImagePicker = await import("expo-image-picker");
      } catch (importError) {
        console.log("expo-image-picker import error:", importError);
        Alert.alert(
          "Image picker unavailable",
          "expo-image-picker is not available in this build. Install it and rebuild the app."
        );
        return;
      }

      if (typeof ImagePicker.requestMediaLibraryPermissionsAsync !== "function") {
        Alert.alert(
          "Image picker unavailable",
          "This build does not include expo-image-picker correctly. Reinstall the package and rebuild the app."
        );
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission needed", "Allow photo library access to choose an avatar.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const ext = fileExtFromName(asset.fileName);
      const path = `${userId}/${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, arrayBuffer, {
          contentType: asset.mimeType ?? "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const avatarUrl = publicData.publicUrl;

      const { data, error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", userId)
        .select("id, username, display_name, avatar_url, bio")
        .single();

      if (error) throw error;

      setProfile(data as Profile);
      await safeHaptics.notify("success");
    } catch (e: any) {
      console.log("handlePickAvatar error:", e);
      Alert.alert(
        "Avatar update failed",
        e?.message ??
        "Could not update avatar. This feature needs expo-image-picker and a rebuilt native app."
      );
    } finally {
      setAvatarBusy(false);
    }
  }, [userId]);

  const handleRemoveAvatar = useCallback(async () => {
    if (!userId) return;

    try {
      setAvatarBusy(true);

      const { data, error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId)
        .select("id, username, display_name, avatar_url, bio")
        .single();

      if (error) throw error;

      setProfile(data as Profile);
      await safeHaptics.impact("light");
    } catch (e: any) {
      console.log("handleRemoveAvatar error:", e);
      Alert.alert("Could not remove avatar", e?.message ?? "Unknown error");
    } finally {
      setAvatarBusy(false);
    }
  }, [userId]);

  const runUserSearch = useCallback(
    async (rawQuery: string) => {
      const clean = normalizeUsername(rawQuery);
      const rid = ++shareSearchReqId.current;

      if (!clean || clean.length < 2) {
        setShareResults([]);
        setShareSearchStatus("idle");
        setShareSearchError(null);
        return;
      }

      setShareSearchStatus("searching");
      setShareSearchError(null);

      const { data, error } = await supabase.rpc("search_profiles_by_username", { q: clean });

      if (rid !== shareSearchReqId.current) return;

      if (error) {
        console.log("searchUsers error:", error);
        setShareResults([]);
        setShareSearchStatus("not_found");
        setShareSearchError("Could not search users");
        return;
      }

      const filtered = ((data ?? []) as ShareSearchResult[]).filter((item) => item.id !== userId);

      setShareResults(filtered);

      const exactMatch = filtered.some((item) => item.username === clean);

      if (exactMatch) {
        setShareSearchStatus("found");
        setShareSearchError(null);
        return;
      }

      setShareSearchStatus("not_found");
      setShareSearchError("User does not exist");
    },
    [userId]
  );

  const searchUsers = useCallback(
    (q: string) => {
      const clean = normalizeUsername(q);

      setShareSearch(clean);
      setShareMessage(null);

      if (shareSearchTimeoutRef.current) {
        clearTimeout(shareSearchTimeoutRef.current);
      }

      if (!clean || clean.length < 2) {
        setShareResults([]);
        setShareSearchStatus("idle");
        setShareSearchError(null);
        return;
      }

      shareSearchTimeoutRef.current = setTimeout(() => {
        runUserSearch(clean);
      }, SHARE_SEARCH_DEBOUNCE_MS);
    },
    [runUserSearch]
  );

  const sendShare = useCallback(
    async (targetUser: ShareSearchResult) => {
      if (!userId || !shareProgram) return;

      try {
        setShareBusy(true);
        setShareMessage(null);

        const { error } = await supabase.from("program_shares").insert([
          {
            program_id: shareProgram.id,
            shared_by_user_id: userId,
            shared_with_user_id: targetUser.id,
            status: "pending",
          },
        ]);

        if (error) {
          if (String(error.message).toLowerCase().includes("duplicate")) {
            setShareMessage("A pending request already exists for this user.");
            return;
          }
          throw error;
        }

        await safeHaptics.notify("success");
        setShareMessage(`Shared with @${targetUser.username}`);
        await fetchSentShares();

        setTimeout(() => {
          resetShareUi();
        }, 700);
      } catch (e: any) {
        console.log("sendShare error:", e);
        setShareMessage(e?.message ?? "Could not share program");
      } finally {
        setShareBusy(false);
      }
    },
    [userId, shareProgram, fetchSentShares, resetShareUi]
  );

  const handleAcceptShare = useCallback(
    async (shareId: string) => {
      try {
        setBusy(true);

        const { data, error } = await supabase
          .rpc("accept_program_share", {
            p_share_id: shareId,
          })
          .single<AcceptShareRpcResponse>();

        if (error) throw error;

        const importedProgramId = data?.imported_program_id ?? null;

        await safeHaptics.notify("success");
        const refreshedProgramsPromise = fetchPrograms();
        await Promise.all([
          fetchPendingShares(),
          fetchSentShares(),
          refreshedProgramsPromise,
          fetchProgramImports(),
          fetchSplitCounts(),
        ]);

        if (importedProgramId) {
          const nextImported = programsRef.current.find((program) => program.id === importedProgramId) ?? null;
          const normalizedImported = nextImported
            ? (normalizeProgram({ ...nextImported, is_active: true }) as StoreProgram)
            : null;

          setPrograms((prev) =>
            prev.map((program) => ({
              ...program,
              is_active: program.id === importedProgramId,
            }))
          );
          setActiveProgramId(importedProgramId);
          publishActiveProgram(normalizedImported);
          setProgramsExpanded(true);
          setSplitsExpanded(true);
          await fetchSplits(importedProgramId);
        }

        setSharedVisible(true);
        Toast.show({
          type: "success",
          text1: "Program imported",
          text2: "The shared program and its splits were added to your profile.",
        });
      } catch (e: any) {
        console.log("handleAcceptShare error:", e);
        Alert.alert("Accept failed", e?.message ?? "Could not accept share");
      } finally {
        setBusy(false);
      }
    },
    [fetchPendingShares, fetchSentShares, fetchPrograms, fetchProgramImports, fetchSplitCounts, fetchSplits]
  );

  const handleDeclineShare = useCallback(
    async (shareId: string) => {
      try {
        setBusy(true);

        const { error } = await supabase.rpc("decline_program_share", {
          p_share_id: shareId,
        });

        if (error) throw error;

        await fetchPendingShares();
        await fetchSentShares();
      } catch (e: any) {
        console.log("handleDeclineShare error:", e);
        Alert.alert("Decline failed", e?.message ?? "Could not decline share");
      } finally {
        setBusy(false);
      }
    },
    [fetchPendingShares, fetchSentShares]
  );

  const handleSaveProfile = useCallback(async () => {
    if (!userId || usernameBusy) return;

    await safeHaptics.impact("light");

    const bioNormalized = bioValue.replace(/\s+/g, " ").trim().slice(0, BIO_MAX_LENGTH);

    setBioValue(bioNormalized);
    setUsernameError(null);
    setUsernameSuccess(null);

    const validationError = validateUsername(normalizedUsername);
    if (validationError) {
      setUsernameError(validationError);
      await safeHaptics.notify("error");
      Toast.show({
        type: "error",
        text1: "Invalid username",
        text2: validationError,
      });
      return;
    }

    const availability = await checkAvailabilityNow();
    if (availability === "taken") {
      const message = "Username already taken";
      setUsernameError(message);
      await safeHaptics.notify("error");
      Toast.show({
        type: "error",
        text1: "Username unavailable",
        text2: "Please choose a different username.",
      });
      return;
    }

    if (availability === "invalid") {
      const message = validateUsername(normalizedUsername) ?? "Invalid username";
      setUsernameError(message);
      await safeHaptics.notify("error");
      Toast.show({
        type: "error",
        text1: "Invalid username",
        text2: message,
      });
      return;
    }

    Keyboard.dismiss();
    setUsernameBusy(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          username: normalizedUsername,
          bio: bioNormalized.length ? bioNormalized : null,
        })
        .eq("id", userId)
        .select("id, username, display_name, avatar_url, bio")
        .single();

      if (error) throw error;

      setProfile(data as Profile);
      resetUsernameState((data as Profile).username ?? "");
      setUsernameTyping(false);
      setSettledUsernameState(null);
      setUsernameSuccess("Profile saved");
      setProfileSheetVisible(false);
      await safeHaptics.notify("success");
      Toast.show({
        type: "success",
        text1: "Profile saved",
        text2: "Your changes were updated successfully.",
      });
    } catch (e: any) {
      console.log("handleSaveProfile error:", e);

      const isDuplicate = e?.code === "23505";
      const message = isDuplicate ? "Username already taken" : e?.message ?? "Could not save profile";
      setUsernameError(message);
      await safeHaptics.notify("error");
      Toast.show({
        type: "error",
        text1: isDuplicate ? "Username taken" : "Could not save profile",
        text2: isDuplicate ? "That username is already in use." : "Please try again in a moment.",
      });
    } finally {
      setUsernameBusy(false);
    }
  }, [userId, usernameBusy, bioValue, normalizedUsername, checkAvailabilityNow, resetUsernameState]);

  const handleDeleteUsername = useCallback(async () => {
    if (!userId) return;

    Alert.alert(
      "Delete username?",
      "You can create another username later. Sharing features will be unavailable until then.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setUsernameBusy(true);
              setUsernameError(null);
              setUsernameSuccess(null);

              const { data, error } = await supabase
                .from("profiles")
                .update({ username: null })
                .eq("id", userId)
                .select("id, username, display_name, avatar_url, bio")
                .single();

              if (error) throw error;

              setProfile(data as Profile);
              setUsernameValue("");
              setUsernameSuccess("Username deleted");
            } catch (e: any) {
              console.log("handleDeleteUsername error:", e);
              setUsernameError(e?.message ?? "Could not delete username");
            } finally {
              setUsernameBusy(false);
            }
          },
        },
      ]
    );
  }, [setUsernameValue, userId]);

  const activateProgram = useCallback(
    async (program: Program) => {
      if (!userId) return;
      if (program.id === activeProgramId) return;

      await safeHaptics.impact("light");
      setBusy(true);

      const optimisticProgram = normalizeProgram({ ...program, is_active: true });
      setPrograms((prev) => prev.map((p) => ({ ...p, is_active: p.id === program.id })));
      setActiveProgramId(program.id);
      publishActiveProgram(optimisticProgram as StoreProgram);

      try {
        const { error: offError } = await supabase
          .from("programs")
          .update({ is_active: false })
          .eq("user_id", userId)
          .neq("id", program.id);
        if (offError) throw offError;

        const { error: onError } = await supabase
          .from("programs")
          .update({ is_active: true })
          .eq("user_id", userId)
          .eq("id", program.id);
        if (onError) throw onError;
      } catch (e: any) {
        console.log("activateProgram error:", e);
        Alert.alert("Failed", String(e?.message ?? "Could not activate program"));
        programsReqId.current += 1;
        publishActiveProgram((programsRef.current.find((p) => p.id === activeProgramId) ? normalizeProgram(programsRef.current.find((p) => p.id === activeProgramId)!) : null) as StoreProgram | null);
        await fetchPrograms();
      } finally {
        setBusy(false);
      }
    },
    [userId, activeProgramId, fetchPrograms]
  );

  const handleDragBegin = useCallback(async () => {
    await safeHaptics.selection();
  }, []);

  const handleDragRelease = useCallback(async () => {
    await safeHaptics.impact("light");
  }, []);

  const openProgramCard = useCallback(
    async (program: Program) => {
      await safeHaptics.selection();
      await activateProgram(program);
    },
    [activateProgram]
  );

  const onDragEnd = useCallback(
    async ({ data }: { data: Split[] }) => {
      if (!userId || !activeProgramId) return;

      await safeHaptics.selection();
      const normalized = normalizeSplitOrder(data);
      setSplits(normalized);

      try {
        await Promise.all(
          normalized.map((item) =>
            supabase.from("splits").update({ order_index: item.order_index }).eq("user_id", userId).eq("id", item.id)
          )
        );
      } catch (e) {
        console.log("onDragEnd error:", e);
        splitsReqId.current += 1;
        await fetchSplits(activeProgramId);
      }
    },
    [userId, activeProgramId, fetchSplits]
  );

  const deleteItem = useCallback(
    async (id: string, type: "program" | "split") => {
      if (!userId) return;

      await safeHaptics.impact("medium");
      setBusy(true);

      programsReqId.current += 1;
      splitsReqId.current += 1;

      try {
        if (type === "program") {
          const deletingActive = activeProgramId === id;
          const nextPrograms = programsRef.current.filter((p) => p.id !== id);
          setPrograms(nextPrograms);

          let nextActiveId: string | null = activeProgramId;

          if (deletingActive) {
            nextActiveId =
              nextPrograms.find((p) => p.is_active)?.id ?? (nextPrograms.length ? nextPrograms[0].id : null);
            setActiveProgramId(nextActiveId);
            publishActiveProgram((nextPrograms.find((p) => p.id === nextActiveId) ? normalizeProgram(nextPrograms.find((p) => p.id === nextActiveId)!) : null) as StoreProgram | null);
            setSplits([]);
          } else if (activeProgramId && !nextPrograms.some((p) => p.id === activeProgramId)) {
            nextActiveId = nextPrograms.length ? nextPrograms[0].id : null;
            setActiveProgramId(nextActiveId);
            publishActiveProgram((nextPrograms.find((p) => p.id === nextActiveId) ? normalizeProgram(nextPrograms.find((p) => p.id === nextActiveId)!) : null) as StoreProgram | null);
            setSplits([]);
          }

          const { error } = await supabase.from("programs").delete().eq("user_id", userId).eq("id", id);
          if (error) throw error;

          if (nextPrograms.length > 0 && nextActiveId) {
            await supabase.from("programs").update({ is_active: false }).eq("user_id", userId);
            await supabase.from("programs").update({ is_active: true }).eq("user_id", userId).eq("id", nextActiveId);
            setPrograms((prev) => prev.map((p) => ({ ...p, is_active: p.id === nextActiveId })));
            publishActiveProgram((nextPrograms.find((p) => p.id === nextActiveId) ? normalizeProgram(nextPrograms.find((p) => p.id === nextActiveId)!) : null) as StoreProgram | null);
          }

          if (nextPrograms.length === 0 && cacheId) {
            await cacheSetJson(cacheId, { programs: [], splitsByProgram: {}, activeProgramId: null });
          }

          if (nextActiveId) {
            splitsReqId.current += 1;
            await fetchSplits(nextActiveId);
          }

          return;
        }

        const nextSplits = normalizeSplitOrder(splitsRef.current.filter((s) => s.id !== id));
        setSplits(nextSplits);

        const { error } = await supabase.from("splits").delete().eq("user_id", userId).eq("id", id);
        if (error) throw error;

        if (nextSplits.length > 0) {
          await Promise.all(
            nextSplits.map((item) =>
              supabase.from("splits").update({ order_index: item.order_index }).eq("user_id", userId).eq("id", item.id)
            )
          );
        }
      } catch (e: any) {
        console.log("deleteItem error:", e);
        Alert.alert("Delete failed", String(e?.message ?? "Unknown error"));
        programsReqId.current += 1;
        splitsReqId.current += 1;
        await fetchPrograms();
      } finally {
        setBusy(false);
      }
    },
    [userId, activeProgramId, fetchPrograms, fetchSplits, cacheId]
  );


  const handleEditSplitItem = useCallback((target: Split) => {
    openRename(target, "split");
  }, [openRename]);

  const handleDeleteSplitItem = useCallback((id: string, type: "program" | "split") => {
    deleteItem(id, type);
  }, [deleteItem]);

  const renderSplitItem = useCallback(
    ({
      item,
      drag,
      isActive,
    }: {
      item: Split;
      drag: () => void;
      isActive: boolean;
    }) => {
      return (
        <SplitRow
          item={item}
          displayOrder={item.order_index}
          isActive={isActive}
          busy={busy}
          t={t}
          activeProgramName={activeProgramName}
          onDrag={drag}
          onEditItem={handleEditSplitItem}
          onDeleteItem={handleDeleteSplitItem}
        />
      );
    },
    [activeProgramName, busy, handleDeleteSplitItem, handleEditSplitItem, t]
  );

  const handleModalConfirm = useCallback(async () => {
    if (!userId) return;

    const name = modal.value.trim();
    if (!name) return;

    await safeHaptics.impact("light");
    Keyboard.dismiss();
    setBusy(true);

    programsReqId.current += 1;
    splitsReqId.current += 1;

    try {
      if (modal.mode === "rename" && modal.targetId) {
        if (modal.type === "program") {
          const { data, error } = await supabase
            .from("programs")
            .update({ name })
            .eq("user_id", userId)
            .eq("id", modal.targetId)
            .select()
            .maybeSingle();

          if (error) throw error;

          setPrograms((prev) =>
            prev.map((p) => (p.id === modal.targetId ? { ...p, name: data?.name ?? name } : p))
          );
        } else {
          const { data, error } = await supabase
            .from("splits")
            .update({ name })
            .eq("user_id", userId)
            .eq("id", modal.targetId)
            .select()
            .maybeSingle();

          if (error) throw error;

          setSplits((prev) =>
            prev.map((s) => (s.id === modal.targetId ? { ...s, name: data?.name ?? name } : s))
          );
        }

        closeModal();
        return;
      }

      if (modal.type === "program") {
        const { error: offError } = await supabase
          .from("programs")
          .update({ is_active: false })
          .eq("user_id", userId);

        if (offError) throw offError;

        const { data, error } = await supabase
          .from("programs")
          .insert([{ name, is_active: true, user_id: userId }])
          .select()
          .single();

        if (error) throw error;

        const createdProgram = normalizeProgram((data ?? {}) as any);
        setPrograms((prev) =>
          [...prev, createdProgram].map((p) => ({
            ...p,
            is_active: p.id === createdProgram.id,
          }))
        );
        setActiveProgramId(createdProgram.id);
        publishActiveProgram(createdProgram as StoreProgram);
        setProgramsExpanded(true);
        setSplits([]);
        setSplitsExpanded(true);

        if (await isOnboardingActive()) {
          setTutorialProgramId(createdProgram.id);
          await setOnboardingStep("create_split");
          setTourStep("create_split");
        }

        closeModal();
        return;
      }

      if (!activeProgramId) {
        Alert.alert(
          "Select a program",
          programsRef.current.length > 1 ? "Select a program to view splits." : "Create a program first."
        );
        return;
      }

      const { data, error } = await supabase
        .from("splits")
        .insert([{ name, program_id: activeProgramId, order_index: splitsRef.current.length, user_id: userId }])
        .select()
        .single();

      if (error) throw error;

      setSplits((prev) => normalizeSplitOrder([...prev, data as Split]));
      setSplitsExpanded(true);

      if (await isOnboardingActive()) {
        await setOnboardingStep("go_home");
        setTourStep("go_home");
      }

      closeModal();
    } catch (e: any) {
      console.log("handleModalConfirm error:", e);
      Alert.alert("Action failed", String(e?.message ?? "Unknown error"));
      await fetchPrograms();
    } finally {
      setBusy(false);
    }
  }, [userId, modal, activeProgramId, closeModal, fetchPrograms]);

  const showProgramsEmpty = programs.length === 0;
  const showNoSplits = !activeProgramId || splits.length === 0;

  const header = useMemo(() => {
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 }}>
        {tourActive && (tourStep === "profile_intro" || tourStep === "create_program") ? (
          <OnboardingBanner
            t={t}
            title="Start here"
            body="First create a program. After that, add at least one split so the Home screen has structure."
            primaryLabel="Create program"
            onPrimary={openCreateProgram}
            secondaryLabel="Skip tour"
            onSecondary={async () => {
              await stopOnboarding();
              setTourActive(false);
              setTourStep("done");
            }}
          />
        ) : null}

        {tourActive && tourStep === "create_split" ? (
          <OnboardingBanner
            t={t}
            title="Now add a split"
            body="Create a split inside your program, like Push, Pull, Legs, Upper, Lower, or Core."
            primaryLabel="Create split"
            onPrimary={openCreateSplit}
          />
        ) : null}

        {tourActive && tourStep === "go_home" ? (
          <OnboardingBanner
            t={t}
            title="Nice work"
            body="Your program structure is ready. Go back to Home and add your first exercise."
            primaryLabel="Go to Home"
            onPrimary={() =>
              router.push({
                pathname: "/(tabs)",
                params: tutorialProgramId
                  ? {
                    tutorialProgramId,
                    programId: tutorialProgramId,
                  }
                  : undefined,
              })
            }
          />
        ) : null}

        <SectionShell t={t}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <TouchableOpacity activeOpacity={0.9} onPress={openAvatarPreview}>
              <AvatarCircle
                size={78}
                profile={profile}
                initials={avatarInitials}
                avatarRing={avatarRing}
                textColor={t.text}
              />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.45 }}>
                {profile?.username ? `@${profile.username}` : "Create your profile"}
              </Text>
              <Text style={{ color: t.mutedText, marginTop: 5, lineHeight: 20, fontSize: 14 }}>
                {canSharePrograms
                  ? activeProgram
                    ? `${activeProgram.name} active · ${splitCountsByProgram[activeProgram.id] ?? 0} ${((splitCountsByProgram[activeProgram.id] ?? 0) === 1 ? "split" : "splits")}`
                    : "Sharing is enabled and your profile is ready."
                  : "Pick a username to unlock sharing across the app."}
              </Text>
            </View>
          </View>

          <View
            style={{
              marginTop: 18,
              borderRadius: 24,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: t.border,
              backgroundColor: t.cardAlt,
            }}
          >
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: t.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Text
                  style={{
                    color: t.mutedText,
                    fontSize: 12,
                    fontWeight: "700",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  Profile Summary
                </Text>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: t.card,
                    borderWidth: 1,
                    borderColor: t.border,
                  }}
                >
                  <Text style={{ color: canSharePrograms ? t.link : t.mutedText, fontSize: 11.5, fontWeight: "800" }}>
                    {canSharePrograms ? "Sharing On" : "Complete Profile"}
                  </Text>
                </View>
              </View>

              <Text style={{ color: trimmedBio ? t.text : t.mutedText, marginTop: 10, lineHeight: 21, fontSize: 15 }}>
                {bioPreview ?? "Add a short bio so your profile feels more personal."}
              </Text>
            </View>

            <TouchableOpacity
              onPress={openProfileSheet}
              activeOpacity={0.82}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 15,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: "700" }}>
                  {profile?.username ? "Edit Profile" : "Create Profile"}
                </Text>
                <Text style={{ color: t.mutedText, fontSize: 13, marginTop: 3 }}>
                  Update your username, photo, and bio
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.mutedText} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            <GlassPill
              label="Notifications"
              icon="notifications-outline"
              onPress={() => setNotificationsVisible(true)}
              count={notificationItems.length}
              t={t}
            />

            {canSharePrograms && (
              <GlassPill
                label="Shared"
                icon="share-social-outline"
                onPress={() => setSharedVisible(true)}
                count={pendingShares.length + importedPrograms.length}
                t={t}
              />
            )}
          </View>

          <View
            style={{
              marginTop: 16,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {[
              { label: "Programs", value: stats.totalPrograms, icon: "albums-outline" as const },
              { label: "Splits", value: stats.totalSplits, icon: "layers-outline" as const },
              { label: "Imported", value: stats.importedPrograms, icon: "download-outline" as const },
              { label: "Pending", value: stats.pendingShares, icon: "mail-unread-outline" as const },
            ].map((item) => (
              <MiniStatCard key={item.label} label={item.label} value={item.value} icon={item.icon} t={t} />
            ))}
          </View>

        </SectionShell>

        <SectionShell t={t} padding={0}>
          <View
            style={{
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: programsExpanded ? 10 : 18,
            }}
          >
            <SectionHeader
              title="Programs"
              subtitle={
                !hasPrograms
                  ? "Create your first training program to get started"
                  : programsExpanded
                    ? canSharePrograms
                      ? "Create, manage, and share your plans"
                      : "Create and manage your plans"
                    : activeProgram
                      ? `${programs.length} ${programs.length === 1 ? "program" : "programs"} • ${activeProgram.name} active`
                      : `${programs.length} ${programs.length === 1 ? "program" : "programs"}`
              }
              action={
                hasPrograms ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <TouchableOpacity onPress={openCreateProgram} disabled={busy} activeOpacity={0.8}>
                      <Text style={{ color: t.link, fontWeight: "800", fontSize: 15 }}>+ Add Program</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={toggleProgramsExpanded}
                      disabled={busy}
                      activeOpacity={0.8}
                      hitSlop={10}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: t.cardAlt,
                        borderWidth: 1,
                        borderColor: t.border,
                      }}
                    >
                      <Ionicons
                        name={programsExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={t.text}
                      />
                    </TouchableOpacity>
                  </View>
                ) : null
              }
              t={t}
            />
          </View>

          {(!hasPrograms || programsExpanded) && (
            <View style={{ marginBottom: 14, paddingHorizontal: 18, paddingBottom: 18 }}>
              {hasPrograms ? (
                <>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: t.inputBorder,
                      backgroundColor: t.cardAlt,
                      borderRadius: 16,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Ionicons name="search-outline" size={16} color={t.mutedText} />
                    <TextInput
                      value={programSearch}
                      onChangeText={setProgramSearch}
                      placeholder="Search programs"
                      placeholderTextColor={t.mutedText}
                      style={{ flex: 1, color: t.text, fontSize: 14.5 }}
                    />
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 14 }}>
                    {(["all", "own", "imported"] as const).map((value) => (
                      <TouchableOpacity
                        key={value}
                        onPress={() => setProgramFilter(value)}
                        activeOpacity={0.82}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: programFilter === value ? t.link : t.border,
                          backgroundColor: programFilter === value ? t.cardAlt : t.background,
                        }}
                      >
                        <Text
                          style={{
                            color: programFilter === value ? t.link : t.mutedText,
                            fontWeight: "700",
                            fontSize: 12.5,
                            textTransform: "capitalize",
                          }}
                        >
                          {value}
                        </Text>
                      </TouchableOpacity>
                    ))}

                    {(["active", "newest", "name"] as const).map((value) => (
                      <TouchableOpacity
                        key={value}
                        onPress={() => setProgramSort(value)}
                        activeOpacity={0.82}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: programSort === value ? t.link : t.border,
                          backgroundColor: programSort === value ? t.cardAlt : t.background,
                        }}
                      >
                        <Text
                          style={{
                            color: programSort === value ? t.link : t.mutedText,
                            fontWeight: "700",
                            fontSize: 12.5,
                            textTransform: "capitalize",
                          }}
                        >
                          {value}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}

              {showProgramsEmpty ? (
                <EmptyStateCard
                  icon="albums-outline"
                  title="No programs yet"
                  message="Create your first training program to organize your training split, history, and progress in one place."
                  actionLabel="Create Program"
                  onAction={openCreateProgram}
                  t={t}
                />
              ) : (
                <View style={{ gap: 10 }}>
                  {filteredPrograms.map((p) => {
                    const isActive = p.id === activeProgramId;
                    const importMeta = programImports[p.id];
                    const accent = getProgramAccent(p.id);
                    const splitCount = splitCountsByProgram[p.id] ?? 0;

                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => openProgramCard(p)}
                        disabled={busy}
                        activeOpacity={0.88}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 14,
                          borderRadius: 20,
                          backgroundColor: isActive ? t.cardAlt : t.background,
                          borderWidth: 1.2,
                          borderColor: isActive ? "rgba(10,132,255,0.45)" : t.border,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          shadowColor: "#000",
                          shadowOpacity: IS_IOS ? (isActive ? 0.12 : 0.05) : 0,
                          shadowRadius: isActive ? 18 : 10,
                          shadowOffset: { width: 0, height: isActive ? 10 : 6 },
                          elevation: isActive ? 3 : 1,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 8 }}>
                          <View
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 21,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: accent.bg,
                              marginRight: 12,
                            }}
                          >
                            <Text style={{ color: accent.text, fontWeight: "800", fontSize: 13 }}>
                              {getProgramInitials(p.name)}
                            </Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={{ color: t.text, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
                              {p.name}
                            </Text>

                            <Text style={{ color: t.mutedText, marginTop: 5, fontSize: 12.5 }}>
                              {importMeta?.shared_by_username
                                ? `Shared by @${importMeta.shared_by_username}`
                                : isActive
                                  ? "Currently selected"
                                  : "Tap to select"}
                            </Text>

                            <Text style={{ color: t.mutedText, marginTop: 4, fontSize: 12.5 }}>
                              {splitCount} {splitCount === 1 ? "split" : "splits"}
                            </Text>
                          </View>
                        </View>

                        {IS_IOS && (
                          <InlineActions
                            onShare={canSharePrograms ? () => openShareModal(p) : undefined}
                            onEdit={() => openRename(p, "program")}
                            onDelete={() => deleteItem(p.id, "program")}
                            border={t.border}
                            card={t.card}
                            mutedText={t.mutedText}
                          />
                        )}

                        {isActive && (
                          <View
                            style={{
                              backgroundColor: t.link,
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              borderRadius: 999,
                              marginLeft: 10,
                            }}
                          >
                            <Text style={{ color: "white", fontSize: 11.5, fontWeight: "800" }}>ACTIVE</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </SectionShell>

        <SectionShell t={t} padding={0}>
          <View
            style={{
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: splitsExpanded ? 10 : 18,
            }}
          >
            <SectionHeader
              title="Splits"
              subtitle={
                !hasPrograms
                  ? "Create a program first before adding splits"
                  : !hasSplits
                    ? activeProgram
                      ? `${activeProgram.name} is ready for its first split`
                      : "Choose a program to manage its splits"
                    : activeProgram
                      ? splitsExpanded
                        ? `${activeProgramSummary} • Long press and drag to reorder`
                        : activeProgramSummary
                      : "Choose a program to manage its splits"
              }
              action={
                hasSplits ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <TouchableOpacity onPress={openCreateSplit} disabled={busy || !activeProgramId} activeOpacity={0.8}>
                      <Text style={{ color: activeProgramId ? t.link : t.mutedText, fontWeight: "800", fontSize: 15 }}>
                        + Add Split
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={toggleSplitsExpanded}
                      disabled={busy}
                      activeOpacity={0.8}
                      hitSlop={10}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: t.cardAlt,
                        borderWidth: 1,
                        borderColor: t.border,
                      }}
                    >
                      <Ionicons
                        name={splitsExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={t.text}
                      />
                    </TouchableOpacity>
                  </View>
                ) : null
              }
              t={t}
            />
          </View>

          {(!hasSplits || splitsExpanded) && (
            <View
              style={{
                paddingHorizontal: 12,
                paddingBottom: 14,
              }}
            >
              {showNoSplits ? (
                <EmptyStateCard
                  icon={!hasPrograms ? "albums-outline" : "layers-outline"}
                  title={!hasPrograms ? "No program yet" : "No splits yet"}
                  message={
                    !hasPrograms
                      ? "Create a program first, then add splits like Push, Pull, Legs, Upper, or Lower."
                      : "Add splits for this program to organize your weekly training days and reorder them later."
                  }
                  actionLabel={!hasPrograms ? "Create Program" : activeProgramId ? "Add Split" : undefined}
                  onAction={!hasPrograms ? openCreateProgram : activeProgramId ? openCreateSplit : undefined}
                  t={t}
                />
              ) : (
                <View>
                  <DraggableFlatList
                    data={splits}
                    extraData={splits}
                    keyExtractor={(item) => item.id}
                    onDragBegin={() => {
                      setSplitDragActive(true);
                      handleDragBegin();
                    }}
                    onRelease={() => {
                      setSplitDragActive(false);
                      handleDragRelease();
                    }}
                    onDragEnd={(params) => {
                      setSplitDragActive(false);
                      onDragEnd(params);
                    }}
                    activationDistance={18}
                    dragHitSlop={{ top: -8, bottom: -8, left: 0, right: 0 }}
                    autoscrollThreshold={88}
                    autoscrollSpeed={220}
                    scrollEnabled={false}
                    nestedScrollEnabled={false}
                    dragItemOverflow
                    removeClippedSubviews={false}
                    initialNumToRender={splits.length || 1}
                    maxToRenderPerBatch={splits.length || 1}
                    windowSize={Math.max(5, splits.length || 1)}
                    updateCellsBatchingPeriod={16}
                    containerStyle={splitListContainerStyle}
                    contentContainerStyle={splitListContentContainerStyle}
                    showsVerticalScrollIndicator={false}
                    renderItem={renderSplitItem}
                  />
                </View>
              )}
            </View>
          )}
        </SectionShell>
      </View>
    );
  }, [
    t,
    busy,
    profile,
    avatarInitials,
    avatarRing,
    notificationItems.length,
    activeProgramSummary,
    hasPrograms,
    hasSplits,
    bioPreview,
    trimmedBio,
    programs,
    programsExpanded,
    filteredPrograms,
    programImports,
    splitCountsByProgram,
    stats,
    programSearch,
    programFilter,
    programSort,
    activeProgram,
    activeProgramId,
    showProgramsEmpty,
    canSharePrograms,
    openAvatarPreview,
    openProfileSheet,
    openCreateProgram,
    openCreateSplit,
    openProgramCard,
    openRename,
    deleteItem,
    openShareModal,
    tutorialProgramId,
    tourActive,
    tourStep,
    router,
    splitsExpanded,
    splits,
    showNoSplits,
    handleDragBegin,
    handleDragRelease,
    onDragEnd,
    pendingShares.length,
    importedPrograms.length,
    setProgramSearch,
    setProgramFilter,
    setProgramSort,
    toggleProgramsExpanded,
    toggleSplitsExpanded,
    renderSplitItem,
    splitListContainerStyle,
    splitListContentContainerStyle,
  ]);


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
        <StatusBar barStyle={t.primaryText === "#000000" ? "dark-content" : "light-content"} />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEnabled={!splitDragActive}
          nestedScrollEnabled
          contentContainerStyle={profileListContentContainerStyle}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={t.link}
            />
          }
        >
          {header}
        </ScrollView>

        <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={closeModal}>
          <KeyboardAvoidingView behavior={IS_IOS ? "padding" : undefined} style={{ flex: 1 }}>
            <Pressable
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.72)",
              }}
              onPress={closeModal}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={{
                  width: "85%",
                  backgroundColor: t.card,
                  padding: 20,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: t.border,
                }}
              >
                <TextInput
                  autoFocus
                  placeholder={`${modal.mode === "rename" ? "Rename" : "New"} ${modal.type}`}
                  placeholderTextColor={t.mutedText}
                  value={modal.value}
                  onChangeText={(val) => setModal((prev) => ({ ...prev, value: val }))}
                  returnKeyType="done"
                  onSubmitEditing={handleModalConfirm}
                  style={{
                    color: t.text,
                    borderBottomWidth: 1,
                    borderBottomColor: t.inputBorder,
                    marginBottom: 18,
                    paddingBottom: 10,
                    fontSize: 16,
                  }}
                />

                <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                  <TouchableOpacity onPress={closeModal} style={{ marginRight: 16 }} hitSlop={10} disabled={busy}>
                    <Text style={{ color: t.mutedText, fontSize: 15 }}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleModalConfirm} hitSlop={10} disabled={busy}>
                    <Text style={{ color: t.link, fontWeight: "700", fontSize: 15 }}>
                      {modal.mode === "rename" ? "Save" : "Add"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={avatarPreviewVisible} transparent animationType="fade" onRequestClose={closeAvatarPreview}>
          <Pressable
            onPress={closeAvatarPreview}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 24,
            }}
          >
            <BlurView intensity={56} tint="dark" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
            <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.32)" }} />
            <Pressable onPress={(e) => e.stopPropagation()} style={{ alignItems: "center" }}>
              <AvatarCircle
                size={profile?.avatar_url ? 244 : 224}
                profile={profile}
                initials={avatarInitials}
                avatarRing={avatarRing}
                textColor="white"
              />
              <Text
                style={{
                  color: "rgba(255,255,255,0.82)",
                  marginTop: 18,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Tap anywhere to close
              </Text>
            </Pressable>
          </Pressable>
        </Modal>

        <FancyModalShell
          visible={profileSheetVisible}
          onClose={closeProfileSheet}
          title={profile?.username ? "Edit Profile" : "Create Profile"}
          subtitle="Customize your username, photo, and bio."
          enableSwipeDismiss
          showCloseButton={false}
          t={t}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: "center", marginBottom: 18 }}>
              <View style={{ position: "relative" }}>
                <AvatarCircle
                  size={94}
                  profile={profile}
                  initials={avatarInitials}
                  avatarRing={avatarRing}
                  textColor={t.text}
                />
                <TouchableOpacity
                  onPress={handlePickAvatar}
                  disabled={avatarBusy}
                  activeOpacity={0.82}
                  style={{
                    position: "absolute",
                    right: -2,
                    bottom: -2,
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: t.link,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2.5,
                    borderColor: t.card,
                    shadowColor: "#000",
                    shadowOpacity: 0.16,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                  }}
                >
                  <Ionicons name="camera" size={16} color="white" />
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: 10,
                justifyContent: "center",
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <TouchableOpacity
                onPress={handlePickAvatar}
                disabled={avatarBusy}
                activeOpacity={0.82}
                style={{
                  borderWidth: 1,
                  borderColor: t.border,
                  backgroundColor: t.cardAlt,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Ionicons name="image-outline" size={16} color={t.text} />
                <Text style={{ color: t.text, fontWeight: "700" }}>
                  {avatarBusy ? "Updating..." : "Change Photo"}
                </Text>
              </TouchableOpacity>

              {!!profile?.avatar_url && (
                <TouchableOpacity
                  onPress={handleRemoveAvatar}
                  disabled={avatarBusy}
                  activeOpacity={0.82}
                  style={{
                    borderWidth: 1,
                    borderColor: "#ff3b30",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#ff3b30" />
                  <Text style={{ color: "#ff3b30", fontWeight: "700" }}>Remove Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ width: "100%", marginBottom: 12 }}>
              <Text style={{ color: t.text, fontSize: 13, fontWeight: "800", marginBottom: 8 }}>Username</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="username"
                placeholderTextColor={t.mutedText}
                value={usernameValue}
                onChangeText={(val) => {
                  setUsernameValue(val);
                  setUsernameError(null);
                  setUsernameSuccess(null);
                  setUsernameTyping(true);
                  setSettledUsernameState(null);
                  if (usernameTypingTimeoutRef.current) {
                    clearTimeout(usernameTypingTimeoutRef.current);
                  }
                  usernameTypingTimeoutRef.current = setTimeout(() => {
                    setUsernameTyping(false);
                  }, 450);
                }}
                returnKeyType="next"
                maxLength={20}
                style={{
                  color: t.text,
                  borderWidth: 1,
                  borderColor: usernameFieldState.color,
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  fontSize: 16,
                  backgroundColor: t.cardAlt,
                }}
              />
            </View>

            <View
              style={{
                width: "100%",
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                minHeight: 24,
              }}
            >
              {usernameFieldState.loading ? (
                <ActivityIndicator size="small" color={usernameFieldState.color} />
              ) : (
                <Ionicons
                  name={usernameFieldState.icon}
                  size={16}
                  color={usernameFieldState.color}
                />
              )}
              <Text
                style={{
                  flex: 1,
                  color: usernameFieldState.color,
                  fontSize: 12,
                  lineHeight: 18,
                }}
              >
                {usernameFieldState.text}
              </Text>
            </View>

            <View style={{ width: "100%", marginBottom: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: t.text, fontSize: 13, fontWeight: "800" }}>Bio</Text>
                <Text style={{ color: t.mutedText, fontSize: 12 }}>{bioValue.length}/{BIO_MAX_LENGTH}</Text>
              </View>

              <TextInput
                placeholder="Tell people a little about your training."
                placeholderTextColor={t.mutedText}
                value={bioValue}
                onChangeText={(val) => {
                  setBioValue(val.slice(0, BIO_MAX_LENGTH));
                  setUsernameError(null);
                  setUsernameSuccess(null);
                }}
                returnKeyType="done"
                onSubmitEditing={handleSaveProfile}
                multiline
                textAlignVertical="top"
                maxLength={BIO_MAX_LENGTH}
                style={{
                  color: t.text,
                  borderWidth: 1,
                  borderColor: t.inputBorder,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  fontSize: 15,
                  minHeight: 104,
                  backgroundColor: t.cardAlt,
                }}
              />
            </View>

            <Text style={{ color: t.mutedText, fontSize: 12, marginBottom: 10, textAlign: "center", lineHeight: 18 }}>
              Default avatar uses your initials. Use 3–20 lowercase letters, numbers, or underscores. Your bio is optional.
            </Text>

            {!!usernameError && (
              <Text style={{ color: "#ff453a", marginBottom: 10, textAlign: "center" }}>{usernameError}</Text>
            )}

            {!!usernameSuccess && (
              <Text style={{ color: "#30d158", marginBottom: 10, textAlign: "center" }}>{usernameSuccess}</Text>
            )}

            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={usernameBusy}
              activeOpacity={0.82}
              style={{
                width: "100%",
                marginTop: 8,
                backgroundColor: t.link,
                paddingVertical: 14,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                opacity: usernameBusy ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>
                {usernameBusy ? "Saving..." : "Save Profile"}
              </Text>
            </TouchableOpacity>

            {!!profile?.username && (
              <TouchableOpacity
                onPress={handleDeleteUsername}
                disabled={usernameBusy}
                activeOpacity={0.82}
                style={{
                  width: "100%",
                  marginTop: 12,
                  borderWidth: 1,
                  borderColor: "#ff3b30",
                  paddingVertical: 14,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#ff3b30", fontWeight: "800", fontSize: 16 }}>Delete Username</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </FancyModalShell>

        <FancyModalShell
          visible={notificationsVisible}
          onClose={() => setNotificationsVisible(false)}
          title="Notifications"
          subtitle="Updates, announcements, and shared-program activity."
          enableSwipeDismiss
          showCloseButton={false}
          t={t}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {notificationSections.length === 0 ? (
              <EmptyStateCard
                icon="checkmark-circle-outline"
                title="You’re all caught up"
                message="New updates and shared-program activity will appear here."
                t={t}
              />
            ) : (
              notificationSections.map((section, sectionIndex) => (
                <View key={section.key} style={{ marginBottom: sectionIndex === notificationSections.length - 1 ? 0 : 18 }}>
                  <SubsectionLabel label={section.title} t={t} />
                  <View
                    style={{
                      backgroundColor: t.card,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: t.border,
                      overflow: "hidden",
                    }}
                  >
                    {section.items.map((item) => (
                      <NotificationRow key={item.id} item={item} t={t} />
                    ))}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </FancyModalShell>

        <FancyModalShell
          visible={sharedVisible}
          onClose={() => setSharedVisible(false)}
          title="Shared"
          subtitle="Received, imported, and sent program activity."
          enableSwipeDismiss
          showCloseButton={false}
          t={t}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            <SubsectionLabel label="Imported Programs" t={t} />

            {importedPrograms.length === 0 ? (
              <EmptyStateCard
                icon="download-outline"
                title="No imported programs yet"
                message="Accepted programs will appear here and can be opened straight from this sheet."
                t={t}
              />
            ) : (
              importedPrograms.map((program) => {
                const accent = getProgramAccent(program.id);
                return (
                  <View
                    key={program.id}
                    style={{
                      backgroundColor: t.cardAlt,
                      borderRadius: 16,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: t.border,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: accent.bg,
                          marginRight: 12,
                        }}
                      >
                        <Text style={{ color: accent.text, fontWeight: "800", fontSize: 12 }}>
                          {getProgramInitials(program.name)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.text, fontWeight: "800" }}>{program.name}</Text>
                        <Text style={{ color: t.mutedText, marginTop: 4 }}>
                          Shared by @{program.shared_by_username ?? "user"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setSharedVisible(false);
                          void activateProgram(program);
                        }}
                        activeOpacity={0.82}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 12,
                          backgroundColor: t.link,
                        }}
                      >
                        <Text style={{ color: "white", fontWeight: "800", fontSize: 12.5 }}>Open</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              })
            )}

            <SubsectionLabel label="Pending Received" t={t} />

            {pendingShares.length === 0 ? (
              <EmptyStateCard
                icon="mail-open-outline"
                title="No pending shares"
                message="New program requests will appear here when someone shares a program with you."
                t={t}
              />
            ) : (
              pendingShares.map((share) => (
                <View
                  key={share.id}
                  style={{
                    backgroundColor: t.cardAlt,
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontWeight: "800" }}>{share.program_name}</Text>
                      <Text style={{ color: t.mutedText, marginTop: 4 }}>
                        Shared by @{share.sender_username ?? "user"} • {formatRelativeTime(share.created_at)}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor: getStatusTone(share.status, t).bg,
                        borderWidth: 1,
                        borderColor: getStatusTone(share.status, t).border,
                      }}
                    >
                      <Text style={{ color: getStatusTone(share.status, t).text, fontWeight: "800", fontSize: 11.5, textTransform: "uppercase" }}>
                        {share.status}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={() => handleAcceptShare(share.id)}
                      disabled={busy}
                      activeOpacity={0.82}
                      style={{
                        flex: 1,
                        backgroundColor: t.link,
                        paddingVertical: 10,
                        borderRadius: 12,
                        alignItems: "center",
                        opacity: busy ? 0.7 : 1,
                      }}
                    >
                      <Text style={{ color: "white", fontWeight: "800" }}>
                        {busy ? "Working..." : "Accept"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeclineShare(share.id)}
                      disabled={busy}
                      activeOpacity={0.82}
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: "#ff3b30",
                        paddingVertical: 10,
                        borderRadius: 12,
                        alignItems: "center",
                        opacity: busy ? 0.7 : 1,
                      }}
                    >
                      <Text style={{ color: "#ff3b30", fontWeight: "800" }}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <Text style={{ color: t.text, fontSize: 16, fontWeight: "800", marginTop: 8, marginBottom: 10 }}>
              Sent
            </Text>

            {sentShares.length === 0 ? (
              <View
                style={{
                  backgroundColor: t.cardAlt,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 8,
                }}
              >
                <Ionicons name="share-social-outline" size={20} color={t.mutedText} />
                <Text style={{ color: t.text, fontWeight: "700", marginTop: 8 }}>Nothing sent yet</Text>
                <Text style={{ color: t.mutedText, marginTop: 4 }}>Share one of your programs to see activity here.</Text>
              </View>
            ) : (
              sentShares.map((share) => (
                <View
                  key={share.id}
                  style={{
                    backgroundColor: t.cardAlt,
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontWeight: "800" }}>{share.program_name}</Text>
                      <Text style={{ color: t.mutedText, marginTop: 4 }}>
                        Sent to @{share.receiver_username ?? "user"} • {formatRelativeTime(share.created_at)}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor: getStatusTone(share.status, t).bg,
                        borderWidth: 1,
                        borderColor: getStatusTone(share.status, t).border,
                      }}
                    >
                      <Text style={{ color: getStatusTone(share.status, t).text, fontWeight: "800", fontSize: 11.5, textTransform: "uppercase" }}>
                        {share.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </FancyModalShell>

        <FancyModalShell
          visible={shareModalVisible}
          onClose={closeShareModal}
          title="Share Program"
          subtitle={shareProgram ? `Sharing "${shareProgram.name}"` : "Search by username"}
          enableSwipeDismiss
          showCloseButton={false}
          t={t}
        >
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Search username"
            placeholderTextColor={t.mutedText}
            value={shareSearch}
            onChangeText={searchUsers}
            style={{
              color: t.text,
              borderWidth: 1,
              borderColor: shareInputBorderColor,
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 14,
              fontSize: 16,
              backgroundColor: t.cardAlt,
              marginBottom: 10,
            }}
          />

          {shareSearchStatus === "not_found" && !!shareSearch && (
            <Text style={{ color: "#ff453a", marginBottom: 12 }}>
              {shareSearchError ?? "User does not exist"}
            </Text>
          )}

          {shareSearchStatus === "found" && exactMatchedUser && (
            <Text style={{ color: "#30d158", marginBottom: 12 }}>
              Matched @{exactMatchedUser.username}
            </Text>
          )}

          {!!shareMessage && (
            <Text
              style={{
                color: shareMessage.toLowerCase().includes("shared") ? "#30d158" : t.mutedText,
                marginBottom: 12,
              }}
            >
              {shareMessage}
            </Text>
          )}

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }}>
            {shareSearchStatus === "idle" ? (
              <Text style={{ color: t.mutedText }}>
                Type at least 2 characters to search users.
              </Text>
            ) : shareSearchStatus === "searching" ? (
              <Text style={{ color: t.mutedText }}>Searching...</Text>
            ) : exactMatchedUser ? (
              <View
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: t.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ color: t.text, fontWeight: "700" }}>@{exactMatchedUser.username}</Text>
                  {!!exactMatchedUser.display_name && (
                    <Text style={{ color: t.mutedText, marginTop: 4 }}>{exactMatchedUser.display_name}</Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => sendShare(exactMatchedUser)}
                  disabled={shareBusy}
                  activeOpacity={0.82}
                  style={{
                    backgroundColor: t.link,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    opacity: shareBusy ? 0.7 : 1,
                  }}
                >
                  <Ionicons name="send-outline" size={15} color="white" />
                  <Text style={{ color: "white", fontWeight: "800" }}>
                    {shareBusy ? "Sending..." : "Send"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ color: t.mutedText }}>No exact user match yet.</Text>
            )}
          </ScrollView>
        </FancyModalShell>

        <Toast />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

