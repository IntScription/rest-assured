import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { supabase } from "@/src/lib/supabase";
import {
  getOnboardingStep,
  isOnboardingActive,
  setOnboardingStep,
  stopOnboarding,
} from "@/src/lib/onboarding";
import { useAppTheme } from "@/src/theme/theme";
import { useCustomTabBarBottomPadding } from "@/components/navigation/CustomTabBar";
import OnboardingBanner from "@/src/components/OnboardingBanner";
import type { Program, ThemeType } from "@/src/features/train/types";

import {
  EmptyStateCard,
  SectionHeader,
  SectionShell,
} from "@/src/features/train/components/SectionShell";
import TrainProgramCard from "@/src/features/train/components/TrainProgramCard";
import { MissedWorkoutPrompt } from "@/src/features/train/components/MissedWorkoutPrompt";
import { TodaysMissionCard } from "@/src/features/train/components/TodaysMissionCard";
import { TrainingHeatmap } from "@/src/features/train/components/TrainingHeatmap";
import { UpcomingWeekStrip } from "@/src/features/train/components/UpcomingWeekStrip";
import { WorkoutDateCard } from "@/src/features/train/components/WorkoutDateCard";
import { useTrainData } from "@/src/features/train/hooks/useTrainData";
import { useTrainingCalendar } from "@/src/features/train/hooks/useTrainingCalendar";
import { getTodayDateString } from "@/src/features/train/lib/calendarDates";
import { ShareProgramModal } from "@/src/features/train/components/modals/ShareProgramModal";
import { ManageProgramModal } from "@/src/features/train/components/modals/ManageProgramModal";
import { SharedActivityModal } from "@/src/features/train/components/modals/SharedActivityModal";
import { CreateEditModal } from "@/src/features/train/components/modals/CreateEditModal";

type CreateModalState = {
  visible: boolean;
  type: "program" | "split";
  mode: "create" | "rename";
  value: string;
  targetId: string | null;
};

function isDarkHex(color?: string) {
  if (!color?.startsWith("#")) return false;

  const raw = color.replace("#", "");
  const hex =
    raw.length === 3
      ? raw
        .split("")
        .map((ch) => ch + ch)
        .join("")
      : raw;

  const value = Number.parseInt(hex.slice(0, 6), 16);

  if (Number.isNaN(value)) return false;

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return 0.299 * r + 0.587 * g + 0.114 * b < 150;
}

function getTrainScreenPalette(isDark: boolean) {
  return {
    base: isDark ? "#050B16" : "#EAF2FF",
    glowPrimary: isDark ? "rgba(59,130,246,0.20)" : "rgba(37,99,235,0.18)",
    glowSecondary: isDark ? "rgba(34,197,94,0.14)" : "rgba(16,185,129,0.13)",
    glowWarm: isDark ? "rgba(245,158,11,0.10)" : "rgba(245,158,11,0.12)",
  };
}

const initialCreateModal: CreateModalState = {
  visible: false,
  type: "program",
  mode: "create",
  value: "",
  targetId: null,
};

export default function TrainScreen() {
  const t = useAppTheme() as ThemeType;
  const router = useRouter();
  const bottomPadding = useCustomTabBarBottomPadding(26);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const {
    programs,
    activeProgram,
    activeProgramId,
    splitCountsByProgram,
    pendingShares,
    sentShares,
    recentImports,
    programImports,
    screenLoading,
    refreshing,
    handleRefresh,
    setActiveProgram,
    deleteItem,
    manageSplits,
    fetchSplitsForProgram,
    reorderSplits,
    handleAcceptShare,
    handleDeclineShare,
    busy,
  } = useTrainData(userId);

  const {
    selectedDate,
    setSelectedDate,
    selectedPlannedSplit,
    completedDates,
    loggedDates,
    skippedDates,
    missedDates,
    selectedDateIsMissed,
    markSelectedDateSkipped,
    shiftCycleToSelectedSplit,
    fetchCalendarDates,
  } = useTrainingCalendar({
    userId,
    activeProgram,
    splits: manageSplits,
  });

  const [dismissedMissedDates, setDismissedMissedDates] = useState<Set<string>>(new Set());

  const dismissMissedPrompt = useCallback((date: string) => {
    setDismissedMissedDates((prev) => new Set(prev).add(date));
  }, []);

  const handleKeepSchedule = useCallback(() => {
    dismissMissedPrompt(selectedDate);
  }, [dismissMissedPrompt, selectedDate]);

  const handleShiftCycle = useCallback(async () => {
    const date = selectedDate;
    await shiftCycleToSelectedSplit();
    dismissMissedPrompt(date);
  }, [dismissMissedPrompt, selectedDate, shiftCycleToSelectedSplit]);

  const handleMarkSkipped = useCallback(async () => {
    const date = selectedDate;
    await markSelectedDateSkipped();
    dismissMissedPrompt(date);
  }, [dismissMissedPrompt, markSelectedDateSkipped, selectedDate]);

  const [programsExpanded, setProgramsExpanded] = useState(true);
  const [programFilter, setProgramFilter] = useState<
    "all" | "own" | "imported"
  >("all");
  const [sharedVisible, setSharedVisible] = useState(false);
  const [shareProgram, setShareProgram] = useState<Program | null>(null);
  const [manageProgram, setManageProgram] = useState<Program | null>(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [createModal, setCreateModal] =
    useState<CreateModalState>(initialCreateModal);
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState<string>("idle");
  const [tourProgramId, setTourProgramId] = useState<string | null>(null);

  const appBusy = busy || actionBusy;
  const isDark = useMemo(
    () => isDarkHex(t.background) || isDarkHex(t.card),
    [t.background, t.card]
  );
  const statusBarStyle = isDark ? "light-content" : "dark-content";
  const screenPalette = useMemo(() => getTrainScreenPalette(isDark), [isDark]);

  const backgroundFloatA = useRef(new Animated.Value(0)).current;
  const backgroundFloatB = useRef(new Animated.Value(0)).current;
  const backgroundFloatC = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    backgroundFloatA.setValue(0);
    backgroundFloatB.setValue(0);
    backgroundFloatC.setValue(0);

    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(backgroundFloatA, {
            toValue: 1,
            duration: 18000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(backgroundFloatA, {
            toValue: 0,
            duration: 18000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(backgroundFloatB, {
            toValue: 1,
            duration: 22000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(backgroundFloatB, {
            toValue: 0,
            duration: 22000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(backgroundFloatC, {
            toValue: 1,
            duration: 26000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(backgroundFloatC, {
            toValue: 0,
            duration: 26000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [backgroundFloatA, backgroundFloatB, backgroundFloatC]);

  const trainGlowTopMotion = {
    transform: [
      {
        translateX: backgroundFloatA.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -22],
        }),
      },
      {
        translateY: backgroundFloatA.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 18],
        }),
      },
      {
        scale: backgroundFloatA.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.05],
        }),
      },
    ],
  };

  const trainGlowMidMotion = {
    transform: [
      {
        translateX: backgroundFloatB.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 24],
        }),
      },
      {
        translateY: backgroundFloatB.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -18],
        }),
      },
      {
        scale: backgroundFloatB.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.06],
        }),
      },
    ],
  };

  const trainGlowBottomMotion = {
    transform: [
      {
        translateX: backgroundFloatC.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -18],
        }),
      },
      {
        translateY: backgroundFloatC.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -24],
        }),
      },
      {
        scale: backgroundFloatC.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.045],
        }),
      },
    ],
  };

  const handleRefreshWithCalendar = useCallback(async () => {
    await Promise.all([handleRefresh(), fetchCalendarDates()]);
  }, [fetchCalendarDates, handleRefresh]);

  useEffect(() => {
    if (!activeProgram?.id) return;

    void fetchSplitsForProgram(activeProgram.id);
  }, [activeProgram?.id, fetchSplitsForProgram]);

  const canSharePrograms = !!profile?.username;

  const stats = useMemo(() => {
    const totalSplits = Object.values(splitCountsByProgram).reduce(
      (sum, count) => sum + count,
      0
    );
    const importedPrograms = Object.keys(programImports ?? {}).length;

    return {
      totalPrograms: programs.length,
      totalSplits,
      importedPrograms,
      pendingShares: pendingShares.length,
    };
  }, [
    pendingShares.length,
    programImports,
    programs.length,
    splitCountsByProgram,
  ]);

  const filteredPrograms = useMemo(() => {
    const next = programs.filter((program) => {
      const isImported = !!programImports?.[program.id];

      if (programFilter === "all") return true;
      if (programFilter === "imported") return isImported;

      return !isImported;
    });

    return [...next].sort((a, b) => {
      if (a.id === activeProgramId) return -1;
      if (b.id === activeProgramId) return 1;

      return (
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
      );
    });
  }, [activeProgramId, programFilter, programImports, programs]);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const nextUserId = data?.user?.id ?? null;

      if (!mounted) return;

      setUserId(nextUserId);

      if (!nextUserId) {
        setProfile(null);
        return;
      }

      const { data: nextProfile } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("id", nextUserId)
        .maybeSingle();

      if (mounted) setProfile(nextProfile);
    }

    void loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadTourState = async () => {
        const active = await isOnboardingActive();
        let step = await getOnboardingStep();

        if (!mounted) return;

        if (active && (!step || step === "idle" || step === "profile_intro")) {
          step = "create_program";
          await setOnboardingStep("create_program");
        }

        if (!mounted) return;

        setTourActive(active);
        setTourStep(typeof step === "string" ? step : "idle");
      };

      void loadTourState();

      return () => {
        mounted = false;
      };
    }, [])
  );

  useEffect(() => {
    if (!tourActive || tourProgramId || !activeProgramId) return;
    setTourProgramId(activeProgramId);
  }, [activeProgramId, tourActive, tourProgramId]);

  const tutorialTargetProgramId =
    tourProgramId ?? activeProgramId ?? programs[0]?.id ?? null;

  const openCreateProgram = useCallback(() => {
    setCreateModal({
      visible: true,
      type: "program",
      mode: "create",
      value: "",
      targetId: null,
    });
  }, []);

  const skipTour = useCallback(async () => {
    await stopOnboarding();
    setTourActive(false);
    setTourStep("done");
    setTourProgramId(null);
  }, []);

  const openRenameProgram = useCallback((program: Program) => {
    setCreateModal({
      visible: true,
      type: "program",
      mode: "rename",
      value: program.name,
      targetId: program.id,
    });
  }, []);

  const openShareForProgram = useCallback(
    (program: Program) => {
      if (!profile?.username) {
        Alert.alert(
          "Username required",
          "Set a username in Profile before sharing programs.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Go to Profile", onPress: () => router.push("/profile") },
          ]
        );
        return;
      }

      setShareProgram(program);
    },
    [profile?.username, router]
  );

  const openManageProgram = useCallback(
    async (program: Program) => {
      setManageProgram(program);
      setManageLoading(true);

      try {
        await fetchSplitsForProgram(program.id);
      } finally {
        setManageLoading(false);
      }
    },
    [fetchSplitsForProgram]
  );

  const closeManageProgram = useCallback(() => {
    setManageProgram(null);
    setManageLoading(false);
  }, []);

  const closeCreateModal = useCallback(() => {
    if (actionBusy) return;
    setCreateModal((prev) => ({ ...prev, visible: false }));
  }, [actionBusy]);

  const submitCreateEdit = useCallback(
    async (rawValue: string) => {
      if (!userId || actionBusy) return;

      const name = rawValue.trim();
      if (!name) return;

      const { mode, type, targetId } = createModal;
      let createdProgramId: string | null = null;
      let createdSplitProgramId: string | null = null;
      const shouldActivateCreatedProgramForTour =
        mode === "create" &&
        type === "program" &&
        tourActive &&
        (tourStep === "create_program" || tourStep === "profile_intro");

      try {
        setActionBusy(true);

        if (shouldActivateCreatedProgramForTour) {
          await supabase
            .from("programs")
            .update({ is_active: false })
            .eq("user_id", userId);
        }

        if (mode === "create" && type === "program") {
          const { data, error } = await supabase
            .from("programs")
            .insert([
              {
                user_id: userId,
                name,
                is_active:
                  shouldActivateCreatedProgramForTour || programs.length === 0,
                schedule_anchor_date: getTodayDateString(),
              },
            ])
            .select(
              "id, name, is_active, user_id, created_at, schedule_anchor_date"
            )
            .single();

          if (error) throw error;

          createdProgramId = data?.id ?? null;

          if (createdProgramId) {
            setTourProgramId(createdProgramId);
          }

          if (shouldActivateCreatedProgramForTour && data) {
            await setActiveProgram(data as Program);
          }
        }

        if (mode === "create" && type === "split") {
          if (!targetId) throw new Error("Program id missing.");

          const nextOrderIndex =
            manageSplits.reduce(
              (max, split) => Math.max(max, split.order_index ?? 0),
              -1
            ) + 1;

          const { data, error } = await supabase
            .from("splits")
            .insert([
              {
                user_id: userId,
                program_id: targetId,
                name,
                order_index: nextOrderIndex,
              },
            ])
            .select("id, program_id")
            .single();

          if (error) throw error;

          createdSplitProgramId = (data as any)?.program_id ?? targetId;
          setTourProgramId(createdSplitProgramId);
        }

        if (mode === "rename") {
          if (!targetId) throw new Error("Target id missing.");

          const table = type === "program" ? "programs" : "splits";

          const { error } = await supabase
            .from(table)
            .update({ name })
            .eq("user_id", userId)
            .eq("id", targetId);

          if (error) throw error;

          if (type === "program") {
            setManageProgram((prev) =>
              prev?.id === targetId ? { ...prev, name } : prev
            );
          }
        }

        setCreateModal((prev) => ({ ...prev, visible: false }));

        await handleRefreshWithCalendar();

        if (type === "split" && manageProgram?.id) {
          await fetchSplitsForProgram(manageProgram.id);
        }

        if (activeProgram?.id) {
          await fetchSplitsForProgram(activeProgram.id);
        }

        if (
          mode === "create" &&
          type === "program" &&
          tourActive &&
          (tourStep === "create_program" || tourStep === "profile_intro") &&
          createdProgramId
        ) {
          await setOnboardingStep("create_split");
          setTourStep("create_split");
          setProgramsExpanded(true);
          return;
        }

        if (
          mode === "create" &&
          type === "split" &&
          tourActive &&
          tourStep === "create_split"
        ) {
          await setOnboardingStep("go_home");
          setTourStep("go_home");
          if (createdSplitProgramId) setTourProgramId(createdSplitProgramId);
        }
      } catch (error: any) {
        Alert.alert(
          "Could not save",
          String(error?.message ?? "Unknown error")
        );
      } finally {
        setActionBusy(false);
      }
    },
    [
      actionBusy,
      activeProgram?.id,
      createModal,
      fetchSplitsForProgram,
      handleRefreshWithCalendar,
      manageProgram?.id,
      manageSplits,
      programs.length,
      setActiveProgram,
      tourActive,
      tourStep,
      userId,
    ]
  );

  const openCreateSplitForTour = useCallback(async () => {
    if (!tutorialTargetProgramId) {
      await setOnboardingStep("create_program");
      setTourStep("create_program");
      openCreateProgram();
      return;
    }

    setCreateModal({
      visible: true,
      type: "split",
      mode: "create",
      value: "",
      targetId: tutorialTargetProgramId,
    });
  }, [openCreateProgram, tutorialTargetProgramId]);

  const goHomeForTour = useCallback(async () => {
    await setOnboardingStep("go_home");

    if (tutorialTargetProgramId) {
      router.replace({
        pathname: "/(tabs)",
        params: {
          tutorialProgramId: tutorialTargetProgramId,
          programId: tutorialTargetProgramId,
        },
      });
      return;
    }

    router.replace("/(tabs)");
  }, [router, tutorialTargetProgramId]);

  if (screenLoading) {
    return (
      <SafeAreaView
        style={[styles.centerScreen, { backgroundColor: screenPalette.base }]}
      >
        <StatusBar
          hidden={false}
          translucent
          barStyle={statusBarStyle}
          backgroundColor="transparent"
        />
        <ActivityIndicator size="large" color={t.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: screenPalette.base }]}
      edges={["top"]}
    >
      <StatusBar
        hidden={false}
        translucent
        barStyle={statusBarStyle}
        backgroundColor="transparent"
      />

      <View pointerEvents="none" style={styles.backgroundLayer}>
        <Animated.View
          style={[
            styles.backgroundGlow,
            styles.trainGlowTop,
            { backgroundColor: screenPalette.glowPrimary },
            trainGlowTopMotion,
          ]}
        />

        <Animated.View
          style={[
            styles.backgroundGlow,
            styles.trainGlowMid,
            { backgroundColor: screenPalette.glowSecondary },
            trainGlowMidMotion,
          ]}
        />

        <Animated.View
          style={[
            styles.backgroundGlow,
            styles.trainGlowBottom,
            { backgroundColor: screenPalette.glowWarm },
            trainGlowBottomMotion,
          ]}
        />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefreshWithCalendar}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentFrame}>
          {tourActive && tourStep === "create_program" ? (
            <View style={styles.tourBannerWrap}>
              <OnboardingBanner
                t={t}
                title="Create your first program"
                body="This starts your training structure. Add a simple program like Push Pull Legs or Weighted Calisthenics."
                primaryLabel="Create Program"
                onPrimary={openCreateProgram}
                secondaryLabel="Skip Tour"
                onSecondary={skipTour}
              />
            </View>
          ) : null}

          {tourActive && tourStep === "create_split" ? (
            <View style={styles.tourBannerWrap}>
              <OnboardingBanner
                t={t}
                title="Add your first split"
                body="Splits are your training days inside a program. Add one like Push, Pull, Legs, or Upper."
                primaryLabel="Create Split"
                onPrimary={openCreateSplitForTour}
              />
            </View>
          ) : null}

          {tourActive && tourStep === "go_home" ? (
            <View style={styles.tourBannerWrap}>
              <OnboardingBanner
                t={t}
                title="Next: Home"
                body="Now jump to Home. You’ll open the split and create your first exercise from there."
                primaryLabel="Go to Home"
                onPrimary={goHomeForTour}
              />
            </View>
          ) : null}

          <SectionShell t={t}>
            <View style={styles.topStatsRow}>
              <View
                style={[
                  styles.compactGlowCard,
                  {
                    flex: 1,
                    borderColor: isDark
                      ? "rgba(10,132,255,0.42)"
                      : "rgba(10,132,255,0.22)",
                    backgroundColor: isDark
                      ? "rgba(10,132,255,0.10)"
                      : "rgba(10,132,255,0.06)",
                  },
                ]}
              >
                <Text style={[styles.compactGlowLabel, { color: t.mutedText }]}>
                  Active program
                </Text>

                <Text
                  style={[styles.compactGlowValue, { color: t.text }]}
                  numberOfLines={1}
                >
                  {activeProgram?.name ?? "None"}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => {
                  if (!canSharePrograms) router.push("/profile");
                }}
                style={[
                  styles.compactGlowCard,
                  {
                    flex: 1,
                    borderColor: canSharePrograms
                      ? isDark
                        ? "rgba(48,209,88,0.40)"
                        : "rgba(48,209,88,0.20)"
                      : t.border,
                    backgroundColor: canSharePrograms
                      ? isDark
                        ? "rgba(48,209,88,0.10)"
                        : "rgba(48,209,88,0.06)"
                      : t.cardAlt,
                  },
                ]}
              >
                <Text style={[styles.compactGlowLabel, { color: t.mutedText }]}>
                  Sharing
                </Text>

                <Text
                  style={[styles.compactGlowValue, { color: t.text }]}
                  numberOfLines={1}
                >
                  {canSharePrograms ? `@${profile?.username}` : "Set username"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSharedVisible(true)}
                activeOpacity={0.82}
                hitSlop={10}
                style={[
                  styles.shareBtn,
                  { backgroundColor: t.cardAlt, borderColor: t.border },
                ]}
              >
                <Ionicons
                  name="share-social-outline"
                  size={18}
                  color={t.text}
                />

                {pendingShares.length > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {pendingShares.length > 9 ? "9+" : pendingShares.length}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            <View style={styles.calendarCardWrap}>
              <TodaysMissionCard
                t={t}
                selectedDate={selectedDate}
                activeProgram={activeProgram}
                plannedSplit={selectedPlannedSplit}
                completedDates={completedDates}
                loggedDates={loggedDates}
              />

              <WorkoutDateCard
                t={t}
                selectedDate={selectedDate}
                activeProgram={activeProgram}
                splits={manageSplits}
                completedDates={completedDates}
                loggedDates={loggedDates}
                plannedSplit={selectedPlannedSplit}
                onDateChange={setSelectedDate}
              />

              {selectedDateIsMissed && !dismissedMissedDates.has(selectedDate) ? (
                <MissedWorkoutPrompt
                  t={t}
                  selectedDate={selectedDate}
                  plannedSplit={selectedPlannedSplit}
                  completedDates={completedDates}
                  loggedDates={loggedDates}
                  onKeepSchedule={handleKeepSchedule}
                  onShiftCycle={handleShiftCycle}
                  onMarkSkipped={handleMarkSkipped}
                />
              ) : null}

              <UpcomingWeekStrip
                t={t}
                selectedDate={selectedDate}
                activeProgram={activeProgram}
                splits={manageSplits}
                completedDates={completedDates}
                loggedDates={loggedDates}
                skippedDates={skippedDates}
                onSelectDate={setSelectedDate}
              />

              <TrainingHeatmap
                t={t}
                completedDates={completedDates}
                loggedDates={loggedDates}
                missedDates={missedDates}
                skippedDates={skippedDates}
                onSelectDate={setSelectedDate}
              />
            </View>

            <View style={styles.statChipRow}>
              <View
                style={[
                  styles.statChip,
                  { backgroundColor: t.cardAlt, borderColor: t.border },
                ]}
              >
                <Text style={[styles.statChipValue, { color: t.text }]}>
                  {stats.totalPrograms}
                </Text>

                <Text style={[styles.statChipLabel, { color: t.mutedText }]}>
                  Programs
                </Text>
              </View>

              <View
                style={[
                  styles.statChip,
                  { backgroundColor: t.cardAlt, borderColor: t.border },
                ]}
              >
                <Text style={[styles.statChipValue, { color: t.text }]}>
                  {stats.totalSplits}
                </Text>

                <Text style={[styles.statChipLabel, { color: t.mutedText }]}>
                  Splits
                </Text>
              </View>

              <View
                style={[
                  styles.statChip,
                  { backgroundColor: t.cardAlt, borderColor: t.border },
                ]}
              >
                <Text style={[styles.statChipValue, { color: t.text }]}>
                  {stats.importedPrograms}
                </Text>

                <Text style={[styles.statChipLabel, { color: t.mutedText }]}>
                  Imported
                </Text>
              </View>

              <View
                style={[
                  styles.statChip,
                  { backgroundColor: t.cardAlt, borderColor: t.border },
                ]}
              >
                <Text style={[styles.statChipValue, { color: t.text }]}>
                  {stats.pendingShares}
                </Text>

                <Text style={[styles.statChipLabel, { color: t.mutedText }]}>
                  Pending
                </Text>
              </View>
            </View>

            {!canSharePrograms ? (
              <TouchableOpacity
                onPress={() => router.push("/profile")}
                activeOpacity={0.88}
                style={[styles.profileCta, { backgroundColor: t.link }]}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={18}
                  color="white"
                />

                <Text style={styles.profileCtaText}>
                  Set Username in Profile
                </Text>
              </TouchableOpacity>
            ) : null}
          </SectionShell>

          <SectionShell t={t}>
            <SectionHeader
              title="Programs"
              subtitle="Tap a program to activate."
              t={t}
              action={
                <TouchableOpacity
                  onPress={() => setProgramsExpanded((prev) => !prev)}
                  hitSlop={10}
                  activeOpacity={0.75}
                  style={[
                    styles.chevronButton,
                    { backgroundColor: t.cardAlt, borderColor: t.border },
                  ]}
                >
                  <Ionicons
                    name={programsExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={t.text}
                  />
                </TouchableOpacity>
              }
            />

            {programsExpanded ? (
              <View style={styles.programStack}>
                {programs.length === 0 ? (
                  <EmptyStateCard
                    icon="albums-outline"
                    title="No programs yet"
                    message="Create your first training program."
                    actionLabel="Create Program"
                    onAction={openCreateProgram}
                    t={t}
                  />
                ) : (
                  <>
                    <View style={styles.programFilterRow}>
                      {(["all", "own", "imported"] as const).map((item) => {
                        const selected = programFilter === item;
                        const label =
                          item === "all"
                            ? "All"
                            : item === "own"
                              ? "Own"
                              : "Imported";
                        const count =
                          item === "all"
                            ? programs.length
                            : item === "imported"
                              ? programs.filter(
                                (program) => !!programImports?.[program.id]
                              ).length
                              : programs.filter(
                                (program) => !programImports?.[program.id]
                              ).length;

                        return (
                          <TouchableOpacity
                            key={item}
                            onPress={() => setProgramFilter(item)}
                            activeOpacity={0.82}
                            style={[
                              styles.programFilterChip,
                              {
                                borderColor: selected ? t.link : t.border,
                                backgroundColor: selected ? t.cardAlt : t.card,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.programFilterText,
                                { color: selected ? t.text : t.mutedText },
                              ]}
                            >
                              {label}
                            </Text>

                            <View
                              style={[
                                styles.programFilterCount,
                                {
                                  backgroundColor: selected
                                    ? t.link
                                    : t.cardAlt,
                                  borderColor: selected ? t.link : t.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.programFilterCountText,
                                  { color: selected ? "white" : t.mutedText },
                                ]}
                              >
                                {count}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {filteredPrograms.length === 0 ? (
                      <View
                        style={[
                          styles.filteredEmptyCard,
                          { backgroundColor: t.cardAlt, borderColor: t.border },
                        ]}
                      >
                        <Ionicons
                          name={
                            programFilter === "imported"
                              ? "download-outline"
                              : "albums-outline"
                          }
                          size={22}
                          color={t.mutedText}
                        />

                        <Text
                          style={[styles.filteredEmptyTitle, { color: t.text }]}
                        >
                          {programFilter === "imported"
                            ? "No imported programs"
                            : "No own programs"}
                        </Text>

                        <Text
                          style={[
                            styles.filteredEmptyText,
                            { color: t.mutedText },
                          ]}
                        >
                          {programFilter === "imported"
                            ? "Programs received through sharing will appear here after you accept/import them."
                            : "Programs you create yourself will appear here."}
                        </Text>
                      </View>
                    ) : (
                      filteredPrograms.map((program: Program) => {
                        const importedMeta = programImports?.[program.id];

                        return (
                          <TrainProgramCard
                            key={program.id}
                            program={program}
                            isActive={program.id === activeProgramId}
                            splitCount={splitCountsByProgram[program.id] ?? 0}
                            busy={appBusy}
                            t={t}
                            isImported={!!importedMeta}
                            importedByUsername={
                              importedMeta?.shared_by_username ?? null
                            }
                            onPress={() => setActiveProgram(program)}
                            onEdit={() => openRenameProgram(program)}
                            onDelete={() => deleteItem(program.id, "program")}
                            onManage={() => openManageProgram(program)}
                            onShare={() => openShareForProgram(program)}
                          />
                        );
                      })
                    )}
                  </>
                )}

                {programs.length > 0 ? (
                  <TouchableOpacity
                    onPress={openCreateProgram}
                    activeOpacity={0.88}
                    disabled={appBusy}
                    style={[
                      styles.createBtn,
                      { backgroundColor: t.link, opacity: appBusy ? 0.6 : 1 },
                    ]}
                  >
                    <Ionicons name="add" size={18} color="white" />

                    <Text style={styles.createBtnText}>Create Program</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </SectionShell>
        </View>
      </ScrollView>

      <ShareProgramModal
        visible={!!shareProgram}
        program={shareProgram}
        userId={userId}
        profileUsername={profile?.username}
        t={t}
        onClose={() => setShareProgram(null)}
        onSuccess={() => {
          setSharedVisible(true);
          void handleRefreshWithCalendar();
        }}
      />

      <ManageProgramModal
        program={manageProgram}
        splits={manageSplits}
        loading={manageLoading}
        busy={appBusy}
        t={t}
        onClose={closeManageProgram}
        onDragEnd={reorderSplits}
        openCreateSplit={(programId) =>
          setCreateModal({
            visible: true,
            type: "split",
            mode: "create",
            value: "",
            targetId: programId,
          })
        }
        openRename={(item, type) =>
          setCreateModal({
            visible: true,
            type,
            mode: "rename",
            value: item.name,
            targetId: item.id,
          })
        }
        deleteItem={deleteItem}
      />

      <SharedActivityModal
        visible={sharedVisible}
        onClose={() => setSharedVisible(false)}
        pendingShares={pendingShares}
        sentShares={sentShares}
        recentImports={recentImports}
        t={t}
        handleAcceptShare={handleAcceptShare}
        handleDeclineShare={handleDeclineShare}
      />

      <CreateEditModal
        visible={createModal.visible}
        mode={createModal.mode}
        type={createModal.type}
        initialValue={createModal.value}
        busy={appBusy}
        t={t}
        onClose={closeCreateModal}
        onConfirm={submitCreateEdit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFill,
  },
  backgroundGlow: {
    position: "absolute",
    borderRadius: 999,
  },
  trainGlowTop: {
    width: 260,
    height: 260,
    top: -92,
    right: -96,
  },
  trainGlowMid: {
    width: 220,
    height: 220,
    top: 230,
    left: -116,
  },
  trainGlowBottom: {
    width: 280,
    height: 280,
    bottom: -142,
    right: -120,
  },
  centerScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 28,
  },
  contentFrame: {
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  tourBannerWrap: {
    marginBottom: 16,
  },
  topStatsRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  compactGlowCard: {
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
  },
  compactGlowLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  compactGlowValue: {
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },
  calendarCardWrap: {
    marginTop: 14,
  },
  statChipRow: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  statChip: {
    flexGrow: 1,
    flexBasis: "47%",
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statChipValue: {
    fontSize: 16,
    fontWeight: "900",
  },
  statChipLabel: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: "800",
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ff453a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
  profileCta: {
    width: "100%",
    marginTop: 14,
    minHeight: 50,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  profileCtaText: {
    color: "white",
    fontWeight: "900",
  },
  chevronButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  programStack: {
    width: "100%",
    gap: 10,
  },
  programFilterRow: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 2,
  },
  programFilterChip: {
    minHeight: 38,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  programFilterText: {
    fontSize: 13,
    fontWeight: "900",
  },
  programFilterCount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  programFilterCountText: {
    fontSize: 11,
    fontWeight: "900",
  },
  filteredEmptyCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  filteredEmptyTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "900",
  },
  filteredEmptyText: {
    marginTop: 5,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  createBtn: {
    width: "100%",
    marginTop: 14,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    gap: 8,
  },
  createBtnText: {
    color: "white",
    fontWeight: "900",
  },
});
