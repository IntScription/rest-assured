import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import type { GestureResponderEvent } from "react-native";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import {
  SKILL_STATUS,
  type SkillDbStatus,
} from "@/src/features/skills/constants";
import type { SkillDashboardCard } from "@/src/features/skills/types";
import { useAppTheme } from "@/src/theme/theme";

type Props = {
  item: SkillDashboardCard;
  resetKey?: string | number;
  isBusy?: boolean;
  onPress: () => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  onQuickStatusChange?: (status: SkillDbStatus) => void;
};

function getDisplayStatus(status: SkillDbStatus) {
  switch (status) {
    case SKILL_STATUS.ACTIVE:
      return "In Progress";
    case SKILL_STATUS.PAUSED:
      return "Paused";
    case SKILL_STATUS.MASTERED:
      return "Complete";
    default:
      return "In Progress";
  }
}

function formatCompletedDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

function normalizeCardStatus(
  status: SkillDbStatus | string | null | undefined
): SkillDbStatus {
  if (status === SKILL_STATUS.ACTIVE || status === SKILL_STATUS.PAUSED) {
    return status;
  }

  return SKILL_STATUS.MASTERED;
}

export default function SkillGridCard({
  item,
  resetKey,
  isBusy = false,
  onPress,
  onLongPress,
  onQuickStatusChange,
}: Props) {
  const t = useAppTheme();
  const swipeableRef = useRef<any>(null);
  const suppressPressUntilRef = useRef(0);
  const isSwipeGestureActiveRef = useRef(false);

  const normalizedStatus = normalizeCardStatus(item.userSkill.status);
  const isPaused = normalizedStatus === SKILL_STATUS.PAUSED;
  const isComplete = normalizedStatus === SKILL_STATUS.MASTERED;
  const isFavorite = !!item.userSkill.is_favorite;

  const swipeRightStatus: SkillDbStatus = isPaused
    ? SKILL_STATUS.ACTIVE
    : SKILL_STATUS.PAUSED;

  const swipeLeftStatus: SkillDbStatus = isComplete
    ? SKILL_STATUS.ACTIVE
    : SKILL_STATUS.MASTERED;

  const swipeRightLabel = isPaused ? "Resume" : "Pause";
  const swipeRightIcon = isPaused ? "play" : "pause";
  const swipeLeftLabel = isComplete ? "Mark In Progress" : "Mark Complete";
  const swipeLeftIcon = isComplete ? "refresh" : "checkmark-done-outline";

  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round(item.progressPercent ?? 0))
  );

  const stageLabel = item.currentStage?.name ?? "No stage selected";
  const statusLabel = getDisplayStatus(normalizedStatus);
  const highlightText = item.highlightText?.trim() || "Keep building momentum.";
  const progressFillColor = isComplete ? t.text : t.link;
  const completedAt = formatCompletedDate((item.userSkill as any).completed_at);
  const lastLoggedAt = (item.userSkill as any).last_logged_at
    ? new Date((item.userSkill as any).last_logged_at).toLocaleDateString()
    : null;

  useEffect(() => {
    swipeableRef.current?.close?.();
    isSwipeGestureActiveRef.current = false;
    suppressPressUntilRef.current = 0;
  }, [resetKey, normalizedStatus]);

  const canSwipe = !!onQuickStatusChange && !isBusy;
  const canSwipeRight = canSwipe && !isComplete;
  const canSwipeLeft = canSwipe;

  const handleQuickChange = (status: SkillDbStatus) => {
    suppressPressUntilRef.current = Date.now() + 320;
    isSwipeGestureActiveRef.current = false;
    swipeableRef.current?.close?.();
    onQuickStatusChange?.(status);
  };

  const renderSwipeAction = ({
    label,
    icon,
    backgroundColor,
    align,
    onPress: onActionPress,
  }: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    backgroundColor: string;
    align: "flex-start" | "flex-end";
    onPress: () => void;
  }) => (
    <View
      style={[
        styles.actionWrap,
        { justifyContent: align },
      ]}
    >
      <View style={[styles.actionBase, { backgroundColor }]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onActionPress}
          style={styles.actionButton}
        >
          <View style={styles.actionIconWrap}>
            <Ionicons name={icon} size={18} color="white" />
          </View>
          <Text style={styles.actionText} numberOfLines={1}>
            {label}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLeftActions = () => {
    if (!canSwipeRight) return null;

    return renderSwipeAction({
      label: swipeRightLabel,
      icon: swipeRightIcon,
      backgroundColor: "#6b7280",
      align: "flex-start",
      onPress: () => handleQuickChange(swipeRightStatus),
    });
  };

  const renderRightActions = () => {
    if (!canSwipeLeft) return null;

    return renderSwipeAction({
      label: swipeLeftLabel,
      icon: swipeLeftIcon,
      backgroundColor: t.link,
      align: "flex-end",
      onPress: () => handleQuickChange(swipeLeftStatus),
    });
  };

  const hintLabel = !canSwipe
    ? "Tap card"
    : isComplete
      ? "Swipe left"
      : "Swipe left or right";

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      overshootLeft={false}
      overshootRight={false}
      friction={1.15}
      leftThreshold={28}
      rightThreshold={28}
      dragOffsetFromLeftEdge={16}
      dragOffsetFromRightEdge={16}
      onSwipeableOpenStartDrag={() => {
        isSwipeGestureActiveRef.current = true;
        suppressPressUntilRef.current = Date.now() + 380;
      }}
      onSwipeableCloseStartDrag={() => {
        isSwipeGestureActiveRef.current = true;
        suppressPressUntilRef.current = Date.now() + 260;
      }}
      onSwipeableWillOpen={() => {
        isSwipeGestureActiveRef.current = true;
        suppressPressUntilRef.current = Date.now() + 380;
      }}
      onSwipeableOpen={() => {
        isSwipeGestureActiveRef.current = false;
        suppressPressUntilRef.current = Date.now() + 240;
      }}
      onSwipeableWillClose={() => {
        suppressPressUntilRef.current = Date.now() + 180;
      }}
      onSwipeableClose={() => {
        isSwipeGestureActiveRef.current = false;
      }}
      enabled={canSwipeLeft || canSwipeRight}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => {
          if (Date.now() < suppressPressUntilRef.current) return;
          if (isSwipeGestureActiveRef.current) return;
          onPress();
        }}
        onLongPress={(event) => {
          if (Date.now() < suppressPressUntilRef.current) return;
          if (isSwipeGestureActiveRef.current) return;

          suppressPressUntilRef.current = Date.now() + 420;
          swipeableRef.current?.close?.();
          onLongPress?.(event);
        }}
        delayLongPress={260}
        disabled={isBusy}
        style={[
          styles.card,
          {
            backgroundColor: t.card,
            borderColor: isComplete ? t.link : t.border,
            opacity: isBusy ? 0.88 : 1,
          },
        ]}
      >
        <View style={styles.topRow}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: isComplete ? t.link : t.cardAlt,
              },
            ]}
          >
            <Ionicons
              name={isComplete ? "checkmark-circle-outline" : "flash-outline"}
              size={16}
              color={isComplete ? "white" : t.text}
            />
          </View>

          <View style={styles.topRightRow}>
            {item.isNewBest && item.latestLog ? (
              <View
                style={[
                  styles.favoriteBadge,
                  {
                    backgroundColor: "#F59E0B22",
                    borderColor: "#F59E0B55",
                  },
                ]}
              >
                <Ionicons name="trophy" size={12} color="#F59E0B" />
              </View>
            ) : null}

            {isFavorite ? (
              <View
                style={[
                  styles.favoriteBadge,
                  {
                    backgroundColor: t.cardAlt,
                    borderColor: t.border,
                  },
                ]}
              >
                <Ionicons name="star" size={12} color={t.text} />
              </View>
            ) : null}

            <View
              style={[
                styles.statusChip,
                {
                  backgroundColor: isComplete ? t.link : t.cardAlt,
                  borderColor: isComplete ? t.link : t.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: isComplete ? "white" : t.text },
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
          {item.skill.name}
        </Text>

        <Text style={[styles.stage, { color: t.mutedText }]} numberOfLines={1}>
          {stageLabel}
        </Text>

        <Text style={[styles.highlight, { color: t.text }]} numberOfLines={1}>
          {highlightText}
        </Text>

        <View style={styles.metaRow}>
          <View
            style={[
              styles.metaChip,
              { backgroundColor: t.cardAlt, borderColor: t.border },
            ]}
          >
            <Text style={[styles.metaChipText, { color: t.mutedText }]}>
              {progressPercent}% complete
            </Text>
          </View>

          {isComplete && completedAt ? (
            <View
              style={[
                styles.metaChip,
                { backgroundColor: t.cardAlt, borderColor: t.border },
              ]}
            >
              <Text style={[styles.metaChipText, { color: t.mutedText }]}>
                Done {completedAt}
              </Text>
            </View>
          ) : null}

          {isPaused ? (
            <View
              style={[
                styles.metaChip,
                { backgroundColor: t.cardAlt, borderColor: t.border },
              ]}
            >
              <Text style={[styles.metaChipText, { color: t.mutedText }]}>
                Paused
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.progressTrack, { backgroundColor: t.cardAlt }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: progressFillColor,
              },
            ]}
          />
        </View>

        <View style={styles.bottomRow}>
          <Text
            style={[styles.progressText, { color: t.mutedText }]}
            numberOfLines={1}
          >
            {isComplete
              ? completedAt
                ? `Completed on ${completedAt}`
                : "Completed"
              : lastLoggedAt
                ? `Last logged ${lastLoggedAt}`
                : "Open to set progress"}
          </Text>

          <View
            style={[
              styles.hintChip,
              { backgroundColor: t.cardAlt, borderColor: t.border },
            ]}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color={t.text} />
            ) : (
              <Text style={[styles.hintText, { color: t.mutedText }]}>
                {hintLabel}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    minHeight: 204,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  actionWrap: {
    width: 172,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  actionBase: {
    flex: 1,
    paddingHorizontal: 10,
    borderRadius: 22,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  actionButton: {
    minWidth: 148,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  actionText: {
    color: "white",
    fontSize: 12.5,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 15,
    maxWidth: 132,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 128,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  title: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
  },
  stage: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "600",
  },
  highlight: {
    marginTop: 12,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "700",
    minHeight: 38,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  metaChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  progressTrack: {
    marginTop: 14,
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  bottomRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
  },
  hintChip: {
    minWidth: 96,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  hintText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
