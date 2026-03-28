// app/(tabs)/index.tsx
"use client";

import {
  memo,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Animated as RNAnimated,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ListRenderItem,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/src/lib/supabase";
import { format } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "@/src/theme/theme";
import { useIsOnline } from "@/hooks/use-is-online";
import { useSyncOnReconnect } from "@/src/hooks/use-sync-on-reconnect";
import { cacheGetJson, cacheKey, cacheSetJson } from "@/src/lib/offline-cache";
import type { Database } from "@/src/types/supabase";
import type { User } from "@supabase/supabase-js";
import OnboardingBanner from "@/src/components/OnboardingBanner";
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

type Program = Database["public"]["Tables"]["programs"]["Row"];
type SplitRow = Database["public"]["Tables"]["splits"]["Row"];
type ExerciseRowDb = Database["public"]["Tables"]["exercises"]["Row"];
type CycleRow = Database["public"]["Tables"]["program_cycles"]["Row"];
type LogRow = Database["public"]["Tables"]["logs"]["Row"];

type SplitLite = Pick<SplitRow, "id" | "name" | "focus" | "order_index">;
type ExerciseLite = Pick<ExerciseRowDb, "id" | "name" | "slug">;
type LatestLogLite = Pick<
  LogRow,
  "id" | "exercise_id" | "weight" | "reps" | "sets" | "created_at" | "type" | "day"
>;

type HomeCacheShape = {
  splits: SplitLite[];
  exercisesBySplit: Record<string, ExerciseLite[]>;
  latestLogsByExercise: Record<string, LatestLogLite | null>;
};

type AppTheme = ReturnType<typeof useAppTheme>;

type ExerciseRowProps = {
  item: ExerciseLite;
  index: number;
  stackSize: number;
  latestLog: LatestLogLite | null;
  currentSplit: SplitLite | null;
  uid: string;
  t: AppTheme;
  router: ReturnType<typeof useRouter>;
  editingId: string | null;
  setEditingId: Dispatch<SetStateAction<string | null>>;
  editValue: string;
  setEditValue: Dispatch<SetStateAction<string>>;
  setExercisesBySplit: Dispatch<SetStateAction<Record<string, ExerciseLite[]>>>;
};

type SplitPageProps = {
  item: SplitLite;
  index: number;
  listIndex: number;
  t: AppTheme;
  currentIndex: number;
  splits: SplitLite[];
  currentSplit: SplitLite | null;
  activeSplitId: string | null;
  completedSplits: string[];
  toggleComplete: (splitId: string | null) => Promise<void>;
  tourActive: boolean;
  tourStep: string;
  resolvedTutorialProgramId?: string;
  router: ReturnType<typeof useRouter>;
  setTourStep: Dispatch<SetStateAction<string>>;
  exercises: ExerciseLite[];
  latestLogsByExercise: Record<string, LatestLogLite | null>;
  uid: string;
  editingId: string | null;
  setEditingId: Dispatch<SetStateAction<string | null>>;
  editValue: string;
  setEditValue: Dispatch<SetStateAction<string>>;
  setExercisesBySplit: Dispatch<SetStateAction<Record<string, ExerciseLite[]>>>;
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const EXERCISE_LIST_CONTENT_STYLE = { padding: 16 };

function formatWeight(weight: number | string | null | undefined) {
  const num = Number(weight ?? 0);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (Number.isInteger(num)) return `${num} kg`;
  return `${num.toFixed(1)} kg`;
}

function formatLatestLog(log: LatestLogLite | null | undefined) {
  if (!log) return "No logs yet";

  const weightText = formatWeight(log.weight as number | string | null | undefined);
  const repsText = `${log.reps} ${log.reps === 1 ? "rep" : "reps"}`;
  const setsText = `${log.sets} ${log.sets === 1 ? "set" : "sets"}`;

  if (weightText) return `Last: ${weightText} · ${repsText} · ${setsText}`;
  return `Last: ${repsText} · ${setsText}`;
}

function useProgram(user: User | null) {
  const [activeProgram, setActiveProgram] = useState<Program | null>(() => getActiveProgramSnapshot());
  const [programLoading, setProgramLoading] = useState(true);

  const normalizeProgram = useCallback((program: Program | null | undefined): Program | null => {
    if (!program) return null;
    return {
      ...program,
      created_at: program.created_at ?? null,
      is_active: program.is_active ?? false,
    } as Program;
  }, []);

  const lastPublishedProgramRef = useRef<Program | null>(getActiveProgramSnapshot());

  const sameProgram = useCallback((a: Program | null | undefined, b: Program | null | undefined) => {
    const left = normalizeProgram(a);
    const right = normalizeProgram(b);

    return (
      left?.id === right?.id &&
      left?.is_active === right?.is_active &&
      left?.name === right?.name &&
      left?.created_at === right?.created_at
    );
  }, [normalizeProgram]);

  const applyProgram = useCallback(
    (program: Program | null | undefined, options?: { publish?: boolean }) => {
      const nextProgram = normalizeProgram(program);

      setActiveProgram((prev) => {
        const prevNormalized = normalizeProgram(prev);
        if (sameProgram(prevNormalized, nextProgram)) return prevNormalized;
        return nextProgram;
      });

      if (options?.publish !== false && !sameProgram(lastPublishedProgramRef.current, nextProgram)) {
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
      const preferredProgramId = opts?.preferredProgramId ?? getActiveProgramSnapshot()?.id ?? null;

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
          applyProgram({ ...(preferredData as Program), is_active: true } as Program);
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
    void fetchProgram({ silent: false, preferredProgramId: snapshot?.id ?? null });
  }, [fetchProgram, applyProgram]);

  useFocusEffect(
    useCallback(() => {
      const snapshot = getActiveProgramSnapshot();
      if (snapshot) {
        applyProgram(snapshot, { publish: false });
      }
      void fetchProgram({ silent: true, preferredProgramId: snapshot?.id ?? null });
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

function useSplits(user: User | null, activeProgram: Program | null, isOnline: boolean) {
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

      const nextSplits: SplitLite[] = (data ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        focus: s.focus ?? null,
        order_index: s.order_index,
      }));

      let nextCurrentIndex = 0;

      if (prevId) {
        const found = nextSplits.findIndex((s) => s.id === prevId);
        if (found >= 0) nextCurrentIndex = found;
      }

      setSplits(nextSplits);
      setCurrentIndex(nextCurrentIndex);
      setListIndex(nextSplits.length <= 1 ? nextCurrentIndex : nextCurrentIndex + 1);

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
    return [splits[splits.length - 1], ...splits, splits[0]];
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
  isOnline: boolean
) {
  const [exercisesBySplit, setExercisesBySplit] = useState<Record<string, ExerciseLite[]>>({});
  const [latestLogsByExercise, setLatestLogsByExercise] = useState<Record<string, LatestLogLite | null>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchSeq = useRef(0);
  const logsFetchSeq = useRef(0);

  const fetchLatestLogsForExercises = useCallback(
    async (exerciseIds: string[]) => {
      if (!user || !isOnline || exerciseIds.length === 0) return;

      const seq = ++logsFetchSeq.current;

      const { data, error } = await supabase
        .from("logs")
        .select("id, exercise_id, weight, reps, sets, created_at, type, day")
        .eq("user_id", user.id)
        .in("exercise_id", exerciseIds)
        .order("created_at", { ascending: false });

      if (seq !== logsFetchSeq.current || error) return;

      const nextMap: Record<string, LatestLogLite | null> = {};
      for (const id of exerciseIds) nextMap[id] = null;

      for (const row of (data ?? []) as LatestLogLite[]) {
        if (!nextMap[row.exercise_id]) nextMap[row.exercise_id] = row;
      }

      setLatestLogsByExercise((prev) => ({ ...prev, ...nextMap }));
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

        const next: ExerciseLite[] = (data ?? []).map((e: any) => ({
          id: e.id,
          name: e.name,
          slug: e.slug ?? null,
        }));

        setExercisesBySplit((prev) => ({ ...prev, [splitId]: next }));

        const exerciseIds = next.map((e) => e.id);
        if (exerciseIds.length > 0) {
          await fetchLatestLogsForExercises(exerciseIds);
        }
      };

      void doFetch();
    },
    [user, isOnline, fetchLatestLogsForExercises]
  );

  useEffect(() => {
    if (currentSplit?.id && !exercisesBySplit[currentSplit.id]) {
      fetchExercises(currentSplit.id);
    } else if (currentSplit?.id) {
      const existing = exercisesBySplit[currentSplit.id] ?? [];
      const missingLatest = existing.map((e) => e.id).filter((id) => !(id in latestLogsByExercise));
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

  return {
    exercisesBySplit,
    setExercisesBySplit,
    latestLogsByExercise,
    setLatestLogsByExercise,
    editingId,
    setEditingId,
    editValue,
    setEditValue,
    fetchExercises,
  };
}

function useWorkoutCycles(user: User | null, activeProgram: Program | null, splits: SplitLite[]) {
  const [activeCycle, setActiveCycle] = useState<CycleRow | null>(null);
  const [completedSplits, setCompletedSplits] = useState<string[]>([]);
  const [cycleDone, setCycleDone] = useState(false);
  const cycleBusyRef = useRef(false);

  const todayDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const ensureActiveCycle = useCallback(async () => {
    if (!user || !activeProgram) return;

    const { data: existing, error: exErr } = await supabase
      .from("program_cycles")
      .select("*")
      .eq("user_id", user.id)
      .eq("program_id", activeProgram.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!exErr && existing) {
      setActiveCycle(existing);
      return;
    }

    const { data: created, error: crErr } = await supabase
      .from("program_cycles")
      .insert({
        user_id: user.id,
        program_id: activeProgram.id,
        is_active: true,
        cycle_index: 1,
      })
      .select("*")
      .single();

    if (!crErr && created) {
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

    const ids = (data ?? []).map((d: any) => d.split_id as string);
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
      const { error: closeErr } = await supabase
        .from("program_cycles")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("id", activeCycle.id);

      if (closeErr) return;

      const nextIndex = (activeCycle.cycle_index ?? 1) + 1;

      const { data: created, error: crErr } = await supabase
        .from("program_cycles")
        .insert({
          user_id: user.id,
          program_id: activeProgram.id,
          is_active: true,
          cycle_index: nextIndex,
        })
        .select("*")
        .single();

      if (crErr) {
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

          const { error: delErr } = await supabase
            .from("workout_sessions")
            .delete()
            .eq("user_id", user.id)
            .eq("program_id", activeProgram.id)
            .eq("cycle_id", activeCycle.id)
            .eq("split_id", splitId);

          if (delErr) {
            Alert.alert("Could not undo", delErr.message);
            return;
          }

          setCompletedSplits((prev) => prev.filter((id) => id !== splitId));
          setCycleDone(false);
          return;
        }

        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const { error: insErr } = await supabase
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

        if (insErr) {
          Alert.alert("Could not mark complete", insErr.message);
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

const ExerciseRow = memo(function ExerciseRow({
  item,
  index,
  stackSize,
  latestLog,
  currentSplit,
  uid,
  t,
  router,
  editingId,
  setEditingId,
  editValue,
  setEditValue,
  setExercisesBySplit,
}: ExerciseRowProps) {
  const isEditing = editingId === item.id;

  const handleRename = useCallback(async () => {
    if (!editValue.trim() || !currentSplit?.id || !uid) return;

    const trimmed = editValue.trim();

    const { error } = await supabase
      .from("exercises")
      .update({ name: trimmed })
      .eq("id", item.id)
      .eq("user_id", uid);

    if (error) {
      Alert.alert("Rename failed", error.message);
      return;
    }

    setExercisesBySplit((prev) => {
      const existing = prev[currentSplit.id] ?? [];
      const next = existing.map((e) => (e.id === item.id ? { ...e, name: trimmed } : e));
      return { ...prev, [currentSplit.id]: next };
    });

    setEditingId(null);
    setEditValue("");
  }, [editValue, currentSplit, uid, item.id, setExercisesBySplit, setEditingId, setEditValue]);

  const handleDelete = useCallback(() => {
    Alert.alert("Delete Exercise?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!currentSplit?.id || !uid) return;

          const { error } = await supabase
            .from("exercises")
            .delete()
            .eq("id", item.id)
            .eq("user_id", uid);

          if (error) {
            Alert.alert("Delete failed", error.message);
            return;
          }

          setExercisesBySplit((prev) => {
            const existing = prev[currentSplit.id] ?? [];
            return {
              ...prev,
              [currentSplit.id]: existing.filter((e) => e.id !== item.id),
            };
          });
        },
      },
    ]);
  }, [currentSplit, uid, item.id, setExercisesBySplit]);

  const handleEditStart = useCallback(() => {
    setEditingId(item.id);
    setEditValue(item.name);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [item.id, item.name, setEditingId, setEditValue]);

  const handleOpenExercise = useCallback(() => {
    if (!item.slug) return;
    router.push(`/exercise/${item.slug}`);
  }, [item.slug, router]);

  return (
    <RNAnimated.View
      style={[
        styles.exerciseCard,
        {
          transform: [{ translateY: index * 4 }],
          zIndex: stackSize - index,
          backgroundColor: t.cardAlt,
          borderColor: t.border,
        },
      ]}
    >
      <View style={styles.exerciseRow}>
        {isEditing ? (
          <TextInput
            value={editValue}
            onChangeText={setEditValue}
            onSubmitEditing={handleRename}
            style={[styles.exerciseInput, { color: t.text, borderColor: t.inputBorder }]}
            autoFocus
            returnKeyType="done"
          />
        ) : (
          <TouchableOpacity
            style={styles.exercisePressArea}
            onPress={handleOpenExercise}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.exerciseText, { color: t.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.name}
            </Text>
            <Text
              style={[styles.latestLogText, { color: t.mutedText }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {formatLatestLog(latestLog)}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.iconRow}>
          <TouchableOpacity style={styles.iconButton} onPress={handleEditStart} hitSlop={10}>
            <Ionicons name="create-outline" size={22} color={t.mutedText} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={handleDelete} hitSlop={10}>
            <Ionicons name="trash-outline" size={22} color={t.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </RNAnimated.View>
  );
});

function ExerciseList({
  exercises,
  latestLogsByExercise,
  currentSplit,
  uid,
  t,
  router,
  editingId,
  setEditingId,
  editValue,
  setEditValue,
  setExercisesBySplit,
}: {
  exercises: ExerciseLite[];
  latestLogsByExercise: Record<string, LatestLogLite | null>;
  currentSplit: SplitLite | null;
  uid: string;
  t: AppTheme;
  router: ReturnType<typeof useRouter>;
  editingId: string | null;
  setEditingId: Dispatch<SetStateAction<string | null>>;
  editValue: string;
  setEditValue: Dispatch<SetStateAction<string>>;
  setExercisesBySplit: Dispatch<SetStateAction<Record<string, ExerciseLite[]>>>;
}) {
  const renderItem: ListRenderItem<ExerciseLite> = useCallback(
    ({ item, index }) => (
      <ExerciseRow
        item={item}
        index={index}
        stackSize={exercises.length}
        latestLog={latestLogsByExercise[item.id] ?? null}
        currentSplit={currentSplit}
        uid={uid}
        t={t}
        router={router}
        editingId={editingId}
        setEditingId={setEditingId}
        editValue={editValue}
        setEditValue={setEditValue}
        setExercisesBySplit={setExercisesBySplit}
      />
    ),
    [
      exercises.length,
      latestLogsByExercise,
      currentSplit,
      uid,
      t,
      router,
      editingId,
      setEditingId,
      editValue,
      setEditValue,
      setExercisesBySplit,
    ]
  );

  const keyExtractor = useCallback((item: ExerciseLite) => item.id, []);

  if (exercises.length === 0) {
    return (
      <View style={styles.exerciseEmpty}>
        <Text style={[styles.exerciseEmptyText, { color: t.mutedText }]}>No exercises yet. Tap “Add Exercise”.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={exercises}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={EXERCISE_LIST_CONTENT_STYLE}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={false}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const SplitPage = memo(function SplitPage({
  item,
  index,
  listIndex,
  t,
  currentIndex,
  splits,
  currentSplit,
  activeSplitId,
  completedSplits,
  toggleComplete,
  tourActive,
  tourStep,
  resolvedTutorialProgramId,
  router,
  setTourStep,
  exercises,
  latestLogsByExercise,
  uid,
  editingId,
  setEditingId,
  editValue,
  setEditValue,
  setExercisesBySplit,
}: SplitPageProps) {
  const isActivePage = index === listIndex;
  const isCurrentVisibleSplit = item.id === activeSplitId;
  const isCompleted = completedSplits.includes(item.id);

  const handleAddExercise = useCallback(async () => {
    if (!isCurrentVisibleSplit) return;

    if (tourActive && tourStep === "go_home") {
      await setOnboardingStep("create_exercise");
      setTourStep("create_exercise");
    }

    router.push({
      pathname: "/exercise/new",
      params: {
        splitId: item.id,
        splitName: item.name,
        tutorialProgramId: resolvedTutorialProgramId,
        programId: resolvedTutorialProgramId,
        tourStep: tourActive && tourStep === "go_home" ? "create_exercise" : undefined,
      },
    });
  }, [
    isCurrentVisibleSplit,
    tourActive,
    tourStep,
    setTourStep,
    router,
    item.id,
    item.name,
    resolvedTutorialProgramId,
  ]);

  const handleToggleComplete = useCallback(() => {
    void toggleComplete(item.id);
  }, [toggleComplete, item.id]);

  return (
    <View style={styles.pageContainer}>
      <RNAnimated.View style={[styles.topCard, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.splitTitle, { color: t.text }]} numberOfLines={1}>
          {item.name}
        </Text>

        {item.focus ? <Text style={[styles.focus, { color: t.mutedText }]}>{item.focus}</Text> : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: t.primaryBg },
              !isCurrentVisibleSplit && styles.disabledButton,
            ]}
            onPress={handleAddExercise}
            disabled={!isCurrentVisibleSplit}
          >
            <Text style={[styles.primaryText, { color: t.primaryText }]}>Add Exercise</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { backgroundColor: t.secondaryBg },
              isCompleted && { backgroundColor: t.success },
            ]}
            onPress={handleToggleComplete}
            disabled={item.id !== activeSplitId}
          >
            <Text style={[styles.secondaryText, { color: t.secondaryText }]}>
              {isCompleted ? "Completed ✓" : "Mark Complete"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dotsRow}>
          {splits.map((split, dotIndex) => {
            const isActiveDot = dotIndex === currentIndex;
            const isCompletedDot = completedSplits.includes(split.id);

            return (
              <View
                key={split.id}
                style={[
                  styles.dot,
                  {
                    backgroundColor: isCompletedDot
                      ? t.success
                      : isActiveDot
                        ? t.text
                        : t.border,
                    transform: [{ scale: isActiveDot ? 1.15 : 1 }],
                    opacity: isActiveDot || isCompletedDot ? 1 : 0.9,
                  },
                ]}
              />
            );
          })}
        </View>
      </RNAnimated.View>

      {isActivePage ? (
        <RNAnimated.View
          style={[
            styles.exerciseCardWrapper,
            { backgroundColor: t.card, borderColor: t.border },
          ]}
        >
          <ExerciseList
            exercises={exercises}
            latestLogsByExercise={latestLogsByExercise}
            currentSplit={currentSplit}
            uid={uid}
            t={t}
            router={router}
            editingId={editingId}
            setEditingId={setEditingId}
            editValue={editValue}
            setEditValue={setEditValue}
            setExercisesBySplit={setExercisesBySplit}
          />
        </RNAnimated.View>
      ) : null}
    </View>
  );
});

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
    () => (Array.isArray(params.tutorialProgramId) ? params.tutorialProgramId[0] : params.tutorialProgramId),
    [params.tutorialProgramId]
  );
  const fallbackProgramId = useMemo(
    () => (Array.isArray(params.programId) ? params.programId[0] : params.programId),
    [params.programId]
  );

  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [cacheHydrated, setCacheHydrated] = useState(false);

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState<string>("idle");

  const fetchProgramRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => { });
  const fetchSplitsRef = useRef<
    (opts?: { preserveSelection?: boolean; silent?: boolean }) => Promise<void>
  >(async () => { });
  const fetchExercisesRef = useRef<(splitId: string | null) => void>(() => { });
  const ensureActiveCycleRef = useRef<() => Promise<void>>(async () => { });
  const fetchCompletedForCycleRef = useRef<() => Promise<void>>(async () => { });
  const rtKeyRef = useRef<string>("");

  const flatListRef = useRef<FlatList<SplitLite>>(null);
  const parallaxAnim = useRef(new RNAnimated.Value(0)).current;
  const didSetInitialOffsetRef = useRef(false);
  const lastSyncedOffsetRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      setBooting(false);

      if (!nextUser) router.replace("/login");
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setBooting(false);
      if (!nextUser) router.replace("/login");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

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
  const resolvedTutorialProgramId = tutorialProgramId || fallbackProgramId || activeProgram?.id || undefined;

  const {
    exercisesBySplit,
    setExercisesBySplit,
    latestLogsByExercise,
    setLatestLogsByExercise,
    editingId,
    setEditingId,
    editValue,
    setEditValue,
    fetchExercises,
  } = useExercisesAndLatestLogs(user, currentSplit, isOnline);

  const {
    completedSplits,
    ensureActiveCycle,
    fetchCompletedForCycle,
    toggleComplete,
    resetCycle,
    cycleDone,
    setCycleDone,
  } = useWorkoutCycles(user, activeProgram, splits);

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
    didSetInitialOffsetRef.current = false;
    lastSyncedOffsetRef.current = null;
    parallaxAnim.setValue(0);
    setCurrentIndex(0);
    setListIndex(0);
    setEditingId(null);
    setEditValue("");
  }, [
    activeProgram?.id,
    parallaxAnim,
    setCurrentIndex,
    setListIndex,
    setEditingId,
    setEditValue,
  ]);

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

      setCacheHydrated(true);
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [homeCacheKey, activeProgram, setExercisesBySplit, setLatestLogsByExercise, setSplits]);

  useEffect(() => {
    if (!homeCacheKey) return;

    void cacheSetJson(homeCacheKey, {
      splits,
      exercisesBySplit,
      latestLogsByExercise,
    });
  }, [homeCacheKey, splits, exercisesBySplit, latestLogsByExercise]);

  useEffect(() => {
    if (!uid) return;

    const pid = activeProgram?.id ?? null;
    const sid = currentSplit?.id ?? null;
    const key = `${uid}:${pid ?? "none"}:${sid ?? "none"}`;

    if (rtKeyRef.current === key) return;
    rtKeyRef.current = key;

    const programsCh = supabase
      .channel(`programs:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "programs", filter: `user_id=eq.${uid}` },
        () => {
          void fetchProgramRef.current({ silent: true });
        }
      )
      .subscribe();

    const splitsCh =
      pid == null
        ? null
        : supabase
          .channel(`splits:${pid}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "splits", filter: `program_id=eq.${pid}` },
            () => {
              if (refetchTimer.current) clearTimeout(refetchTimer.current);
              refetchTimer.current = setTimeout(() => {
                void fetchSplitsRef.current({ preserveSelection: true, silent: true });
              }, 100);
            }
          )
          .subscribe();

    const exercisesCh =
      sid == null
        ? null
        : supabase
          .channel(`exercises:${sid}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "exercises", filter: `split_id=eq.${sid}` },
            () => {
              fetchExercisesRef.current(sid);
            }
          )
          .subscribe();

    const logsCh = supabase
      .channel(`logs:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "logs", filter: `user_id=eq.${uid}` },
        () => {
          if (currentSplit?.id) {
            fetchExercisesRef.current(currentSplit.id);
          }
        }
      )
      .subscribe();

    const cyclesCh = supabase
      .channel(`cycles:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "program_cycles", filter: `user_id=eq.${uid}` },
        () => {
          void ensureActiveCycleRef.current();
          void fetchCompletedForCycleRef.current();
        }
      )
      .subscribe();

    const sessionsCh = supabase
      .channel(`sessions:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_sessions", filter: `user_id=eq.${uid}` },
        () => {
          void fetchCompletedForCycleRef.current();
        }
      )
      .subscribe();

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);

      void supabase.removeChannel(programsCh);
      if (splitsCh) void supabase.removeChannel(splitsCh);
      if (exercisesCh) void supabase.removeChannel(exercisesCh);
      void supabase.removeChannel(logsCh);
      void supabase.removeChannel(cyclesCh);
      void supabase.removeChannel(sessionsCh);
    };
  }, [uid, activeProgram?.id, currentSplit?.id, refetchTimer]);

  const handleCarouselLayout = useCallback(() => {
    if (splits.length === 0 || didSetInitialOffsetRef.current) return;

    didSetInitialOffsetRef.current = true;

    const targetIndex = splits.length > 1 ? currentIndex + 1 : currentIndex;
    const targetOffset = SCREEN_WIDTH * targetIndex;

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: targetOffset,
        animated: false,
      });
      lastSyncedOffsetRef.current = targetOffset;
      setListIndex(targetIndex);
    });
  }, [splits.length, currentIndex, setListIndex]);

  useEffect(() => {
    if (splits.length === 0) {
      didSetInitialOffsetRef.current = false;
      lastSyncedOffsetRef.current = null;
      return;
    }

    if (!didSetInitialOffsetRef.current) return;

    const targetListIndex = splits.length > 1 ? currentIndex + 1 : currentIndex;
    const targetOffset = SCREEN_WIDTH * targetListIndex;

    if (lastSyncedOffsetRef.current === targetOffset) return;

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: targetOffset,
        animated: false,
      });
      lastSyncedOffsetRef.current = targetOffset;
      setListIndex(targetListIndex);
    });
  }, [splits.length, currentIndex, setListIndex]);

  const onScroll = useMemo(
    () =>
      RNAnimated.event([{ nativeEvent: { contentOffset: { x: parallaxAnim } } }], {
        useNativeDriver: true,
      }),
    [parallaxAnim]
  );

  const onMomentumScrollEnd = useCallback(
    (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (splits.length === 0) return;

      const rawIndex = Math.round(ev.nativeEvent.contentOffset.x / SCREEN_WIDTH);

      if (splits.length <= 1) {
        setListIndex(0);
        setCurrentIndex(0);
        lastSyncedOffsetRef.current = 0;
        return;
      }

      const loopLastIndex = splits.length + 1;

      if (rawIndex <= 0) {
        const targetListIndex = splits.length;
        const targetOffset = SCREEN_WIDTH * targetListIndex;

        setListIndex(targetListIndex);
        setCurrentIndex(splits.length - 1);
        lastSyncedOffsetRef.current = targetOffset;

        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: targetOffset, animated: false });
        });
        return;
      }

      if (rawIndex >= loopLastIndex) {
        const targetListIndex = 1;
        const targetOffset = SCREEN_WIDTH * targetListIndex;

        setListIndex(targetListIndex);
        setCurrentIndex(0);
        lastSyncedOffsetRef.current = targetOffset;

        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: targetOffset, animated: false });

          if (cycleDone) {
            void resetCycle();
            setCycleDone(false);
          }
        });
        return;
      }

      setListIndex(rawIndex);
      setCurrentIndex(rawIndex - 1);
      lastSyncedOffsetRef.current = SCREEN_WIDTH * rawIndex;
    },
    [splits.length, cycleDone, resetCycle, setCycleDone, setCurrentIndex, setListIndex]
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

  const hasUsableData = splits.length > 0 || Object.keys(exercisesBySplit).length > 0;
  const screenBusy = !hasUsableData && !cacheHydrated && (booting || programLoading || loading);

  if (screenBusy) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.text} />
      </SafeAreaView>
    );
  }

  if (!activeProgram || splits.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={["top"]}>
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

  const carouselKey = `${activeProgram.id}:${splits.length}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={["top"]}>
      <View style={styles.flexFill} onLayout={handleCarouselLayout}>
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
          removeClippedSubviews={false}
          windowSize={3}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumScrollEnd}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          updateCellsBatchingPeriod={16}
          renderItem={renderSplitPage}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flexFill: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 22,
  },
  emptyCta: { marginTop: 12 },
  emptyCtaText: { color: "#3B82F6", fontSize: 16, fontWeight: "700" },

  tourBannerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  pageContainer: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 16,
  },

  topCard: { padding: 20, borderRadius: 22, marginVertical: 12, borderWidth: 1 },
  splitTitle: { fontSize: 22, fontWeight: "600" },
  focus: { marginTop: 4, fontSize: 13 },

  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  primaryButton: { padding: 12, borderRadius: 14, flex: 1, alignItems: "center" },
  primaryText: { fontWeight: "700" },
  secondaryButton: { padding: 12, borderRadius: 14, flex: 1, alignItems: "center" },
  secondaryText: { fontWeight: "700" },
  disabledButton: { opacity: 0.55 },

  dotsRow: { flexDirection: "row", gap: 6, marginTop: 14 },
  dot: { width: 9, height: 9, borderRadius: 999 },

  exerciseCardWrapper: {
    flex: 1,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 220,
  },
  exerciseEmpty: { flex: 1, padding: 16, alignItems: "center", justifyContent: "center" },
  exerciseEmptyText: { fontSize: 14 },

  exerciseCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    width: "100%",
  },
  exerciseRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 40 },
  exercisePressArea: { flex: 1, justifyContent: "center" },
  exerciseText: { fontSize: 16, fontWeight: "600", letterSpacing: 0.2 },
  latestLogText: { marginTop: 4, fontSize: 12, fontWeight: "500" },

  iconRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  iconButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },

  exerciseInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 2,
    borderBottomWidth: 1,
  },
});

