"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { useCoachDashboard } from "@/src/features/coach/hooks/useCoachDashboard";
import { useAppleHealthSync } from "@/src/features/coach/health/useAppleHealthSync";
import { generateCoachInsights } from "@/src/features/coach/api/generateCoachInsights";
import { generateAdjustmentSummary } from "@/src/features/coach/api/generateAdjustmentSummary";
import { generateAiCoachSummary } from "@/src/features/coach/api/generateAiCoachSummary";
import { useLocalCoach } from "@/src/features/coach/hooks/useLocalCoach";
import {
  getCoachDisplayLabel,
  getCoachRuntimeMode,
} from "@/src/features/coach/services/coach-runtime";

type ThemeLike = ReturnType<typeof useAppTheme>;

export default function CoachScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  const localCoach = useLocalCoach();
  const runtimeMode = getCoachRuntimeMode();
  const { loading: syncingHealth, syncNow, lastSnapshot } = useAppleHealthSync();

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setUserId(data.session?.user?.id ?? null);
    })();

    return () => {
      active = false;
    };
  }, []);

  const { data, loading, refetch } = useCoachDashboard(userId);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const canUseLocal =
    runtimeMode === "local_ai" || (runtimeMode === "auto" && localCoach.isAvailable);

  const canUseHosted =
    runtimeMode === "hosted_ai" || runtimeMode === "auto";

  const aiLabel = useMemo(
    () => getCoachDisplayLabel({ canUseLocal, canUseHosted }),
    [canUseLocal, canUseHosted]
  );

  const aiColor = canUseLocal
    ? "#22c55e"
    : canUseHosted
      ? "#3b82f6"
      : "#94a3b8";

  useEffect(() => {
    pulseAnim.setValue(0);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [pulseAnim, aiColor]);

  const handleHealthSync = async () => {
    if (!userId) return;

    try {
      await syncNow(userId, 7);
      await generateCoachInsights(userId);
      await generateAdjustmentSummary(userId);

      try {
        await generateAiCoachSummary(userId);
      } catch {
        // optional
      }

      await refetch();
      Alert.alert("Apple Health synced", "Coach has been updated with your latest health data.");
    } catch (error: any) {
      Alert.alert("Health sync failed", error?.message ?? "Could not sync Apple Health.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.text} />
      </SafeAreaView>
    );
  }

  const onboardingDone = data?.profile?.onboarding_completed ?? false;

  if (!onboardingDone) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: t.background }]}
        edges={["top"]}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={[styles.pageTitle, { color: t.text }]}>Coach</Text>
            <Text style={[styles.pageSubtitle, { color: t.mutedText }]}>
              Set up Coach to unlock personalized recommendations.
            </Text>
          </View>

          <View
            style={[
              styles.setupHero,
              {
                backgroundColor: t.cardAlt,
                borderColor: t.border,
              },
            ]}
          >
            <View style={styles.setupHeroTop}>
              <View style={[styles.heroIconWrap, { backgroundColor: t.card }]}>
                <Ionicons name="sparkles-outline" size={22} color={t.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.setupHeroTitle, { color: t.text }]}>
                  Build your coaching baseline
                </Text>
                <Text style={[styles.setupHeroText, { color: t.mutedText }]}>
                  Add your profile, training style, measurements, and optionally Apple Health so Coach can guide you better.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: t.primaryBg }]}
              onPress={() => router.push("/coach/onboarding")}
            >
              <Text style={[styles.primaryButtonText, { color: t.primaryText }]}>
                Start Coach Setup
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const readinessScore =
    typeof data?.readinessInsight?.payload?.score === "number"
      ? (data.readinessInsight.payload.score as number)
      : null;

  const readinessStatus =
    typeof data?.readinessInsight?.payload?.status === "string"
      ? String(data.readinessInsight.payload.status)
      : "unknown";

  const readinessReasons = Array.isArray(data?.readinessInsight?.payload?.reasons)
    ? (data?.readinessInsight?.payload?.reasons as string[])
    : [];

  const readinessMeta = getReadinessMeta(readinessStatus);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.32, 0],
  });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: t.background }]}
      edges={["top"]}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: t.text }]}>Coach</Text>
          <Text style={[styles.pageSubtitle, { color: t.mutedText }]}>
            Your intelligent training and recovery guide.
          </Text>
        </View>

        <View
          style={[
            styles.aiChip,
            {
              backgroundColor: t.card,
              borderColor: t.border,
            },
          ]}
        >
          <View style={styles.aiDotWrap}>
            <Animated.View
              style={[
                styles.aiDotPulse,
                {
                  backgroundColor: aiColor,
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                },
              ]}
            />
            <View style={[styles.aiDot, { backgroundColor: aiColor }]} />
          </View>
          <Text style={[styles.aiChipText, { color: t.text }]}>{aiLabel}</Text>
        </View>

        <View
          style={[
            styles.readinessHero,
            {
              backgroundColor: t.cardAlt,
              borderColor: t.border,
            },
          ]}
        >
          <View style={styles.readinessTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.readinessLabel, { color: t.mutedText }]}>
                Today’s Readiness
              </Text>
              <Text style={[styles.readinessHeadline, { color: t.text }]}>
                {readinessMeta.headline}
              </Text>
            </View>

            <View
              style={[
                styles.scoreWrap,
                {
                  backgroundColor: t.card,
                  borderColor: t.border,
                },
              ]}
            >
              <Text style={[styles.scoreValue, { color: t.text }]}>
                {readinessScore ?? "--"}
              </Text>
              <Text style={[styles.scoreStatus, { color: readinessMeta.color }]}>
                {readinessStatus}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.readinessStrip,
              {
                backgroundColor: t.card,
                borderColor: t.border,
              },
            ]}
          >
            <View
              style={[
                styles.readinessStripDot,
                { backgroundColor: readinessMeta.color },
              ]}
            />
            <Text style={[styles.readinessStripText, { color: t.text }]}>
              {readinessMeta.strip}
            </Text>
          </View>

          {readinessReasons.length > 0 ? (
            <View style={styles.reasonWrap}>
              {readinessReasons.slice(0, 3).map((reason) => (
                <View
                  key={reason}
                  style={[
                    styles.reasonChip,
                    {
                      backgroundColor: t.card,
                      borderColor: t.border,
                    },
                  ]}
                >
                  <Text style={[styles.reasonChipText, { color: t.mutedText }]}>
                    {reason}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: t.primaryBg }]}
            onPress={() => router.push("/coach/ask")}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={18}
              color={t.primaryText}
              style={styles.buttonIcon}
            />
            <Text style={[styles.primaryButtonText, { color: t.primaryText }]}>
              Ask Coach
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickActionRow}>
          <QuickAction
            icon="pulse-outline"
            label="Recovery"
            onPress={() => router.push("/coach/recovery")}
            t={t}
          />
          <QuickAction
            icon="resize-outline"
            label="Measurements"
            onPress={() => router.push("/coach/measurements")}
            t={t}
          />
          <QuickAction
            icon="settings-outline"
            label="Setup"
            onPress={() => router.push("/coach/onboarding")}
            t={t}
          />
        </View>

        <SectionHeader title="Today" t={t} />

        <InsightCard
          title="Next Session"
          icon="barbell-outline"
          summary={data?.nextSessionInsight?.summary ?? "No next-session recommendation yet."}
          t={t}
        />

        <InsightCard
          title="Skill Focus"
          icon="flash-outline"
          summary={data?.skillFocusInsight?.summary ?? "No skill focus yet."}
          t={t}
        />

        <SectionHeader title="Review" t={t} />

        <InsightCard
          title="Weekly Review"
          icon="stats-chart-outline"
          summary={data?.weeklyReviewInsight?.summary ?? "No weekly review yet."}
          t={t}
        />

        <SectionHeader title="Apple Health" t={t} />

        <View
          style={[
            styles.healthCard,
            {
              backgroundColor: t.card,
              borderColor: t.border,
            },
          ]}
        >
          <View style={styles.healthTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.healthTitle, { color: t.text }]}>
                Health sync
              </Text>
              <Text style={[styles.healthText, { color: t.mutedText }]}>
                Keep recovery and readiness more accurate with recent health data.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.syncButton,
                {
                  backgroundColor: t.primaryBg,
                  opacity: syncingHealth ? 0.75 : 1,
                },
              ]}
              onPress={handleHealthSync}
              disabled={syncingHealth}
            >
              <Text style={[styles.syncButtonText, { color: t.primaryText }]}>
                {syncingHealth ? "Syncing..." : "Sync"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.healthStatsRow}>
            <MiniStat
              label="Sleep"
              value={
                lastSnapshot?.sleep_minutes != null
                  ? `${Math.round(lastSnapshot.sleep_minutes / 60)}h`
                  : "--"
              }
              t={t}
            />
            <MiniStat
              label="Steps"
              value={
                lastSnapshot?.steps != null ? formatCompact(lastSnapshot.steps) : "--"
              }
              t={t}
            />
            <MiniStat
              label="RHR"
              value={
                lastSnapshot?.resting_heart_rate != null
                  ? String(lastSnapshot.resting_heart_rate)
                  : "--"
              }
              t={t}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  t,
}: {
  title: string;
  t: ThemeLike;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionHeaderTitle, { color: t.text }]}>{title}</Text>
    </View>
  );
}

function InsightCard({
  title,
  summary,
  icon,
  t,
}: {
  title: string;
  summary: string;
  icon: keyof typeof Ionicons.glyphMap;
  t: ThemeLike;
}) {
  return (
    <View
      style={[
        styles.insightCard,
        {
          backgroundColor: t.card,
          borderColor: t.border,
        },
      ]}
    >
      <View style={styles.insightTop}>
        <View style={[styles.insightIconWrap, { backgroundColor: t.cardAlt }]}>
          <Ionicons name={icon} size={18} color={t.text} />
        </View>
        <Text style={[styles.insightTitle, { color: t.text }]}>{title}</Text>
      </View>

      <Text style={[styles.insightSummary, { color: t.mutedText }]}>{summary}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  t,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  t: ThemeLike;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      damping: 18,
      stiffness: 260,
      mass: 0.7,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.965)}
      onPressOut={() => animateTo(1)}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          styles.quickActionCard,
          {
            backgroundColor: t.card,
            borderColor: t.border,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={[styles.quickActionIconWrap, { backgroundColor: t.cardAlt }]}>
          <Ionicons name={icon} size={18} color={t.text} />
        </View>
        <Text style={[styles.quickActionText, { color: t.text }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function MiniStat({
  label,
  value,
  t,
}: {
  label: string;
  value: string;
  t: ThemeLike;
}) {
  return (
    <View
      style={[
        styles.miniStatCard,
        {
          backgroundColor: t.cardAlt,
          borderColor: t.border,
        },
      ]}
    >
      <Text style={[styles.miniStatValue, { color: t.text }]}>{value}</Text>
      <Text style={[styles.miniStatLabel, { color: t.mutedText }]}>{label}</Text>
    </View>
  );
}

function getReadinessMeta(status: string) {
  switch (status) {
    case "ready":
      return {
        headline: "You’re in a good spot to push today.",
        strip: "Recovery and readiness look favorable.",
        color: "#22c55e",
      };
    case "moderate":
      return {
        headline: "Train, but keep intensity controlled.",
        strip: "A solid day for quality work without forcing it.",
        color: "#f59e0b",
      };
    case "recover":
      return {
        headline: "Recovery should take priority today.",
        strip: "Reduce stress and keep today lighter.",
        color: "#ef4444",
      };
    default:
      return {
        headline: "Coach is still building your picture.",
        strip: "More data will improve recommendations.",
        color: "#94a3b8",
      };
  }
}

function formatCompact(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(value);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  header: {
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "800",
  },
  pageSubtitle: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },

  aiChip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  aiDotWrap: {
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  aiDotPulse: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  aiDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  aiChipText: {
    fontSize: 12,
    fontWeight: "700",
  },

  readinessHero: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
  },
  readinessTop: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  readinessLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  readinessHeadline: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  scoreWrap: {
    minWidth: 88,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  scoreStatus: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  readinessStrip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  readinessStripDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  readinessStripText: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  reasonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  reasonChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  reasonChipText: {
    fontSize: 12,
    fontWeight: "600",
  },

  primaryButton: {
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    flexDirection: "row",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  buttonIcon: {
    marginRight: 8,
  },

  quickActionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  quickActionCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quickActionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  sectionHeader: {
    marginBottom: 10,
    marginTop: 2,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
  },

  insightCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  insightTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  insightIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  insightSummary: {
    fontSize: 14,
    lineHeight: 20,
  },

  healthCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  healthTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  healthTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  healthText: {
    fontSize: 13,
    lineHeight: 18,
  },
  syncButton: {
    minWidth: 88,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: "800",
  },
  healthStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  miniStatCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  miniStatLabel: {
    fontSize: 12,
    fontWeight: "600",
  },

  setupHero: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
  },
  setupHeroTop: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  setupHeroTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  setupHeroText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
