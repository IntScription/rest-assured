"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated as RNAnimated,
  Easing,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import type { User } from "@supabase/supabase-js";

import { useCustomTabBarBottomPadding } from "@/components/navigation/CustomTabBar";
import OnboardingBanner from "@/src/components/OnboardingBanner";
import { useIsOnline } from "@/hooks/use-is-online";
import { useSyncOnReconnect } from "@/src/hooks/use-sync-on-reconnect";
import { supabase } from "@/src/lib/supabase";
import { cacheGetJson, cacheKey, cacheSetJson } from "@/src/lib/offline-cache";
import {
  getOnboardingStep,
  isOnboardingActive,
  setOnboardingStep,
} from "@/src/lib/onboarding";
import {
  getActiveProgramSnapshot,
  publishActiveProgram,
  subscribeActiveProgram,
} from "@/src/store/active-program";
import { useAppTheme } from "@/src/theme/theme";

import { fetchHomeBundle } from "./api/fetchHomeBundle";
import { SplitPage } from "./components/SplitPage";
import { HomeBottomSections } from "./components/HomeBottomSections";
import { SCREEN_WIDTH } from "./constants";
import { useHomeInsights } from "./hooks/useHomeInsights";
import { useLatestLogEvents } from "./hooks/useLatestLogEvents";
import { styles } from "./styles";
import type {
  ExerciseLite,
  HomeCacheShape,
  LatestLogLite,
  Program,
  SplitLite,
} from "./types";

type CycleRow = {
  id: string;
  user_id?: string | null;
  program_id?: string | null;
  cycle_index?: number | null;
  is_active?: boolean | null;
  started_at?: string | null;
  ended_at?: string | null;
};

const HOME_EMPTY_STATE_DELAY_MS = 650;

const HOME_BACKGROUND = {
  light: "#EAF2FF",
  dark: "#050A14",
};

const HOME_BUBBLES = {
  light: {
    primary: "rgba(37,99,235,0.14)",
    secondary: "rgba(139,92,246,0.10)",
    third: "rgba(16,185,129,0.075)",
  },
  dark: {
    primary: "rgba(59,130,246,0.16)",
    secondary: "rgba(139,92,246,0.13)",
    third: "rgba(16,185,129,0.10)",
  },
};

const SPLIT_BG_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
];

/**
 * Instead of [last, ...splits, first] and teleporting at every edge,
 * we render multiple cycles and start in the middle.
 *
 * This makes 1 → last and last → 1 normal swipes, not clone jumps,
 * which removes the one-frame background/exercise-card blink.
 */
const VIRTUAL_SPLIT_CYCLES = 5;

function getVirtualSplitBaseIndex(splitCount: number) {
  if (splitCount <= 1) return 0;
  return splitCount * Math.floor(VIRTUAL_SPLIT_CYCLES / 2);
}

function getRealSplitIndexFromVirtualIndex(index: number, splitCount: number) {
  if (splitCount <= 1) return index;
  return ((index % splitCount) + splitCount) % splitCount;
}

function isDarkColor(hex: string) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  return luminance < 0.5;
}

function useProgram(user: User | null) {
  const [activeProgram, setActiveProgram] = useState<Program | null>(() =>
    getActiveProgramSnapshot()
  );
  const [programLoading, setProgramLoading] = useState(true);

  const normalizeProgram = useCallback(
    (program: Program | null | undefined): Program | null => {
      if (!program) return null;
      return {
        ...program,
        created_at: program.created_at ?? null,
        is_active: program.is_active ?? false,
      } as Program;
    },
    []
  );

  const lastPublishedProgramRef = useRef<Program | null>(
    getActiveProgramSnapshot()
  );

  const sameProgram = useCallback(
    (a: Program | null | undefined, b: Program | null | undefined) => {
      const left = normalizeProgram(a);
      const right = normalizeProgram(b);

      return (
        left?.id === right?.id &&
        left?.is_active === right?.is_active &&
        left?.name === right?.name &&
        left?.created_at === right?.created_at
      );
    },
    [normalizeProgram]
  );

  const applyProgram = useCallback(
    (program: Program | null | undefined, options?: { publish?: boolean }) => {
      const nextProgram = normalizeProgram(program);

      setActiveProgram((prev) => {
        const prevNormalized = normalizeProgram(prev);
        if (sameProgram(prevNormalized, nextProgram)) return prevNormalized;
        return nextProgram;
      });

      if (
        options?.publish !== false &&
        !sameProgram(lastPublishedProgramRef.current, nextProgram)
      ) {
        lastPublishedProgramRef.current = nextProgram;
        publishActiveProgram(nextProgram);
      } else {
        lastPublishedProgramRef.current = nextProgram;
      }

      setProgramLoading(false);
      return nextProgram;
    },
    [normalizeProgram, sameProgram]
  );

  const fetchProgram = useCallback(
    async (opts?: { silent?: boolean; preferredProgramId?: string | null }) => {
      const silent = opts?.silent ?? false;
      const preferredProgramId =
        opts?.preferredProgramId ?? getActiveProgramSnapshot()?.id ?? null;

      if (!user) {
        applyProgram(null);
        return;
      }

      if (!silent) setProgramLoading(true);

      if (preferredProgramId) {
        const { data: preferredData, error: preferredError } = await supabase
          .from("programs")
          .select("*")
          .eq("id", preferredProgramId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!preferredError && preferredData) {
          applyProgram({ ...(preferredData as Program), is_active: true });
          return;
        }
      }

      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        applyProgram(null);
        return;
      }

      applyProgram((data ?? null) as Program | null);
    },
    [user, applyProgram]
  );

  useEffect(() => {
    const snapshot = getActiveProgramSnapshot();
    if (snapshot) {
      applyProgram(snapshot, { publish: false });
    }

    void fetchProgram({
      silent: false,
      preferredProgramId: snapshot?.id ?? null,
    });
  }, [fetchProgram, applyProgram]);

  useFocusEffect(
    useCallback(() => {
      const snapshot = getActiveProgramSnapshot();
      if (snapshot) {
        applyProgram(snapshot, { publish: false });
      }

      void fetchProgram({
        silent: true,
        preferredProgramId: snapshot?.id ?? null,
      });
    }, [fetchProgram, applyProgram])
  );

  useEffect(() => {
    const unsubscribe = subscribeActiveProgram((program) => {
      const nextProgram = applyProgram(program, { publish: false });

      if (program?.id) {
        void fetchProgram({ silent: true, preferredProgramId: program.id });
      } else if (!nextProgram) {
        void fetchProgram({ silent: true, preferredProgramId: null });
      }
    });

    return unsubscribe;
  }, [applyProgram, fetchProgram]);

  return { activeProgram, programLoading, fetchProgram };
}

function useSplits(
  user: User | null,
  activeProgram: Program | null,
  isOnline: boolean
) {
  const [splits, setSplits] = useState<SplitLite[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listIndex, setListIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const currentSplitIdRef = useRef<string | null>(null);
  const lastProgramIdRef = useRef<string | null>(null);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    currentSplitIdRef.current = splits[currentIndex]?.id ?? null;
  }, [splits, currentIndex]);

  useEffect(() => {
    currentSplitIdRef.current = null;
    lastProgramIdRef.current = null;
    setCurrentIndex(0);
    setListIndex(0);
    setLoading(Boolean(user?.id && activeProgram?.id && isOnline));
  }, [activeProgram?.id, user?.id, isOnline]);

  const fetchSplits = useCallback(
    async (opts?: { preserveSelection?: boolean; silent?: boolean }) => {
      const preserveSelection = opts?.preserveSelection ?? true;
      const silent = opts?.silent ?? false;

      if (!user || !activeProgram) {
        setSplits([]);
        setCurrentIndex(0);
        setListIndex(0);
        setLoading(false);
        currentSplitIdRef.current = null;
        lastProgramIdRef.current = null;
        return;
      }

      if (!isOnline) {
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);

      const isNewProgram = lastProgramIdRef.current !== activeProgram.id;
      const prevId = preserveSelection && !isNewProgram ? currentSplitIdRef.current : null;

      const { data, error } = await supabase
        .from("splits")
        .select("id, name, focus, order_index")
        .eq("program_id", activeProgram.id)
        .eq("user_id", user.id)
        .order("order_index", { ascending: true });

      if (error) {
        if (!silent) setLoading(false);
        return;
      }

      const nextSplits: SplitLite[] = (data ?? []).map((split: any) => ({
        id: split.id,
        name: split.name,
        focus: split.focus ?? null,
        order_index: split.order_index,
      }));

      let nextCurrentIndex = 0;

      if (prevId) {
        const found = nextSplits.findIndex((split) => split.id === prevId);
        if (found >= 0) nextCurrentIndex = found;
      }

      setSplits(nextSplits);
      setCurrentIndex(nextCurrentIndex);
      setListIndex(getVirtualSplitBaseIndex(nextSplits.length) + nextCurrentIndex);

      currentSplitIdRef.current = nextSplits[nextCurrentIndex]?.id ?? null;
      lastProgramIdRef.current = activeProgram.id;

      if (!silent) setLoading(false);
    },
    [user, activeProgram, isOnline]
  );

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user || !activeProgram) {
        setSplits([]);
        setCurrentIndex(0);
        setListIndex(0);
        setLoading(false);
        currentSplitIdRef.current = null;
        lastProgramIdRef.current = null;
        return;
      }

      setLoading(true);
      await fetchSplits({ preserveSelection: true, silent: false });
      if (!mounted) return;
      setLoading(false);
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [user, activeProgram, isOnline, fetchSplits]);

  const loopedSplits = useMemo(() => {
    if (splits.length <= 1) return splits;

    return Array.from({ length: VIRTUAL_SPLIT_CYCLES }).flatMap(() => splits);
  }, [splits]);

  return {
    splits,
    setSplits,
    loopedSplits,
    currentIndex,
    setCurrentIndex,
    listIndex,
    setListIndex,
    loading,
    fetchSplits,
    refetchTimer,
  };
}

function useExercisesAndLatestLogs(
  user: User | null,
  currentSplit: SplitLite | null,
  isOnline: boolean,
  splits: SplitLite[] = [],
  currentIndex = 0
) {
  const [exercisesBySplit, setExercisesBySplit] = useState<Record<string, ExerciseLite[]>>({});
  const [latestLogsByExercise, setLatestLogsByExercise] = useState<Record<string, LatestLogLite | null>>({});
  const [logHistoryByExercise, setLogHistoryByExercise] = useState<Record<string, LatestLogLite[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchSeq = useRef(0);
  const logsFetchSeq = useRef(0);
  const exercisesBySplitRef = useRef(exercisesBySplit);

  useEffect(() => {
    exercisesBySplitRef.current = exercisesBySplit;
  }, [exercisesBySplit]);

  const fetchLatestLogsForExercises = useCallback(
    async (exerciseIds: string[]) => {
      if (!user || !isOnline || exerciseIds.length === 0) return;

      const seq = ++logsFetchSeq.current;

      const { data, error } = await supabase
        .from("logs")
        .select("id, exercise_id, weight, reps, sets, created_at, type, day")
        .eq("user_id", user.id)
        .in("exercise_id", exerciseIds)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });

      if (seq !== logsFetchSeq.current || error) return;

      const nextLatest: Record<string, LatestLogLite | null> = {};
      const nextHistory: Record<string, LatestLogLite[]> = {};

      for (const id of exerciseIds) {
        nextLatest[id] = null;
        nextHistory[id] = [];
      }

      for (const row of (data ?? []) as LatestLogLite[]) {
        if (!nextLatest[row.exercise_id]) nextLatest[row.exercise_id] = row;
        if (!nextHistory[row.exercise_id]) nextHistory[row.exercise_id] = [];
        if (nextHistory[row.exercise_id].length < 15) {
          nextHistory[row.exercise_id].push(row);
        }
      }

      setLatestLogsByExercise((prev) => ({ ...prev, ...nextLatest }));
      setLogHistoryByExercise((prev) => ({ ...prev, ...nextHistory }));
    },
    [user, isOnline]
  );

  const fetchExercises = useCallback(
    (splitId: string | null) => {
      const doFetch = async () => {
        if (!user || !splitId || !isOnline) return;

        const seq = ++fetchSeq.current;

        const { data, error } = await supabase
          .from("exercises")
          .select("id, name, slug")
          .eq("split_id", splitId)
          .eq("user_id", user.id)
          .order("id", { ascending: true });

        if (seq !== fetchSeq.current || error) return;

        const next: ExerciseLite[] = (data ?? []).map((exercise: any) => ({
          id: exercise.id,
          name: exercise.name,
          slug: exercise.slug ?? null,
        }));

        setExercisesBySplit((prev) => ({ ...prev, [splitId]: next }));

        const exerciseIds = next.map((exercise) => exercise.id);
        if (exerciseIds.length > 0) {
          await fetchLatestLogsForExercises(exerciseIds);
        }
      };

      void doFetch();
    },
    [user, isOnline, fetchLatestLogsForExercises]
  );


  const prefetchExercisesForSplits = useCallback(
    (splitIds: (string | null | undefined)[]) => {
      const doPrefetch = async () => {
        if (!user || !isOnline) return;

        const uniqueSplitIds = Array.from(
          new Set(splitIds.filter((id): id is string => !!id))
        );

        const missingSplitIds = uniqueSplitIds.filter(
          (splitId) => !(splitId in exercisesBySplitRef.current)
        );

        if (missingSplitIds.length === 0) return;

        const { data, error } = await supabase
          .from("exercises")
          .select("id, name, slug, split_id")
          .eq("user_id", user.id)
          .in("split_id", missingSplitIds)
          .order("id", { ascending: true });

        if (error) return;

        const grouped: Record<string, ExerciseLite[]> = {};
        for (const splitId of missingSplitIds) grouped[splitId] = [];

        const exerciseIds: string[] = [];

        for (const exercise of data ?? []) {
          const splitId = (exercise as any).split_id as string | null;
          if (!splitId) continue;

          if (!grouped[splitId]) grouped[splitId] = [];

          grouped[splitId].push({
            id: (exercise as any).id,
            name: (exercise as any).name,
            slug: (exercise as any).slug ?? null,
          });

          exerciseIds.push((exercise as any).id);
        }

        setExercisesBySplit((prev) => ({ ...prev, ...grouped }));

        if (exerciseIds.length > 0) {
          await fetchLatestLogsForExercises(exerciseIds);
        }
      };

      void doPrefetch();
    },
    [user, isOnline, fetchLatestLogsForExercises]
  );

  useEffect(() => {
    if (currentSplit?.id && !exercisesBySplit[currentSplit.id]) {
      fetchExercises(currentSplit.id);
    } else if (currentSplit?.id) {
      const existing = exercisesBySplit[currentSplit.id] ?? [];
      const missingLatest = existing
        .map((exercise) => exercise.id)
        .filter((id) => !(id in latestLogsByExercise));

      if (missingLatest.length > 0) {
        void fetchLatestLogsForExercises(missingLatest);
      }
    }

    setEditingId(null);
    setEditValue("");
  }, [
    currentSplit?.id,
    exercisesBySplit,
    latestLogsByExercise,
    fetchExercises,
    fetchLatestLogsForExercises,
  ]);


  useEffect(() => {
    if (!splits.length) return;

    const wrapIndex = (index: number) =>
      ((index % splits.length) + splits.length) % splits.length;

    prefetchExercisesForSplits([
      splits[wrapIndex(currentIndex)]?.id,
      splits[wrapIndex(currentIndex - 1)]?.id,
      splits[wrapIndex(currentIndex + 1)]?.id,
      splits[wrapIndex(currentIndex - 2)]?.id,
      splits[wrapIndex(currentIndex + 2)]?.id,
    ]);

    const restTimer = setTimeout(() => {
      prefetchExercisesForSplits(splits.map((split) => split.id));
    }, 260);

    return () => clearTimeout(restTimer);
  }, [splits, currentIndex, prefetchExercisesForSplits]);

  return {
    exercisesBySplit,
    setExercisesBySplit,
    latestLogsByExercise,
    setLatestLogsByExercise,
    logHistoryByExercise,
    setLogHistoryByExercise,
    editingId,
    setEditingId,
    editValue,
    setEditValue,
    fetchExercises,
    prefetchExercisesForSplits,
  };
}

function useWorkoutCycles(
  user: User | null,
  activeProgram: Program | null,
  splits: SplitLite[]
) {
  const [activeCycle, setActiveCycle] = useState<CycleRow | null>(null);
  const [completedSplits, setCompletedSplits] = useState<string[]>([]);
  const [cycleDone, setCycleDone] = useState(false);
  const cycleBusyRef = useRef(false);

  const todayDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const ensureActiveCycle = useCallback(async () => {
    if (!user || !activeProgram) return;

    const { data: existing, error: existingError } = await supabase
      .from("program_cycles")
      .select("*")
      .eq("user_id", user.id)
      .eq("program_id", activeProgram.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!existingError && existing) {
      setActiveCycle(existing);
      return;
    }

    const { data: created, error: createError } = await supabase
      .from("program_cycles")
      .insert({
        user_id: user.id,
        program_id: activeProgram.id,
        is_active: true,
        cycle_index: 1,
      })
      .select("*")
      .single();

    if (!createError && created) {
      setActiveCycle(created);
      return;
    }

    const { data: retry } = await supabase
      .from("program_cycles")
      .select("*")
      .eq("user_id", user.id)
      .eq("program_id", activeProgram.id)
      .eq("is_active", true)
      .maybeSingle();

    if (retry) setActiveCycle(retry);
  }, [user, activeProgram]);

  const fetchCompletedForCycle = useCallback(async () => {
    if (!user || !activeProgram || !activeCycle) return;

    const { data, error } = await supabase
      .from("workout_sessions")
      .select("split_id")
      .eq("user_id", user.id)
      .eq("program_id", activeProgram.id)
      .eq("cycle_id", activeCycle.id);

    if (error) return;

    const ids = (data ?? []).map((row: any) => row.split_id as string);
    setCompletedSplits(ids);

    const total = splits.length;
    setCycleDone(total > 0 && ids.length >= total);
  }, [user, activeProgram, activeCycle, splits.length]);

  useFocusEffect(
    useCallback(() => {
      void ensureActiveCycle();
    }, [ensureActiveCycle])
  );

  useEffect(() => {
    if (!activeCycle) return;
    void fetchCompletedForCycle();
  }, [activeCycle, fetchCompletedForCycle]);

  const resetCycle = useCallback(async () => {
    if (!user || !activeProgram || !activeCycle || cycleBusyRef.current) return;

    cycleBusyRef.current = true;

    try {
      const { error: closeError } = await supabase
        .from("program_cycles")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("id", activeCycle.id);

      if (closeError) return;

      const nextIndex = (activeCycle.cycle_index ?? 1) + 1;

      const { data: created, error: createError } = await supabase
        .from("program_cycles")
        .insert({
          user_id: user.id,
          program_id: activeProgram.id,
          is_active: true,
          cycle_index: nextIndex,
        })
        .select("*")
        .single();

      if (createError) {
        const { data: retry } = await supabase
          .from("program_cycles")
          .select("*")
          .eq("user_id", user.id)
          .eq("program_id", activeProgram.id)
          .eq("is_active", true)
          .maybeSingle();
        if (retry) setActiveCycle(retry);
      } else {
        setActiveCycle(created ?? null);
      }

      setCompletedSplits([]);
      setCycleDone(false);
    } finally {
      cycleBusyRef.current = false;
    }
  }, [user, activeProgram, activeCycle]);

  const toggleComplete = useCallback(
    async (splitId: string | null) => {
      if (!user || !activeProgram || !activeCycle || !splitId || cycleBusyRef.current) return;

      cycleBusyRef.current = true;

      try {
        const isCompleted = completedSplits.includes(splitId);

        if (isCompleted) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

          const { error: deleteError } = await supabase
            .from("workout_sessions")
            .delete()
            .eq("user_id", user.id)
            .eq("program_id", activeProgram.id)
            .eq("cycle_id", activeCycle.id)
            .eq("split_id", splitId);

          if (deleteError) {
            Alert.alert("Could not undo", deleteError.message);
            return;
          }

          setCompletedSplits((prev) => prev.filter((id) => id !== splitId));
          setCycleDone(false);
          return;
        }

        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const { error: insertError } = await supabase
          .from("workout_sessions")
          .upsert(
            {
              user_id: user.id,
              program_id: activeProgram.id,
              cycle_id: activeCycle.id,
              split_id: splitId,
              workout_date: todayDate,
              completed_at: new Date().toISOString(),
            } as any,
            { onConflict: "user_id,program_id,cycle_id,split_id" } as any
          );

        if (insertError) {
          Alert.alert("Could not mark complete", insertError.message);
          return;
        }

        const nextCompleted = completedSplits.includes(splitId)
          ? completedSplits
          : [...completedSplits, splitId];

        setCompletedSplits(nextCompleted);

        const total = splits.length;
        if (total > 0 && nextCompleted.length >= total) setCycleDone(true);
      } finally {
        cycleBusyRef.current = false;
      }
    },
    [user, activeProgram, activeCycle, completedSplits, splits.length, todayDate]
  );

  return {
    activeCycle,
    completedSplits,
    ensureActiveCycle,
    fetchCompletedForCycle,
    toggleComplete,
    resetCycle,
    cycleDone,
    setCycleDone,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    tutorialProgramId?: string | string[];
    programId?: string | string[];
  }>();
  const t = useAppTheme();
  const isOnline = useIsOnline();

  useSyncOnReconnect(isOnline);

  const tutorialProgramId = useMemo(
    () =>
      Array.isArray(params.tutorialProgramId)
        ? params.tutorialProgramId[0]
        : params.tutorialProgramId,
    [params.tutorialProgramId]
  );

  const fallbackProgramId = useMemo(
    () => (Array.isArray(params.programId) ? params.programId[0] : params.programId),
    [params.programId]
  );

  const bottomPadding = useCustomTabBarBottomPadding(26);
  const isDark = useMemo(() => isDarkColor(t.background), [t.background]);
  const pageBackground = isDark ? HOME_BACKGROUND.dark : HOME_BACKGROUND.light;
  const bubbleColors = isDark ? HOME_BUBBLES.dark : HOME_BUBBLES.light;
  const splitOverlayOpacity = isDark ? 0.11 : 0.16;

  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const [emptyStateReady, setEmptyStateReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState<string>("idle");

  const fetchProgramRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => { });
  const fetchSplitsRef = useRef<
    (opts?: { preserveSelection?: boolean; silent?: boolean }) => Promise<void>
  >(async () => { });
  const fetchExercisesRef = useRef<(splitId: string | null) => void>(() => { });
  const ensureActiveCycleRef = useRef<() => Promise<void>>(async () => { });
  const fetchCompletedForCycleRef = useRef<() => Promise<void>>(async () => { });
  const refreshHomeBundleRef = useRef<
    (opts?: { forceLoading?: boolean }) => Promise<void>
  >(async () => { });
  const realtimeInstanceRef = useRef(0);
  const homeRefreshSeqRef = useRef(0);
  const emptyStateDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flatListRef = useRef<FlatList<SplitLite>>(null);
  const didSetInitialOffsetRef = useRef(false);
  const lastSyncedOffsetRef = useRef<number | null>(null);
  const bubbleAnim = useRef(new RNAnimated.Value(0)).current;
  const scrollX = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(bubbleAnim, {
          toValue: 1,
          duration: 12000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        RNAnimated.timing(bubbleAnim, {
          toValue: 0,
          duration: 12000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [bubbleAnim]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      setBooting(false);

      if (!nextUser) router.replace("/(auth)/login");
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setBooting(false);
      if (!nextUser) router.replace("/(auth)/login");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (emptyStateDelayRef.current) clearTimeout(emptyStateDelayRef.current);
      if (logRefreshTimerRef.current) clearTimeout(logRefreshTimerRef.current);
    };
  }, []);

  const uid = user?.id ?? "";

  const { activeProgram, programLoading, fetchProgram } = useProgram(user);

  const {
    splits,
    setSplits,
    loopedSplits,
    currentIndex,
    setCurrentIndex,
    listIndex,
    setListIndex,
    loading,
    fetchSplits,
    refetchTimer,
  } = useSplits(user, activeProgram, isOnline);

  const currentSplit = splits[currentIndex] ?? null;
  const resolvedTutorialProgramId =
    tutorialProgramId || fallbackProgramId || activeProgram?.id || undefined;

  const {
    exercisesBySplit,
    setExercisesBySplit,
    latestLogsByExercise,
    setLatestLogsByExercise,
    logHistoryByExercise,
    setLogHistoryByExercise,
    editingId,
    setEditingId,
    editValue,
    setEditValue,
    fetchExercises,
    prefetchExercisesForSplits,
  } = useExercisesAndLatestLogs(user, currentSplit, isOnline, splits, currentIndex);

  const {
    completedSplits,
    ensureActiveCycle,
    fetchCompletedForCycle,
    toggleComplete,
    resetCycle,
    cycleDone,
    setCycleDone,
  } = useWorkoutCycles(user, activeProgram, splits);

  useLatestLogEvents(setLatestLogsByExercise);

  const homeInsights = useHomeInsights({
    user,
    isOnline,
    splits,
    exercisesBySplit,
    latestLogsByExercise,
  });

  const refreshHomeBundle = useCallback(
    async (opts?: { forceLoading?: boolean }) => {
      if (!user || !activeProgram || !isOnline) {
        setCacheHydrated(true);
        return;
      }

      const seq = ++homeRefreshSeqRef.current;
      const hasExistingSplits = splits.length > 0;

      if (opts?.forceLoading && !hasExistingSplits) {
        setCacheHydrated(false);
      }

      try {
        const bundle = await fetchHomeBundle(user, activeProgram);
        if (seq !== homeRefreshSeqRef.current) return;

        setSplits(bundle.splits);
        setExercisesBySplit(bundle.exercisesBySplit);
        setLatestLogsByExercise(bundle.latestLogsByExercise);
        setLogHistoryByExercise(bundle.logHistoryByExercise ?? {});
        setCacheHydrated(true);
      } catch {
        if (seq === homeRefreshSeqRef.current) setCacheHydrated(true);
      }
    },
    [
      user,
      activeProgram,
      isOnline,
      splits.length,
      setSplits,
      setExercisesBySplit,
      setLatestLogsByExercise,
      setLogHistoryByExercise,
    ]
  );

  useEffect(() => {
    refreshHomeBundleRef.current = refreshHomeBundle;
  }, [refreshHomeBundle]);

  useFocusEffect(
    useCallback(() => {
      void refreshHomeBundle();
    }, [refreshHomeBundle])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await Promise.all([
        fetchProgram({ silent: true }),
        fetchSplits({ preserveSelection: true, silent: true }),
        refreshHomeBundle(),
        ensureActiveCycle(),
        fetchCompletedForCycle(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchProgram, fetchSplits, refreshHomeBundle, ensureActiveCycle, fetchCompletedForCycle]);

  useEffect(() => {
    fetchProgramRef.current = fetchProgram;
  }, [fetchProgram]);

  useEffect(() => {
    fetchSplitsRef.current = fetchSplits;
  }, [fetchSplits]);

  useEffect(() => {
    fetchExercisesRef.current = fetchExercises;
  }, [fetchExercises]);

  useEffect(() => {
    ensureActiveCycleRef.current = ensureActiveCycle;
  }, [ensureActiveCycle]);

  useEffect(() => {
    fetchCompletedForCycleRef.current = fetchCompletedForCycle;
  }, [fetchCompletedForCycle]);

  useEffect(() => {
    setEmptyStateReady(false);
    didSetInitialOffsetRef.current = false;
    lastSyncedOffsetRef.current = null;
    setCurrentIndex(0);
    setListIndex(0);
    setEditingId(null);
    setEditValue("");
  }, [activeProgram?.id, setCurrentIndex, setListIndex, setEditingId, setEditValue]);

  useFocusEffect(
    useCallback(() => {
      void ensureActiveCycle();
      void fetchCompletedForCycle();
    }, [ensureActiveCycle, fetchCompletedForCycle])
  );

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

  const homeCacheKey = useMemo(() => {
    if (!uid || !activeProgram?.id) return null;
    return cacheKey(["home", uid, activeProgram.id]);
  }, [uid, activeProgram?.id]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (!homeCacheKey || !activeProgram) {
        setCacheHydrated(true);
        return;
      }

      setCacheHydrated(false);

      const cached = await cacheGetJson<HomeCacheShape>(homeCacheKey);
      if (cancelled) return;

      if (cached?.splits?.length) {
        setSplits(cached.splits);
      }

      if (cached?.exercisesBySplit) {
        setExercisesBySplit(cached.exercisesBySplit);
      }

      if (cached?.latestLogsByExercise) {
        setLatestLogsByExercise(cached.latestLogsByExercise);
      }

      if ((cached as any)?.logHistoryByExercise) {
        setLogHistoryByExercise((cached as any).logHistoryByExercise);
      }

      setCacheHydrated(true);
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [
    homeCacheKey,
    activeProgram,
    setExercisesBySplit,
    setLatestLogsByExercise,
    setLogHistoryByExercise,
    setSplits,
  ]);

  useEffect(() => {
    if (!homeCacheKey || !cacheHydrated) return;
    void refreshHomeBundle({ forceLoading: splits.length === 0 });
  }, [homeCacheKey, cacheHydrated, refreshHomeBundle, splits.length]);

  useEffect(() => {
    if (!homeCacheKey) return;
    if (!cacheHydrated) return;
    if (booting || programLoading || loading) return;
    if (splits.length === 0) return;

    void cacheSetJson(homeCacheKey, {
      splits,
      exercisesBySplit,
      latestLogsByExercise,
      logHistoryByExercise,
    } as any);
  }, [
    homeCacheKey,
    cacheHydrated,
    booting,
    programLoading,
    loading,
    splits,
    exercisesBySplit,
    latestLogsByExercise,
    logHistoryByExercise,
  ]);

  useEffect(() => {
    if (!uid) return;

    const pid = activeProgram?.id ?? null;
    const sid = currentSplit?.id ?? null;
    const instanceId = ++realtimeInstanceRef.current;
    let mounted = true;

    const isCurrentSubscription = () => {
      return mounted && realtimeInstanceRef.current === instanceId;
    };

    const refreshSplitsSoon = () => {
      if (!isCurrentSubscription()) return;

      if (refetchTimer.current) clearTimeout(refetchTimer.current);

      refetchTimer.current = setTimeout(() => {
        if (!isCurrentSubscription()) return;
        void fetchSplitsRef.current({ preserveSelection: true, silent: true });
        void refreshHomeBundleRef.current();
      }, 120);
    };

    const refreshLogsSoon = () => {
      if (!isCurrentSubscription()) return;

      if (logRefreshTimerRef.current) clearTimeout(logRefreshTimerRef.current);

      logRefreshTimerRef.current = setTimeout(() => {
        if (!isCurrentSubscription()) return;
        if (sid) fetchExercisesRef.current(sid);
        void refreshHomeBundleRef.current();
      }, 160);
    };

    /**
     * Use a unique topic per mounted subscription.
     * Reusing a topic that is still subscribed can make Supabase think we are
     * adding postgres_changes callbacks after subscribe(), especially during
     * fast auth navigation, React refreshes, or rapid Home re-renders.
     */
    const channelTopic = [
      "realtime:home",
      uid,
      pid ?? "no-program",
      sid ?? "no-split",
      instanceId,
    ].join(":");

    const channel = supabase.channel(channelTopic);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "programs",
        filter: `user_id=eq.${uid}`,
      },
      () => {
        if (!isCurrentSubscription()) return;
        void fetchProgramRef.current({ silent: true });
      }
    );

    if (pid) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "splits",
          filter: `program_id=eq.${pid}`,
        },
        refreshSplitsSoon
      );
    }

    if (sid) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "exercises",
          filter: `split_id=eq.${sid}`,
        },
        () => {
          if (!isCurrentSubscription()) return;
          fetchExercisesRef.current(sid);
        }
      );
    }

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "logs",
        filter: `user_id=eq.${uid}`,
      },
      refreshLogsSoon
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "program_cycles",
        filter: `user_id=eq.${uid}`,
      },
      () => {
        if (!isCurrentSubscription()) return;
        void ensureActiveCycleRef.current();
        void fetchCompletedForCycleRef.current();
      }
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "workout_sessions",
        filter: `user_id=eq.${uid}`,
      },
      () => {
        if (!isCurrentSubscription()) return;
        void fetchCompletedForCycleRef.current();
      }
    );

    channel.subscribe();

    return () => {
      mounted = false;

      if (refetchTimer.current) {
        clearTimeout(refetchTimer.current);
        refetchTimer.current = null;
      }

      if (logRefreshTimerRef.current) {
        clearTimeout(logRefreshTimerRef.current);
        logRefreshTimerRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [uid, activeProgram?.id, currentSplit?.id, refetchTimer]);

  const handleCarouselLayout = useCallback(() => {
    if (splits.length === 0 || didSetInitialOffsetRef.current) return;

    didSetInitialOffsetRef.current = true;

    const targetIndex = getVirtualSplitBaseIndex(splits.length) + currentIndex;
    const targetOffset = SCREEN_WIDTH * targetIndex;

    requestAnimationFrame(() => {
      scrollX.setValue(targetOffset);
      flatListRef.current?.scrollToOffset({
        offset: targetOffset,
        animated: false,
      });
      lastSyncedOffsetRef.current = targetOffset;
      setListIndex(targetIndex);
    });
  }, [splits.length, currentIndex, setListIndex, scrollX]);

  useEffect(() => {
    if (splits.length === 0) {
      didSetInitialOffsetRef.current = false;
      lastSyncedOffsetRef.current = null;
      return;
    }

    if (!didSetInitialOffsetRef.current) return;

    const targetListIndex = getVirtualSplitBaseIndex(splits.length) + currentIndex;
    const targetOffset = SCREEN_WIDTH * targetListIndex;

    if (lastSyncedOffsetRef.current === targetOffset) return;

    requestAnimationFrame(() => {
      scrollX.setValue(targetOffset);
      flatListRef.current?.scrollToOffset({
        offset: targetOffset,
        animated: false,
      });
      lastSyncedOffsetRef.current = targetOffset;
      setListIndex(targetListIndex);
    });
  }, [splits.length, currentIndex, setListIndex, scrollX]);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (splits.length === 0) return;

      const rawIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);

      if (splits.length <= 1) {
        setListIndex(0);
        setCurrentIndex(0);
        lastSyncedOffsetRef.current = 0;
        scrollX.setValue(0);
        return;
      }

      const realIndex = getRealSplitIndexFromVirtualIndex(rawIndex, splits.length);
      const baseIndex = getVirtualSplitBaseIndex(splits.length);
      const recenteredListIndex = baseIndex + realIndex;
      const shouldRecenter =
        rawIndex < splits.length || rawIndex >= loopedSplits.length - splits.length;

      setCurrentIndex(realIndex);
      setListIndex(shouldRecenter ? recenteredListIndex : rawIndex);

      // Store the middle-cycle equivalent so the currentIndex sync effect does
      // not teleport after normal 1 ↔ last boundary swipes.
      lastSyncedOffsetRef.current = SCREEN_WIDTH * recenteredListIndex;

      if (shouldRecenter) {
        const targetOffset = SCREEN_WIDTH * recenteredListIndex;

        requestAnimationFrame(() => {
          scrollX.setValue(targetOffset);
          flatListRef.current?.scrollToOffset({
            offset: targetOffset,
            animated: false,
          });
        });
      }

      if (splits.length > 0) {
        const wrapIndex = (index: number) =>
          ((index % splits.length) + splits.length) % splits.length;

        prefetchExercisesForSplits([
          splits[wrapIndex(realIndex)]?.id,
          splits[wrapIndex(realIndex - 1)]?.id,
          splits[wrapIndex(realIndex + 1)]?.id,
        ]);
      }

      if (cycleDone && realIndex === 0 && rawIndex > listIndex) {
        void resetCycle();
        setCycleDone(false);
      }
    },
    [
      splits.length,
      loopedSplits.length,
      cycleDone,
      resetCycle,
      setCycleDone,
      setCurrentIndex,
      setListIndex,
      scrollX,
      listIndex,
      prefetchExercisesForSplits,
    ]
  );

  const renderSplitPage: ListRenderItem<SplitLite> = useCallback(
    ({ item, index }) => (
      <SplitPage
        item={item}
        index={index}
        listIndex={listIndex}
        t={t}
        currentIndex={currentIndex}
        splits={splits}
        carouselScrollX={scrollX}
        virtualSplitCount={loopedSplits.length}
        currentSplit={currentSplit}
        activeSplitId={currentSplit?.id ?? null}
        completedSplits={completedSplits}
        toggleComplete={toggleComplete}
        tourActive={tourActive}
        tourStep={tourStep}
        resolvedTutorialProgramId={resolvedTutorialProgramId}
        router={router}
        setTourStep={setTourStep}
        exercises={exercisesBySplit[item.id] ?? []}
        latestLogsByExercise={latestLogsByExercise}
        logHistoryByExercise={logHistoryByExercise}
        uid={uid}
        editingId={editingId}
        setEditingId={setEditingId}
        editValue={editValue}
        setEditValue={setEditValue}
        setExercisesBySplit={setExercisesBySplit}
      />
    ),
    [
      listIndex,
      t,
      currentIndex,
      splits,
      loopedSplits.length,
      scrollX,
      currentSplit,
      completedSplits,
      toggleComplete,
      tourActive,
      tourStep,
      resolvedTutorialProgramId,
      router,
      setTourStep,
      exercisesBySplit,
      latestLogsByExercise,
      logHistoryByExercise,
      uid,
      editingId,
      setEditingId,
      editValue,
      setEditValue,
      setExercisesBySplit,
    ]
  );

  const loopedSplitKeyExtractor = useCallback(
    (item: SplitLite, index: number) => `${item.id}:${index}`,
    []
  );

  const getRealSplitIndexForLoopIndex = useCallback(
    (index: number) => getRealSplitIndexFromVirtualIndex(index, splits.length),
    [splits.length]
  );

  const carouselRenderBatch = Math.max(5, Math.min(loopedSplits.length, 7));
  const carouselWindowSize = Math.max(7, Math.min(loopedSplits.length, 9));

  const hasUsableData = splits.length > 0;
  const dataChecksSettled = !booting && !programLoading && !loading && cacheHydrated;

  useEffect(() => {
    if (hasUsableData) {
      setEmptyStateReady(false);
      if (emptyStateDelayRef.current) {
        clearTimeout(emptyStateDelayRef.current);
        emptyStateDelayRef.current = null;
      }
      return;
    }

    if (!dataChecksSettled) {
      setEmptyStateReady(false);
      if (emptyStateDelayRef.current) {
        clearTimeout(emptyStateDelayRef.current);
        emptyStateDelayRef.current = null;
      }
      return;
    }

    if (emptyStateDelayRef.current) return;

    emptyStateDelayRef.current = setTimeout(() => {
      emptyStateDelayRef.current = null;
      setEmptyStateReady(true);
    }, HOME_EMPTY_STATE_DELAY_MS);
  }, [hasUsableData, dataChecksSettled, activeProgram?.id]);

  const screenBusy = !hasUsableData && (!dataChecksSettled || !emptyStateReady);
  const carouselKey = `${activeProgram?.id ?? "no-program"}:${splits.length}`;

  const initialCarouselIndex = getVirtualSplitBaseIndex(splits.length) + currentIndex;

  const bubbleOneTranslateX = bubbleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 18],
  });
  const bubbleOneTranslateY = bubbleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 22],
  });
  const bubbleTwoTranslateX = bubbleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, -18],
  });
  const bubbleTwoTranslateY = bubbleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, -20],
  });
  const bubbleThreeScale = bubbleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  if (screenBusy) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: pageBackground }]}
        edges={["top"]}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject} />
      </SafeAreaView>
    );
  }

  if (!activeProgram || splits.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: pageBackground }]}
        edges={["top"]}
      >
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: t.mutedText }]}>No splits found. Create a program and add splits from the Train tab.</Text>

          <TouchableOpacity
            onPress={() => router.push("/train")}
            activeOpacity={0.85}
            style={styles.emptyCta}
          >
            <Text style={styles.emptyCtaText}>Go to Train</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: pageBackground }]} edges={["top"]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <RNAnimated.View
          style={[
            backgroundStyles.bubbleLarge,
            {
              backgroundColor: bubbleColors.primary,
              transform: [
                { translateX: bubbleOneTranslateX },
                { translateY: bubbleOneTranslateY },
              ],
            },
          ]}
        />
        <RNAnimated.View
          style={[
            backgroundStyles.bubbleMid,
            {
              backgroundColor: bubbleColors.secondary,
              transform: [
                { translateX: bubbleTwoTranslateX },
                { translateY: bubbleTwoTranslateY },
              ],
            },
          ]}
        />
        <RNAnimated.View
          style={[
            backgroundStyles.bubbleSmall,
            {
              backgroundColor: bubbleColors.third,
              transform: [{ scale: bubbleThreeScale }],
            },
          ]}
        />
      </View>

      {loopedSplits.map((_, index) => {
        const realSplitIndex = getRealSplitIndexForLoopIndex(index);
        const bgColor = SPLIT_BG_COLORS[realSplitIndex % SPLIT_BG_COLORS.length];
        const inputRange = [
          (index - 1) * SCREEN_WIDTH,
          index * SCREEN_WIDTH,
          (index + 1) * SCREEN_WIDTH,
        ];
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0, splitOverlayOpacity, 0],
          extrapolate: "clamp",
        });

        return (
          <RNAnimated.View
            key={`split-bg-${index}`}
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: bgColor,
                opacity,
              },
            ]}
          />
        );
      })}

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.homeScrollContent,
          { paddingBottom: bottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={t.text}
          />
        }
      >
        <View style={styles.carouselStage} onLayout={handleCarouselLayout}>
          {tourActive && tourStep === "go_home" ? (
            <View style={styles.tourBannerWrap}>
              <OnboardingBanner
                t={t}
                title="Add your first exercise"
                body="Open your current split and create your first exercise. After that, you’ll go to the log page."
                primaryLabel="Create exercise"
                onPrimary={async () => {
                  const split = currentSplit;
                  if (!split) return;

                  await setOnboardingStep("create_exercise");
                  setTourStep("create_exercise");

                  router.push({
                    pathname: "/exercise/new",
                    params: {
                      splitId: split.id,
                      splitName: split.name,
                      tutorialProgramId: resolvedTutorialProgramId,
                      programId: resolvedTutorialProgramId,
                      tourStep: "create_exercise",
                    },
                  });
                }}
              />
            </View>
          ) : null}

          <RNAnimated.FlatList
            key={carouselKey}
            ref={flatListRef}
            data={loopedSplits}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={loopedSplitKeyExtractor}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            initialScrollIndex={initialCarouselIndex}
            decelerationRate="fast"
            removeClippedSubviews={false}
            windowSize={carouselWindowSize}
            onScroll={RNAnimated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onLayout={handleCarouselLayout}
            initialNumToRender={carouselRenderBatch}
            maxToRenderPerBatch={5}
            updateCellsBatchingPeriod={8}
            renderItem={renderSplitPage}
          />
        </View>

        <HomeBottomSections t={t} {...homeInsights} />
      </ScrollView>
    </SafeAreaView>
  );
}

const backgroundStyles = StyleSheet.create({
  bubbleLarge: {
    position: "absolute",
    top: -88,
    left: -72,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  bubbleMid: {
    position: "absolute",
    top: 180,
    right: -96,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  bubbleSmall: {
    position: "absolute",
    bottom: 90,
    left: 24,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
});
