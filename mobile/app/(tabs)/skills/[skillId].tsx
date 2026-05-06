import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  SKILL_STATUS,
  type SkillDbStatus,
} from "@/src/features/skills/constants";
import { useAchievementUnlocks } from "@/src/features/skills/hooks/useAchievementUnlocks";
import { useSkillDetail } from "@/src/features/skills/hooks/useSkillDetail";
import {
  emitSkillChallengesChanged,
  emitSkillsDashboardChanged,
  syncSkillAchievementsForUserWithResult,
  syncSkillChallengesForUser,
} from "@/src/features/skills/services";
import type { SkillLog, SkillMetricType } from "@/src/features/skills/types";
import { updateSkillStatus } from "@/src/features/skills/utils/update-skill-status";
import {
  getSkillStatusSync,
  publishSkillStatusSync,
  subscribeSkillStatusSync,
} from "@/src/features/skills/utils/skill-status-sync";
import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";

type QuickLogDraft = {
  value: string;
  attempts: string;
  notes: string;
};

function normalizeSkillStatus(
  status: SkillDbStatus | string | null | undefined
): SkillDbStatus {
  if (status === SKILL_STATUS.ACTIVE || status === SKILL_STATUS.PAUSED) {
    return status;
  }

  return SKILL_STATUS.MASTERED;
}

function formatLogValue(log: SkillLog | null, metricType: SkillMetricType) {
  if (!log) return "No logs yet";

  if (metricType === "seconds") {
    return `${log.value ?? 0}${log.unit ?? "s"}`;
  }

  if (metricType === "reps") {
    return `${log.value ?? 0} reps`;
  }

  if (metricType === "attempts") {
    return `${log.attempts ?? 0} attempts`;
  }

  return log.notes?.trim() || "Milestone logged";
}

function calcProgress(bestValue: number | null, targetValue: number | null) {
  if (!bestValue || !targetValue || targetValue <= 0) return 0;
  return Math.max(0, Math.min(100, (bestValue / targetValue) * 100));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export default function SkillDetailScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { skillId, userSkillId: routeUserSkillId, initialStatus } =
    useLocalSearchParams<{
      skillId: string;
      userSkillId?: string;
      initialStatus?: SkillDbStatus | string;
    }>();

  const {
    loading,
    userId,
    skill,
    userSkill,
    stages,
    logs,
    milestones,
    currentStage,
    currentStageIndex,
    bestLog,
    latestLog,
    refresh,
    setState,
  } = useSkillDetail(skillId);

  const routeInitialStatus = useMemo(
    () => (initialStatus ? normalizeSkillStatus(initialStatus) : null),
    [initialStatus]
  );
  const syncedRouteStatus = useMemo(
    () => (routeUserSkillId ? getSkillStatusSync(routeUserSkillId) : null) ?? null,
    [routeUserSkillId]
  );

  const [savingLog, setSavingLog] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [localStatusOverride, setLocalStatusOverride] = useState<SkillDbStatus | null>(
    syncedRouteStatus ?? routeInitialStatus
  );
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [draft, setDraft] = useState<QuickLogDraft>({
    value: "",
    attempts: "",
    notes: "",
  });

  const { toast, showToast, animatedStyle } = useAchievementUnlocks();

  const goToSkillsHome = () => {
    router.replace("/skills");
  };

  const syncSystemsAndNotify = async () => {
    if (!userId) return;

    const [, newlyUnlocked] = await Promise.all([
      syncSkillChallengesForUser(userId),
      syncSkillAchievementsForUserWithResult(userId),
    ]);

    emitSkillChallengesChanged();
    emitSkillsDashboardChanged();

    if (newlyUnlocked.length > 0) {
      showToast({
        id: newlyUnlocked[0].definition.id,
        name: newlyUnlocked[0].definition.name,
      });
    }
  };

  useEffect(() => {
    if (!showQuickLog || !skill) return;

    setDraft((prev) => {
      const next = { ...prev };

      if (
        (skill.metric_type === "seconds" || skill.metric_type === "reps") &&
        !prev.value.trim() &&
        latestLog?.value != null
      ) {
        next.value = String(latestLog.value);
      }

      if (
        skill.metric_type === "attempts" &&
        !prev.attempts.trim() &&
        latestLog?.attempts != null
      ) {
        next.attempts = String(latestLog.attempts);
      }

      if (!prev.notes.trim() && latestLog?.notes?.trim()) {
        next.notes = latestLog.notes.trim();
      }

      return next;
    });
  }, [showQuickLog, latestLog, skill]);

  const resolvedUserSkillId = userSkill?.id;
  const resolvedUserSkillStatus = userSkill?.status;

  useEffect(() => {
    setLocalStatusOverride(syncedRouteStatus ?? routeInitialStatus ?? null);
  }, [routeInitialStatus, skillId, syncedRouteStatus]);

  useEffect(() => {
    return subscribeSkillStatusSync(({ userSkillId, status }) => {
      const targetUserSkillId = resolvedUserSkillId ?? routeUserSkillId;
      if (!targetUserSkillId || userSkillId !== targetUserSkillId) return;

      setLocalStatusOverride(status);
      setState((prev) => ({
        ...prev,
        userSkill: prev.userSkill
          ? {
            ...prev.userSkill,
            status,
          }
          : prev.userSkill,
      }));
    });
  }, [resolvedUserSkillId, routeUserSkillId, setState]);

  useEffect(() => {
    if (!resolvedUserSkillId || !resolvedUserSkillStatus) return;

    const normalizedResolvedStatus = normalizeSkillStatus(resolvedUserSkillStatus);
    const syncedStatus = getSkillStatusSync(resolvedUserSkillId);

    setLocalStatusOverride((prev) => {
      const nextStatus = syncedStatus ?? normalizedResolvedStatus;
      if (prev === nextStatus) return prev;
      return nextStatus;
    });
  }, [resolvedUserSkillId, resolvedUserSkillStatus]);

  const effectiveStatus = useMemo(() => {
    const activeUserSkillId = resolvedUserSkillId ?? routeUserSkillId;
    const syncedStatus = activeUserSkillId ? getSkillStatusSync(activeUserSkillId) : null;

    if (syncedStatus) return syncedStatus;
    if (localStatusOverride) return localStatusOverride;
    if (userSkill) return normalizeSkillStatus(userSkill.status);
    return routeInitialStatus ?? SKILL_STATUS.ACTIVE;
  }, [localStatusOverride, resolvedUserSkillId, routeInitialStatus, routeUserSkillId, userSkill]);

  const handleQuickLogSave = async () => {
    if (!skill || !userSkill || !userId) return;

    try {
      setSavingLog(true);

      let valueToInsert: number | null = null;
      let attemptsToInsert: number | null = null;

      if (skill.metric_type === "seconds" || skill.metric_type === "reps") {
        if (!draft.value.trim()) {
          Alert.alert("Value required", "Please enter a value first.");
          return;
        }

        valueToInsert = Number(draft.value);

        if (Number.isNaN(valueToInsert)) {
          Alert.alert("Invalid value", "Please enter a valid number.");
          return;
        }
      }

      if (skill.metric_type === "attempts") {
        if (!draft.attempts.trim()) {
          Alert.alert(
            "Attempts required",
            "Please enter the number of attempts."
          );
          return;
        }

        attemptsToInsert = Number(draft.attempts);

        if (Number.isNaN(attemptsToInsert)) {
          Alert.alert("Invalid attempts", "Please enter a valid number.");
          return;
        }
      }

      const now = new Date().toISOString();

      const { error: insertError } = await supabase.from("skill_logs").insert({
        user_id: userSkill.user_id,
        user_skill_id: userSkill.id,
        skill_id: skill.id,
        stage_id: currentStage?.id ?? null,
        value: valueToInsert,
        unit:
          skill.metric_type === "seconds"
            ? "s"
            : skill.metric_type === "reps"
              ? "reps"
              : null,
        attempts: attemptsToInsert,
        notes: draft.notes.trim() || null,
        logged_at: now,
      });

      if (insertError) throw insertError;

      const { error: userSkillUpdateError } = await supabase
        .from("user_skills")
        .update({ last_logged_at: now })
        .eq("id", userSkill.id);

      if (userSkillUpdateError) throw userSkillUpdateError;

      if (
        currentStage &&
        valueToInsert != null &&
        currentStage.target_value != null &&
        valueToInsert >= Number(currentStage.target_value)
      ) {
        const alreadyDone = milestones.some((m) => m.stage_id === currentStage.id);

        if (!alreadyDone) {
          const { error: milestoneInsertError } = await supabase
            .from("user_skill_milestones")
            .insert({
              user_id: userSkill.user_id,
              user_skill_id: userSkill.id,
              skill_id: skill.id,
              stage_id: currentStage.id,
              best_value: valueToInsert,
              note: draft.notes.trim() || null,
            });

          if (milestoneInsertError) throw milestoneInsertError;
        }
      }

      setState((prev) => ({
        ...prev,
        userSkill: prev.userSkill
          ? { ...prev.userSkill, last_logged_at: now }
          : prev.userSkill,
      }));

      setShowQuickLog(false);
      setDraft({ value: "", attempts: "", notes: "" });

      await syncSystemsAndNotify();
      void refresh();
    } catch (err: any) {
      Alert.alert("Could not save log", err?.message ?? "Please try again.");
    } finally {
      setSavingLog(false);
    }
  };

  const handleToggleCompletion = async () => {
    if (!userSkill || !userId) return;

    const previousStatus = effectiveStatus;
    const isCurrentlyComplete = previousStatus === SKILL_STATUS.MASTERED;
    const nextStatus: SkillDbStatus = isCurrentlyComplete
      ? SKILL_STATUS.ACTIVE
      : SKILL_STATUS.MASTERED;

    try {
      setCompletionBusy(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      publishSkillStatusSync({ userSkillId: userSkill.id, status: nextStatus });
      setLocalStatusOverride(nextStatus);

      setState((prev) => ({
        ...prev,
        userSkill: prev.userSkill
          ? {
            ...prev.userSkill,
            status: nextStatus,
          }
          : prev.userSkill,
      }));

      await updateSkillStatus({
        userSkillId: userSkill.id,
        status: nextStatus,
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void syncSystemsAndNotify();
      void refresh();
    } catch (err: any) {
      publishSkillStatusSync({ userSkillId: userSkill.id, status: previousStatus });
      setLocalStatusOverride(previousStatus);
      setState((prev) => ({
        ...prev,
        userSkill: prev.userSkill
          ? {
            ...prev.userSkill,
            status: previousStatus,
          }
          : prev.userSkill,
      }));

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Could not update skill", err?.message ?? "Please try again.");
    } finally {
      setCompletionBusy(false);
    }
  };

  const toggleFavorite = async () => {
    if (!userSkill) return;

    const previousValue = !!userSkill.is_favorite;
    const nextValue = !previousValue;

    try {
      setFavoriteBusy(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setState((prev) => ({
        ...prev,
        userSkill: prev.userSkill
          ? { ...prev.userSkill, is_favorite: nextValue }
          : prev.userSkill,
      }));

      const { error } = await supabase
        .from("user_skills")
        .update({ is_favorite: nextValue })
        .eq("id", userSkill.id);

      if (error) throw error;

      emitSkillsDashboardChanged();
      void refresh();
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        userSkill: prev.userSkill
          ? { ...prev.userSkill, is_favorite: previousValue }
          : prev.userSkill,
      }));

      Alert.alert(
        "Could not update favorite",
        err?.message ?? "Please try again."
      );
    } finally {
      setFavoriteBusy(false);
    }
  };

  const progressPercent = useMemo(
    () => calcProgress(bestLog?.value ?? null, currentStage?.target_value ?? null),
    [bestLog?.value, currentStage?.target_value]
  );

  const headerTitle = skill?.name ?? "Skill";

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            headerLargeTitle: false,
            title: "Skill",
            headerShadowVisible: false,
            headerStyle: { backgroundColor: t.background },
            headerTintColor: t.text,
            headerLeft: () => (
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={goToSkillsHome}
                style={styles.headerBackButton}
              >
                <Ionicons name="chevron-back" size={18} color={t.text} />
                <Text style={[styles.headerBackText, { color: t.text }]}>
                  Skills
                </Text>
              </TouchableOpacity>
            ),
          }}
        />
        <SafeAreaView
          style={[styles.center, { backgroundColor: t.background }]}
          edges={["left", "right", "bottom"]}
        >
          <ActivityIndicator size="large" color={t.text} />
        </SafeAreaView>
      </>
    );
  }

  if (!skill || !userSkill) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            headerLargeTitle: false,
            title: "Skill",
            headerShadowVisible: false,
            headerStyle: { backgroundColor: t.background },
            headerTintColor: t.text,
            headerLeft: () => (
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={goToSkillsHome}
                style={styles.headerBackButton}
              >
                <Ionicons name="chevron-back" size={18} color={t.text} />
                <Text style={[styles.headerBackText, { color: t.text }]}>
                  Skills
                </Text>
              </TouchableOpacity>
            ),
          }}
        />
        <SafeAreaView
          style={[styles.center, { backgroundColor: t.background }]}
          edges={["left", "right", "bottom"]}
        >
          <Ionicons name="alert-circle-outline" size={28} color={t.mutedText} />
          <Text style={[styles.missingTitle, { color: t.text }]}>
            Skill not found
          </Text>
          <Text style={[styles.missingBody, { color: t.mutedText }]}>
            This skill could not be loaded.
          </Text>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={goToSkillsHome}
            style={[
              styles.backButton,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Text style={{ color: t.text, fontWeight: "800" }}>Go to Skills</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </>
    );
  }

  const personalBest = formatLogValue(bestLog, skill.metric_type);
  const latestEntry = formatLogValue(latestLog, skill.metric_type);
  const isComplete = effectiveStatus === SKILL_STATUS.MASTERED;
  const completionButtonLabel = isComplete
    ? "Mark In Progress"
    : "Mark Complete";
  const completionNote = isComplete
    ? "This skill is marked complete. You can still log new attempts and keep improving."
    : "Mark this skill complete whenever you feel you have learned it. You can always switch it back later.";
  const stageTargetText =
    currentStage?.target_value != null
      ? `${currentStage.target_value}${currentStage.unit ? ` ${currentStage.unit}` : ""}`
      : "No target yet";

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerLargeTitle: false,
          title: headerTitle,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: t.background },
          headerTintColor: t.text,
          headerTitleStyle: {
            fontWeight: "700",
          },
          headerLeft: () => (
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={goToSkillsHome}
              style={styles.headerBackButton}
            >
              <Ionicons name="chevron-back" size={18} color={t.text} />
              <Text style={[styles.headerBackText, { color: t.text }]}>
                Skills
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <SafeAreaView
        style={[styles.screen, { backgroundColor: t.background }]}
        edges={["left", "right", "bottom"]}
      >
        {toast ? (
          <Animated.View pointerEvents="none" style={[styles.toastWrap, animatedStyle]}>
            <View
              style={[
                styles.toastCard,
                { backgroundColor: t.card, borderColor: t.border },
              ]}
            >
              <Ionicons name="trophy" size={18} color={t.text} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.toastTitle, { color: t.text }]}>
                  Achievement Unlocked
                </Text>
                <Text style={[styles.toastBody, { color: t.mutedText }]}>
                  {toast.name}
                </Text>
              </View>
            </View>
          </Animated.View>
        ) : null}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: t.card,
                borderColor: isComplete ? t.link : t.border,
              },
            ]}
          >
            <View style={styles.heroTop}>
              <View style={styles.heroLeft}>
                <View
                  style={[
                    styles.heroIconWrap,
                    { backgroundColor: isComplete ? t.link : t.cardAlt },
                  ]}
                >
                  <Ionicons
                    name={isComplete ? "checkmark-circle-outline" : "flash-outline"}
                    size={18}
                    color={isComplete ? "white" : t.text}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroTitle, { color: t.text }]}>
                    {skill.name}
                  </Text>
                  <Text style={[styles.heroDescription, { color: t.mutedText }]}>
                    {skill.short_description ||
                      "Track your progression and keep building this skill."}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                disabled={favoriteBusy}
                onPress={() => void toggleFavorite()}
                style={[
                  styles.favoriteButton,
                  { backgroundColor: t.cardAlt, borderColor: t.border },
                ]}
              >
                {favoriteBusy ? (
                  <ActivityIndicator size="small" color={t.text} />
                ) : (
                  <Ionicons
                    name={userSkill.is_favorite ? "star" : "star-outline"}
                    size={18}
                    color={userSkill.is_favorite ? t.link : t.text}
                  />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.metaRow}>
              <MetaPill label={skill.category} />
              <MetaPill label={skill.difficulty} />
              <MetaPill label={skill.metric_type} />
              <MetaPill label={isComplete ? "Complete" : "In Progress"} />
            </View>

            <View
              style={[
                styles.quickStatsRow,
                { backgroundColor: t.cardAlt, borderColor: t.border },
              ]}
            >
              <MiniStat label="Current Stage" value={currentStage?.name ?? "Not set"} />
              <MiniStat label="Target" value={stageTargetText} />
              <MiniStat label="Last Log" value={formatDate(userSkill.last_logged_at)} />
            </View>

            <View
              style={[
                styles.completionPanel,
                { backgroundColor: t.background, borderColor: t.border },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.completionTitle, { color: t.text }]}>
                  {isComplete ? "Skill complete" : "Manual completion"}
                </Text>
                <Text style={[styles.completionBody, { color: t.mutedText }]}>
                  {completionNote}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                disabled={completionBusy}
                onPress={() => void handleToggleCompletion()}
                style={[
                  styles.completionButton,
                  {
                    backgroundColor: isComplete ? t.cardAlt : t.link,
                    borderColor: isComplete ? t.border : t.link,
                    opacity: completionBusy ? 0.72 : 1,
                  },
                ]}
              >
                {completionBusy ? (
                  <ActivityIndicator
                    size="small"
                    color={isComplete ? t.text : "white"}
                  />
                ) : (
                  <Text
                    style={[
                      styles.completionButtonText,
                      { color: isComplete ? t.text : "white" },
                    ]}
                  >
                    {completionButtonLabel}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <StatCard label="Best" value={personalBest} />
            <StatCard label="Latest" value={latestEntry} />
            <StatCard
              label="Progress"
              value={`${Math.round(progressPercent)}%`}
            />
            <StatCard
              label="Milestones"
              value={String(milestones.length)}
            />
          </View>

          <View
            style={[
              styles.progressCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>
                Progress
              </Text>

              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => setShowQuickLog(true)}
                style={[styles.inlineActionButton, { backgroundColor: t.link }]}
              >
                <Ionicons name="add" size={16} color="white" />
                <Text style={styles.inlineActionButtonText}>Quick Log</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.progressTrack, { backgroundColor: t.cardAlt }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPercent}%`,
                    backgroundColor: t.link,
                  },
                ]}
              />
            </View>

            <Text style={[styles.progressText, { color: t.mutedText }]}>
              {progressPercent > 0
                ? `${Math.round(progressPercent)}% toward the current stage target`
                : "Start logging to see your progress build up here."}
            </Text>

            <Text style={[styles.progressHelper, { color: t.mutedText }]}>
              Your logs keep tracking progress even if the skill is marked complete.
            </Text>
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: t.text }]}>
              Progression Path
            </Text>

            <View style={{ marginTop: 10 }}>
              {stages.length === 0 ? (
                <Text style={[styles.sectionBody, { color: t.mutedText }]}>
                  No progression stages yet.
                </Text>
              ) : (
                stages.map((stage, index) => {
                  const isCompleted =
                    milestones.some((m) => m.stage_id === stage.id) ||
                    index < currentStageIndex;
                  const isCurrent = currentStage?.id === stage.id;
                  const isUpcoming = !isCompleted && !isCurrent;

                  return (
                    <View key={stage.id} style={styles.stageRow}>
                      <View style={styles.stageLeft}>
                        <View
                          style={[
                            styles.stageDot,
                            {
                              backgroundColor: isCurrent
                                ? t.link
                                : isCompleted
                                  ? t.text
                                  : t.cardAlt,
                              borderColor: isUpcoming ? t.border : "transparent",
                            },
                          ]}
                        />
                        {index < stages.length - 1 ? (
                          <View
                            style={[styles.stageLine, { backgroundColor: t.border }]}
                          />
                        ) : null}
                      </View>

                      <View
                        style={[
                          styles.stageCard,
                          {
                            backgroundColor: isCurrent ? t.cardAlt : t.background,
                            borderColor: isCurrent ? t.link : t.border,
                          },
                        ]}
                      >
                        <View style={styles.stageTopRow}>
                          <Text style={[styles.stageName, { color: t.text }]}>
                            {stage.name}
                          </Text>
                          {isCurrent ? (
                            <View
                              style={[
                                styles.currentBadge,
                                { backgroundColor: t.link },
                              ]}
                            >
                              <Text style={styles.currentBadgeText}>Current</Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={[styles.stageDesc, { color: t.mutedText }]}>
                          {stage.description ||
                            (stage.target_value != null
                              ? `Target: ${stage.target_value}${stage.unit ? ` ${stage.unit}` : ""}`
                              : isUpcoming
                                ? "Upcoming stage"
                                : "Progression stage")}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: t.text }]}>
              Recent History
            </Text>

            <View style={{ marginTop: 8 }}>
              {logs.slice(0, 6).map((log, index) => (
                <View
                  key={`${log.id}-${index}`}
                  style={[
                    styles.logRow,
                    {
                      backgroundColor: t.cardAlt,
                      borderColor: t.border,
                    },
                  ]}
                >
                  <View
                    style={[styles.logIconWrap, { backgroundColor: t.background }]}
                  >
                    <Ionicons name="time-outline" size={15} color={t.text} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.logTitle, { color: t.text }]}>
                      {new Date(log.logged_at).toLocaleDateString()}
                    </Text>
                    <Text style={[styles.logBody, { color: t.mutedText }]}>
                      {formatLogValue(log, skill.metric_type)}
                    </Text>
                  </View>
                </View>
              ))}

              {logs.length === 0 ? (
                <Text style={[styles.sectionBody, { color: t.mutedText }]}>
                  No history yet. Log your first skill session.
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: t.text }]}>
              Milestones
            </Text>

            {milestones.length > 0 ? (
              <View style={{ marginTop: 10, gap: 10 }}>
                {milestones.map((milestone) => {
                  const stage = stages.find((s) => s.id === milestone.stage_id);

                  return (
                    <View
                      key={milestone.id}
                      style={[
                        styles.milestoneRow,
                        {
                          backgroundColor: t.cardAlt,
                          borderColor: t.border,
                        },
                      ]}
                    >
                      <Ionicons name="checkmark-circle" size={18} color={t.text} />
                      <Text style={[styles.milestoneBody, { color: t.text }]}>
                        {stage?.name ?? "Completed stage"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text
                style={[
                  styles.sectionBody,
                  { color: t.mutedText, marginTop: 10 },
                ]}
              >
                Milestones you unlock for this skill will appear here.
              </Text>
            )}
          </View>
        </ScrollView>

        <Modal
          visible={showQuickLog}
          transparent
          animationType="fade"
          onRequestClose={() => setShowQuickLog(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: t.card, borderColor: t.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: t.text }]}>Quick Log</Text>
              <Text style={[styles.modalSubtitle, { color: t.mutedText }]}>
                Add a new progress entry for {skill.name}.
              </Text>

              {(skill.metric_type === "seconds" ||
                skill.metric_type === "reps") && (
                  <TextInput
                    value={draft.value}
                    onChangeText={(value) =>
                      setDraft((prev) => ({ ...prev, value }))
                    }
                    keyboardType="numeric"
                    placeholder={
                      skill.metric_type === "seconds"
                        ? "Enter seconds"
                        : "Enter reps"
                    }
                    placeholderTextColor={t.mutedText}
                    style={[
                      styles.input,
                      {
                        borderColor: t.border,
                        backgroundColor: t.background,
                        color: t.text,
                      },
                    ]}
                  />
                )}

              {skill.metric_type === "attempts" && (
                <TextInput
                  value={draft.attempts}
                  onChangeText={(attempts) =>
                    setDraft((prev) => ({ ...prev, attempts }))
                  }
                  keyboardType="numeric"
                  placeholder="Enter attempts"
                  placeholderTextColor={t.mutedText}
                  style={[
                    styles.input,
                    {
                      borderColor: t.border,
                      backgroundColor: t.background,
                      color: t.text,
                    },
                  ]}
                />
              )}

              <TextInput
                value={draft.notes}
                onChangeText={(notes) =>
                  setDraft((prev) => ({ ...prev, notes }))
                }
                placeholder="Notes (optional)"
                placeholderTextColor={t.mutedText}
                multiline
                textAlignVertical="top"
                style={[
                  styles.input,
                  styles.notesInput,
                  {
                    borderColor: t.border,
                    backgroundColor: t.background,
                    color: t.text,
                  },
                ]}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    setShowQuickLog(false);
                    setDraft({ value: "", attempts: "", notes: "" });
                  }}
                  style={[
                    styles.secondaryButton,
                    {
                      borderColor: t.border,
                      backgroundColor: t.cardAlt,
                    },
                  ]}
                >
                  <Text style={[styles.secondaryButtonText, { color: t.text }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={savingLog}
                  onPress={() => void handleQuickLogSave()}
                  style={[
                    styles.primaryButtonSmall,
                    { backgroundColor: t.link, opacity: savingLog ? 0.7 : 1 },
                  ]}
                >
                  {savingLog ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );

  function MetaPill({ label }: { label: string }) {
    return (
      <View
        style={[
          styles.metaPill,
          {
            backgroundColor: t.cardAlt,
            borderColor: t.border,
          },
        ]}
      >
        <Text style={[styles.metaPillText, { color: t.text }]}>{label}</Text>
      </View>
    );
  }

  function StatCard({ label, value }: { label: string; value: string }) {
    return (
      <View
        style={[
          styles.statCard,
          {
            backgroundColor: t.card,
            borderColor: t.border,
          },
        ]}
      >
        <Text style={[styles.statValue, { color: t.text }]} numberOfLines={2}>
          {value}
        </Text>
        <Text style={[styles.statLabel, { color: t.mutedText }]}>{label}</Text>
      </View>
    );
  }

  function MiniStat({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.miniStat}>
        <Text style={[styles.miniStatLabel, { color: t.mutedText }]}>
          {label}
        </Text>
        <Text style={[styles.miniStatValue, { color: t.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  headerBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingRight: 8,
  },
  headerBackText: {
    fontSize: 13.5,
    fontWeight: "800",
  },

  toastWrap: {
    position: "absolute",
    top: 10,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  toastCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  toastTitle: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  toastBody: {
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: "600",
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 14,
  },

  missingTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: "800",
  },
  missingBody: {
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
    fontSize: 14,
  },
  backButton: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  heroCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  heroIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  favoriteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
  },
  heroDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  metaPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },

  quickStatsRow: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    gap: 12,
  },
  miniStat: {
    flex: 1,
  },
  miniStatLabel: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  miniStatValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "800",
  },

  completionPanel: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  completionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  completionBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  completionButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  completionButtonText: {
    fontSize: 14,
    fontWeight: "800",
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    minWidth: "47%",
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
  },
  statLabel: {
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "600",
  },

  progressCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
  },

  inlineActionButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineActionButtonText: {
    color: "white",
    fontSize: 12.5,
    fontWeight: "800",
  },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 12,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressText: {
    marginTop: 10,
    fontSize: 13.5,
    fontWeight: "700",
  },
  progressHelper: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
  },

  stageRow: {
    flexDirection: "row",
    gap: 12,
  },
  stageLeft: {
    alignItems: "center",
  },
  stageDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    marginTop: 8,
  },
  stageLine: {
    width: 2,
    flex: 1,
    minHeight: 44,
    marginVertical: 4,
  },
  stageCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  stageTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  stageName: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "800",
  },
  currentBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  currentBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "800",
  },
  stageDesc: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
  },

  logRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  logIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  logTitle: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  logBody: {
    marginTop: 2,
    fontSize: 12.5,
    lineHeight: 18,
  },

  milestoneRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  milestoneBody: {
    fontSize: 13.5,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    maxHeight: "84%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  modalSubtitle: {
    marginTop: 8,
    marginBottom: 14,
    textAlign: "center",
    fontSize: 13.5,
    lineHeight: 19,
  },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  notesInput: {
    minHeight: 110,
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  primaryButtonSmall: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "800",
  },
});
