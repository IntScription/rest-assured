import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import type { AppTheme } from "../types";

type DashboardTab = "activity" | "coach" | "prs" | "attention";
type DashboardItem = Record<string, any> | string;

type CardAccent = {
  color: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type TabMeta = {
  id: DashboardTab;
  title: string;
  subtitle: string;
  count: number;
};

type Props = {
  t: AppTheme;
  recentActivity?: DashboardItem[];
  progressNotes?: DashboardItem[];
  recentPrs?: DashboardItem[];
  needsAttention?: DashboardItem[];
  coachLoading?: boolean;
  refreshCoachInsights?: () => Promise<void>;
};

const CARD_ACCENTS: Record<DashboardTab, CardAccent> = {
  activity: {
    color: "#38BDF8",
    bg: "#38BDF81A",
    icon: "pulse-outline",
  },
  coach: {
    color: "#A78BFA",
    bg: "#A78BFA1A",
    icon: "sparkles-outline",
  },
  prs: {
    color: "#FB923C",
    bg: "#FB923C1A",
    icon: "flame-outline",
  },
  attention: {
    color: "#F43F5E",
    bg: "#F43F5E1A",
    icon: "alert-circle-outline",
  },
};

const CONTEXTUAL_SUBTITLES: Record<DashboardTab, string> = {
  activity: "Your recent training history.",
  coach: "AI-driven training insights.",
  prs: "Your current best lifts.",
  attention: "Areas that need your focus.",
};

function getTitle(item: DashboardItem, fallback: string) {
  if (typeof item === "string") return fallback;

  return (
    item.exerciseName ??
    item.exercise_name ??
    item.name ??
    item.title ??
    item.exercise?.name ??
    fallback
  );
}

function getSummary(item: DashboardItem, fallback: string) {
  if (typeof item === "string") return item;

  return (
    item.summary ??
    item.note ??
    item.label ??
    item.description ??
    item.reason ??
    item.subtitle ??
    fallback
  );
}

function getSlug(item: DashboardItem) {
  if (typeof item === "string") return null;

  return (
    item.exerciseSlug ??
    item.exercise_slug ??
    item.slug ??
    item.exercise?.slug ??
    null
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export const HomeBottomSections = memo(function HomeBottomSections({
  t,
  recentActivity = [],
  progressNotes = [],
  recentPrs = [],
  needsAttention = [],
  coachLoading = false,
  refreshCoachInsights,
}: Props) {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<DashboardTab>("activity");
  const drift = useRef(new Animated.Value(0)).current;

  const dashboardHeight = useMemo(
    () => clamp(Math.round(windowHeight * 0.52), 440, 500),
    [windowHeight],
  );

  useEffect(() => {
    drift.setValue(0);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 6500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 6500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, [drift]);

  const handleTabPress = useCallback(
    (tabId: DashboardTab) => {
      if (tabId === activeTab) return;

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveTab(tabId);
    },
    [activeTab],
  );

  const openTrain = useCallback(() => {
    router.push("/train");
  }, [router]);

  const openCoach = useCallback(() => {
    router.push("/coach");
  }, [router]);

  const openExercise = useCallback(
    (slug: string | null) => {
      if (!slug) return;
      router.push(`/exercise/${slug}` as any);
    },
    [router],
  );

  const tabs = useMemo<TabMeta[]>(
    () => [
      {
        id: "activity",
        title: "Activity",
        subtitle: "Last 3 days",
        count: recentActivity.length,
      },
      {
        id: "coach",
        title: "Coach",
        subtitle: coachLoading ? "Updating" : "Insights",
        count: progressNotes.length,
      },
      {
        id: "prs",
        title: "PRs",
        subtitle: "Current bests",
        count: recentPrs.length,
      },
      {
        id: "attention",
        title: "Focus",
        subtitle: "Needs work",
        count: needsAttention.length,
      },
    ],
    [
      coachLoading,
      needsAttention.length,
      progressNotes.length,
      recentActivity.length,
      recentPrs.length,
    ],
  );

  const activeMeta = useMemo(
    () => tabs.find((tab) => tab.id === activeTab) ?? tabs[0],
    [activeTab, tabs],
  );

  const activeAccent = CARD_ACCENTS[activeMeta.id];

  const rows = useMemo<ReactNode>(() => {
    if (activeTab === "coach" && coachLoading) {
      return (
        <View style={localStyles.skeletonStack}>
          {[1, 2, 3].map((item) => (
            <SkeletonRow key={item} t={t} />
          ))}
        </View>
      );
    }

    if (activeTab === "activity") {
      if (recentActivity.length === 0) {
        return (
          <EmptyState
            t={t}
            accent={CARD_ACCENTS.activity}
            title="No recent activity"
            body="Log a few sets and your last 3 days of training will show here."
            actionLabel="Open Train"
            onAction={openTrain}
          />
        );
      }

      return recentActivity.slice(0, 8).map((item, index) => {
        const slug = getSlug(item);

        return (
          <DashboardRow
            key={(typeof item !== "string" && item.id) || `${activeTab}-${index}`}
            t={t}
            accent={CARD_ACCENTS.activity}
            title={getTitle(item, "Exercise log")}
            summary={getSummary(item, "Recently logged")}
            onPress={slug ? () => openExercise(slug) : undefined}
          />
        );
      });
    }

    if (activeTab === "coach") {
      if (progressNotes.length === 0) {
        return (
          <EmptyState
            t={t}
            accent={CARD_ACCENTS.coach}
            title="Coach is waiting"
            body="More logs will make these notes sharper."
            actionLabel={refreshCoachInsights ? "Refresh Coach" : "Open Coach"}
            onAction={refreshCoachInsights ?? openCoach}
            isLoading={coachLoading}
          />
        );
      }

      return progressNotes.slice(0, 8).map((item, index) => (
        <DashboardRow
          key={(typeof item !== "string" && item.id) || `${activeTab}-${index}`}
          t={t}
          accent={CARD_ACCENTS.coach}
          title={getTitle(item, "Coach Note")}
          summary={getSummary(item, "Training insight")}
          onPress={openCoach}
        />
      ));
    }

    if (activeTab === "prs") {
      if (recentPrs.length === 0) {
        return (
          <EmptyState
            t={t}
            accent={CARD_ACCENTS.prs}
            title="No PRs yet"
            body="Log a few working sets and your current best lifts will appear here."
            actionLabel="Open Train"
            onAction={openTrain}
          />
        );
      }

      return recentPrs.slice(0, 8).map((item, index) => {
        const slug = getSlug(item);

        return (
          <DashboardRow
            key={(typeof item !== "string" && item.id) || `${activeTab}-${index}`}
            t={t}
            accent={CARD_ACCENTS.prs}
            title={getTitle(item, "Exercise PR")}
            summary={getSummary(item, "Current best")}
            onPress={slug ? () => openExercise(slug) : undefined}
          />
        );
      });
    }

    if (needsAttention.length === 0) {
      return (
        <EmptyState
          t={t}
          accent={CARD_ACCENTS.attention}
          title="Looking good"
          body="No exercise needs attention right now. Keep the streak moving."
          actionLabel="Open Train"
          onAction={openTrain}
        />
      );
    }

    return needsAttention.slice(0, 8).map((item, index) => {
      const slug = getSlug(item);

      return (
        <DashboardRow
          key={(typeof item !== "string" && item.id) || `${activeTab}-${index}`}
          t={t}
          accent={CARD_ACCENTS.attention}
          title={getTitle(item, "Needs Attention")}
          summary={getSummary(item, "Review this exercise")}
          onPress={slug ? () => openExercise(slug) : undefined}
        />
      );
    });
  }, [
    activeTab,
    coachLoading,
    needsAttention,
    openCoach,
    openExercise,
    openTrain,
    progressNotes,
    recentActivity,
    recentPrs,
    refreshCoachInsights,
    t,
  ]);

  return (
    <View style={localStyles.wrap}>
      <View style={localStyles.sectionDivider}>
        <View
          style={[
            localStyles.dividerLine,
            { backgroundColor: t.mutedText, opacity: 0.25 },
          ]}
        />

        <View
          style={[
            localStyles.dividerPill,
            { backgroundColor: t.card, borderColor: t.border },
          ]}
        >
          <Ionicons name="grid-outline" size={13} color={t.mutedText} />
          <Text style={[localStyles.dividerText, { color: t.mutedText }]}>
            Dashboard below
          </Text>
        </View>

        <View
          style={[
            localStyles.dividerLine,
            { backgroundColor: t.mutedText, opacity: 0.25 },
          ]}
        />
      </View>

      <View
        style={[
          localStyles.dashboardCard,
          {
            height: dashboardHeight,
            backgroundColor: t.card,
            borderColor: t.border,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            localStyles.motionOrbLarge,
            {
              backgroundColor: activeAccent.bg,
              transform: [
                {
                  translateX: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -54],
                  }),
                },
                {
                  translateY: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 52],
                  }),
                },
              ],
            },
          ]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            localStyles.motionOrbMedium,
            {
              backgroundColor: CARD_ACCENTS.coach.bg,
              transform: [
                {
                  translateX: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 46],
                  }),
                },
                {
                  translateY: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -38],
                  }),
                },
              ],
            },
          ]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            localStyles.motionOrbSmall,
            {
              backgroundColor: CARD_ACCENTS.prs.bg,
              transform: [
                {
                  translateX: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 30],
                  }),
                },
                {
                  translateY: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 42],
                  }),
                },
              ],
            },
          ]}
        />

        <View style={localStyles.dashboardHeader}>
          <View style={localStyles.dashboardTitleWrap}>
            <Text style={[localStyles.dashboardTitle, { color: t.text }]}>
              Training Dashboard
            </Text>
            <Text
              style={[localStyles.dashboardSubtitle, { color: t.mutedText }]}
            >
              {CONTEXTUAL_SUBTITLES[activeTab]}
            </Text>
          </View>

          <View
            style={[
              localStyles.activeBadge,
              {
                backgroundColor: activeAccent.bg,
                borderColor: activeAccent.color,
              },
            ]}
            accessibilityLabel={`${activeMeta.title}, ${activeMeta.count} items`}
          >
            <Ionicons
              name={activeAccent.icon}
              size={14}
              color={activeAccent.color}
            />
            <Text
              style={[
                localStyles.activeBadgeText,
                { color: activeAccent.color },
              ]}
            >
              {activeMeta.count}
            </Text>
          </View>
        </View>

        <View style={localStyles.cardGrid}>
          {tabs.map((tab) => (
            <DashboardMiniCard
              key={tab.id}
              t={t}
              title={tab.title}
              subtitle={tab.subtitle}
              icon={CARD_ACCENTS[tab.id].icon}
              count={tab.count}
              accent={CARD_ACCENTS[tab.id]}
              selected={activeTab === tab.id}
              onPress={() => handleTabPress(tab.id)}
            />
          ))}
        </View>

        <View
          style={[
            localStyles.detailsPanel,
            {
              backgroundColor: t.cardAlt,
              borderColor: activeAccent.color,
            },
          ]}
        >
          <View style={localStyles.detailsHeader}>
            <View
              style={[
                localStyles.detailsIcon,
                { backgroundColor: activeAccent.bg },
              ]}
            >
              <Ionicons
                name={activeAccent.icon}
                size={16}
                color={activeAccent.color}
              />
            </View>

            <View style={localStyles.detailsHeaderText}>
              <Text style={[localStyles.detailsTitle, { color: t.text }]}>
                {activeMeta.title}
              </Text>
              <Text
                style={[localStyles.detailsSubtitle, { color: t.mutedText }]}
              >
                {activeMeta.subtitle}
              </Text>
            </View>
          </View>

          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              localStyles.detailsScrollContent,
              { flexGrow: 1 },
            ]}
          >
            {rows}
          </ScrollView>
        </View>
      </View>
    </View>
  );
});

type DashboardMiniCardProps = {
  t: AppTheme;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  accent: CardAccent;
  selected: boolean;
  onPress: () => void;
};

const DashboardMiniCard = memo(function DashboardMiniCard({
  t,
  title,
  subtitle,
  icon,
  count,
  accent,
  selected,
  onPress,
}: DashboardMiniCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = useCallback(
    (value: number) => {
      Animated.spring(scale, {
        toValue: value,
        useNativeDriver: true,
        damping: 18,
        stiffness: 260,
        mass: 0.7,
      }).start();
    },
    [scale],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${count} items`}
      onPress={onPress}
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      style={localStyles.miniCardPressable}
    >
      <Animated.View
        style={[
          localStyles.miniCard,
          {
            backgroundColor: selected ? accent.bg : t.cardAlt,
            borderColor: selected ? accent.color : t.border,
            transform: [{ translateY: selected ? -2 : 0 }, { scale }],
          },
        ]}
      >
        <View style={localStyles.miniCardTop}>
          <View style={[localStyles.miniIcon, { backgroundColor: accent.bg }]}>
            <Ionicons name={icon} size={17} color={accent.color} />
          </View>

          <View
            style={[
              localStyles.countBubble,
              { backgroundColor: selected ? accent.color : t.text },
            ]}
          >
            <Text
              style={[
                localStyles.countText,
                { color: selected ? "#FFFFFF" : t.card },
              ]}
            >
              {count}
            </Text>
          </View>
        </View>

        <Text
          style={[localStyles.miniTitle, { color: t.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>

        <Text
          style={[localStyles.miniSubtitle, { color: t.mutedText }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

type DashboardRowProps = {
  t: AppTheme;
  accent: CardAccent;
  title: string;
  summary: string;
  onPress?: () => void;
};

const DashboardRow = memo(function DashboardRow({
  t,
  accent,
  title,
  summary,
  onPress,
}: DashboardRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={`${title}. ${summary}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        localStyles.row,
        {
          backgroundColor: t.card,
          borderColor: t.border,
          opacity: pressed ? 0.76 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View style={[localStyles.rowAccent, { backgroundColor: accent.color }]} />

      <View style={[localStyles.rowIcon, { backgroundColor: accent.bg }]}>
        <Ionicons name={accent.icon} size={15} color={accent.color} />
      </View>

      <View style={localStyles.rowTextWrap}>
        <Text
          style={[localStyles.rowTitle, { color: t.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[localStyles.rowSummary, { color: t.mutedText }]}
          numberOfLines={2}
        >
          {summary}
        </Text>
      </View>

      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color={t.mutedText} />
      ) : null}
    </Pressable>
  );
});

const SkeletonRow = memo(function SkeletonRow({ t }: { t: AppTheme }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        localStyles.row,
        {
          backgroundColor: t.card,
          borderColor: t.border,
          opacity: pulse,
        },
      ]}
    >
      <View style={[localStyles.rowIcon, { backgroundColor: t.cardAlt }]} />
      <View style={localStyles.rowTextWrap}>
        <View
          style={[
            localStyles.skeletonLineLarge,
            { backgroundColor: t.cardAlt },
          ]}
        />
        <View
          style={[
            localStyles.skeletonLineSmall,
            { backgroundColor: t.cardAlt },
          ]}
        />
      </View>
    </Animated.View>
  );
});

type EmptyStateProps = {
  t: AppTheme;
  accent: CardAccent;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  isLoading?: boolean;
};

const EmptyState = memo(function EmptyState({
  t,
  accent,
  title,
  body,
  actionLabel,
  onAction,
  isLoading = false,
}: EmptyStateProps) {
  return (
    <View style={localStyles.emptyState}>
      <View style={[localStyles.emptyIcon, { backgroundColor: accent.bg }]}>
        <Ionicons name={accent.icon} size={18} color={accent.color} />
      </View>

      <Text style={[localStyles.emptyTitle, { color: t.text }]}>{title}</Text>

      <Text style={[localStyles.emptyText, { color: t.mutedText }]}>
        {body}
      </Text>

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          disabled={isLoading}
          onPress={() => void onAction()}
          style={[
            localStyles.emptyAction,
            {
              backgroundColor: accent.bg,
              borderColor: accent.color,
              opacity: isLoading ? 0.6 : 1,
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={accent.color} />
          ) : (
            <Text
              style={[localStyles.emptyActionText, { color: accent.color }]}
            >
              {actionLabel}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
});

const localStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  sectionDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1.5,
  },
  dividerPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: "800",
  },
  dashboardCard: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 14,
    overflow: "hidden",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  motionOrbLarge: {
    position: "absolute",
    top: -52,
    right: -42,
    width: 190,
    height: 190,
    borderRadius: 999,
  },
  motionOrbMedium: {
    position: "absolute",
    bottom: 120,
    left: -72,
    width: 150,
    height: 150,
    borderRadius: 999,
  },
  motionOrbSmall: {
    position: "absolute",
    bottom: -44,
    right: 34,
    width: 118,
    height: 118,
    borderRadius: 999,
  },
  dashboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  dashboardTitleWrap: {
    flex: 1,
  },
  dashboardTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  dashboardSubtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  activeBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  cardGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  miniCardPressable: {
    flex: 1,
  },
  miniCard: {
    minHeight: 92,
    borderWidth: 1.2,
    borderRadius: 22,
    padding: 10,
    justifyContent: "space-between",
  },
  miniCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  miniIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  countBubble: {
    minWidth: 23,
    height: 23,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: 11,
    fontWeight: "900",
  },
  miniTitle: {
    fontSize: 12,
    fontWeight: "900",
  },
  miniSubtitle: {
    fontSize: 10,
    fontWeight: "800",
  },
  detailsPanel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  detailsHeaderText: {
    flex: 1,
  },
  detailsIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  detailsSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  detailsScrollContent: {
    paddingHorizontal: 10,
    paddingBottom: 14,
    gap: 9,
  },
  skeletonStack: {
    gap: 9,
  },
  row: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  rowAccent: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 3,
  },
  rowSummary: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  skeletonLineLarge: {
    width: "55%",
    height: 12,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonLineSmall: {
    width: "35%",
    height: 10,
    borderRadius: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    minHeight: 140,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 17,
  },
  emptyAction: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
    alignItems: "center",
  },
  emptyActionText: {
    fontSize: 12,
    fontWeight: "900",
  },
});
