// app/(tabs)/index.tsx  (Home)
"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Dimensions,
  ScrollView,
  Animated as RNAnimated,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/src/lib/supabase";
import { format } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "@/src/theme/theme";
import { useIsOnline } from "@/hooks/use-is-online";
import { cacheGetJson, cacheKey, cacheSetJson } from "@/src/lib/offline-cache";
import type { Database } from "@/src/types/supabase";
import type { User } from "@supabase/supabase-js";

type Program = Database["public"]["Tables"]["programs"]["Row"];
type SplitRow = Database["public"]["Tables"]["splits"]["Row"];
type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];
type CycleRow = Database["public"]["Tables"]["program_cycles"]["Row"];

type SplitLite = Pick<SplitRow, "id" | "name" | "focus" | "order_index">;
type ExerciseLite = Pick<ExerciseRow, "id" | "name" | "slug">;

const SCREEN_WIDTH = Dimensions.get("window").width;

/* ================= HOOKS ================= */
function useProgram(user: User | null) {
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);

  const fetchProgram = useCallback(async () => {
    if (!user) {
      setActiveProgram(null);
      return;
    }

    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      setActiveProgram(null);
      return;
    }

    setActiveProgram(data ?? null);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchProgram();
    }, [fetchProgram])
  );

  return { activeProgram, fetchProgram };
}

function useSplits(user: User | null, activeProgram: Program | null, isOnline: boolean) {
  const [splits, setSplits] = useState<SplitLite[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listIndex, setListIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const startIndex = useMemo(() => (splits.length > 1 ? 1 : 0), [splits.length]);

  // preserve selection across reorder/rename/refetch
  const currentSplitIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentSplitIdRef.current = splits[currentIndex]?.id ?? null;
  }, [splits, currentIndex]);

  // debounce for realtime events (drag reorder etc.)
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSplits = useCallback(
    async (opts?: { preserveSelection?: boolean }) => {
      if (!user || !activeProgram) {
        setSplits([]);
        setCurrentIndex(0);
        setListIndex(0);
        setLoading(false);
        return;
      }

      if (!isOnline && splits.length) {
        setLoading(false);
        return;
      }

      const preserveSelection = opts?.preserveSelection ?? true;
      const prevId = preserveSelection ? currentSplitIdRef.current : null;

      const { data, error } = await supabase
        .from("splits")
        .select("id, name, focus, order_index")
        .eq("program_id", activeProgram.id)
        .eq("user_id", user.id)
        .order("order_index", { ascending: true });

      if (error) return;

      const nextSplits: SplitLite[] = (data ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        focus: s.focus ?? null,
        order_index: s.order_index,
      }));

      setSplits(nextSplits);

      let nextCurrentIndex = 0;
      if (prevId) {
        const found = nextSplits.findIndex((s) => s.id === prevId);
        if (found >= 0) nextCurrentIndex = found;
      }

      setCurrentIndex(nextCurrentIndex);
      setListIndex(nextSplits.length > 1 ? nextCurrentIndex + 1 : nextCurrentIndex);
      currentSplitIdRef.current = nextSplits[nextCurrentIndex]?.id ?? null;
    },
    [user, activeProgram, isOnline, splits.length]
  );

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user || !activeProgram) {
        setSplits([]);
        setCurrentIndex(0);
        setListIndex(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      await fetchSplits({ preserveSelection: false });
      if (!mounted) return;
      setLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeProgram?.id, isOnline]);

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
    startIndex,
    fetchSplits,
    refetchTimer,
  };
}

function useExercises(user: User | null, currentSplit: SplitLite | null, isOnline: boolean) {
  const [exercisesBySplit, setExercisesBySplit] = useState<Record<string, ExerciseLite[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchSeq = useRef(0);

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

        if (seq !== fetchSeq.current) return;
        if (error) return;

        const next: ExerciseLite[] = (data ?? []).map((e: any) => ({
          id: e.id,
          name: e.name,
          slug: e.slug ?? null,
        }));

        setExercisesBySplit((prev) => ({ ...prev, [splitId]: next }));
      };

      doFetch();
    },
    [user, isOnline]
  );

  useEffect(() => {
    if (currentSplit?.id) fetchExercises(currentSplit.id);
    setEditingId(null);
    setEditValue("");
  }, [currentSplit?.id, fetchExercises]);

  return {
    exercisesBySplit,
    setExercisesBySplit,
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
      ensureActiveCycle();
    }, [ensureActiveCycle])
  );

  useEffect(() => {
    if (!activeCycle) return;
    fetchCompletedForCycle();
  }, [activeCycle, fetchCompletedForCycle]);

  const resetCycle = useCallback(async () => {
    if (!user || !activeProgram || !activeCycle) return;
    if (cycleBusyRef.current) return;
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
      if (!user || !activeProgram || !activeCycle || !splitId) return;
      if (cycleBusyRef.current) return;

      cycleBusyRef.current = true;
      try {
        const isCompleted = completedSplits.includes(splitId);

        if (isCompleted) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

        const nextCompleted = completedSplits.includes(splitId) ? completedSplits : [...completedSplits, splitId];
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

/* ================= HOME SCREEN ================= */
export default function HomeScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const isOnline = useIsOnline();

  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  // stable refs used by realtime callbacks (avoid effect teardown loops)
  const fetchProgramRef = useRef<() => Promise<void>>(async () => { });
  const fetchSplitsRef = useRef<(opts?: { preserveSelection?: boolean }) => Promise<void>>(async () => { });
  const fetchExercisesRef = useRef<(splitId: string | null) => void>(() => { });
  const ensureActiveCycleRef = useRef<() => Promise<void>>(async () => { });
  const fetchCompletedForCycleRef = useRef<() => Promise<void>>(async () => { });

  const rtKeyRef = useRef<string>("");

  /* ================= AUTH ================= */
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const u = data.session?.user ?? null;
      setUser(u);
      setBooting(false);

      if (!u) router.replace("/login");
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setBooting(false);
      if (!u) router.replace("/login");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  const uid = user?.id ?? "";

  /* ================= HOOKS ================= */
  const { activeProgram, fetchProgram } = useProgram(user);

  const {
    splits,
    setSplits,
    loopedSplits,
    currentIndex,
    setCurrentIndex,
    listIndex,
    setListIndex,
    loading,
    startIndex,
    fetchSplits,
    refetchTimer,
  } = useSplits(user, activeProgram, isOnline);

  const currentSplit = splits[currentIndex] ?? null;

  const { exercisesBySplit, setExercisesBySplit, editingId, setEditingId, editValue, setEditValue, fetchExercises } =
    useExercises(user, currentSplit, isOnline);

  const { completedSplits, ensureActiveCycle, fetchCompletedForCycle, toggleComplete, resetCycle, cycleDone, setCycleDone } =
    useWorkoutCycles(user, activeProgram, splits);

  // keep refs updated
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

  useFocusEffect(
    useCallback(() => {
      ensureActiveCycle();
      fetchCompletedForCycle();
    }, [ensureActiveCycle, fetchCompletedForCycle])
  );

  /* ================= CACHE LOAD/SAVE ================= */
  useEffect(() => {
    if (!uid || !activeProgram) return;

    (async () => {
      const cached = await cacheGetJson<{
        splits: SplitLite[];
        exercisesBySplit: Record<string, ExerciseLite[]>;
      }>(cacheKey(["home", uid, activeProgram.id]));

      if (!cached) return;

      if (cached.splits?.length) setSplits(cached.splits);
      if (cached.exercisesBySplit) setExercisesBySplit(cached.exercisesBySplit);
    })();
  }, [uid, activeProgram?.id, setExercisesBySplit, setSplits]);

  useEffect(() => {
    if (!uid || !activeProgram) return;

    cacheSetJson(cacheKey(["home", uid, activeProgram.id]), {
      splits,
      exercisesBySplit,
    });
  }, [uid, activeProgram?.id, splits, exercisesBySplit]);

  /* ================= REALTIME (CLEAN + FILTERED) ================= */
  useEffect(() => {
    if (!uid) return;

    const pid = activeProgram?.id ?? null;
    const sid = currentSplit?.id ?? null;

    const key = `${uid}:${pid ?? "none"}:${sid ?? "none"}`;
    if (rtKeyRef.current === key) return; // ✅ don't resubscribe unnecessarily
    rtKeyRef.current = key;

    const programsCh = supabase
      .channel(`programs:${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "programs", filter: `user_id=eq.${uid}` }, () => {
        fetchProgramRef.current();
      })
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
                fetchSplitsRef.current({ preserveSelection: true });
              }, 80);
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

    const cyclesCh = supabase
      .channel(`cycles:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "program_cycles", filter: `user_id=eq.${uid}` },
        () => {
          ensureActiveCycleRef.current();
          fetchCompletedForCycleRef.current();
        }
      )
      .subscribe();

    const sessionsCh = supabase
      .channel(`sessions:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_sessions", filter: `user_id=eq.${uid}` },
        () => {
          fetchCompletedForCycleRef.current();
        }
      )
      .subscribe();

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);

      supabase.removeChannel(programsCh);
      if (splitsCh) supabase.removeChannel(splitsCh);
      if (exercisesCh) supabase.removeChannel(exercisesCh);
      supabase.removeChannel(cyclesCh);
      supabase.removeChannel(sessionsCh);
    };
  }, [uid, activeProgram?.id, currentSplit?.id]);

  /* ================= LOOPED CAROUSEL INIT ================= */
  const flatListRef = useRef<FlatList<SplitLite>>(null);
  const parallaxAnim = useRef(new RNAnimated.Value(0)).current;

  const [listReady, setListReady] = useState(false);
  const didInitRef = useRef(false);

  useEffect(() => {
    didInitRef.current = false;
    setListReady(false);

    const nextStart = splits.length > 1 ? 1 : 0;
    setCurrentIndex(0);
    setListIndex(nextStart);

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: SCREEN_WIDTH * nextStart,
        animated: false,
      });
      setListReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splits.length]);

  useEffect(() => {
    didInitRef.current = false;
    setListReady(false);
  }, [activeProgram?.id, splits.length]);

  const initialX = useMemo(() => SCREEN_WIDTH * startIndex, [startIndex]);

  const handleListLayout = useCallback(() => {
    if (splits.length <= 1) {
      setListReady(true);
      return;
    }
    if (didInitRef.current) return;
    didInitRef.current = true;

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: SCREEN_WIDTH * startIndex,
        animated: false,
      });
      setListIndex(startIndex);
      setCurrentIndex(0);
      setListReady(true);
    });
  }, [splits.length, setCurrentIndex, setListIndex, startIndex]);

  const onScroll = RNAnimated.event([{ nativeEvent: { contentOffset: { x: parallaxAnim } } }], {
    useNativeDriver: true,
  });

  const onMomentumScrollEnd = useCallback(
    (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (splits.length === 0) return;

      const rawIndex = Math.round(ev.nativeEvent.contentOffset.x / SCREEN_WIDTH);

      if (splits.length <= 1) {
        const clamped = Math.max(0, Math.min(rawIndex, splits.length - 1));
        setListIndex(clamped);
        setCurrentIndex(clamped);
        return;
      }

      const loopLen = splits.length + 2;

      if (rawIndex <= 0) {
        const target = splits.length;
        setListIndex(target);
        setCurrentIndex(splits.length - 1);
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: SCREEN_WIDTH * target, animated: false });
        });
        return;
      }

      if (rawIndex >= loopLen - 1) {
        const target = 1;
        setListIndex(target);
        setCurrentIndex(0);

        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: SCREEN_WIDTH * target, animated: false });

          if (cycleDone) {
            resetCycle();
            setCycleDone(false);
          }
        });

        return;
      }

      setListIndex(rawIndex);
      setCurrentIndex(rawIndex - 1);
    },
    [splits.length, setCurrentIndex, setListIndex, cycleDone, resetCycle, setCycleDone]
  );

  /* ================= UI ================= */
  if (booting || loading) {
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
          <Text style={{ color: t.mutedText, fontSize: 16, textAlign: "center", paddingHorizontal: 22 }}>
            No splits found. Create a program and add splits from the Profile tab.
          </Text>

          <TouchableOpacity onPress={() => router.push("/profile")} activeOpacity={0.85} style={{ marginTop: 12 }}>
            <Text style={{ color: "#3B82F6", fontSize: 16, fontWeight: "700" }}>Go to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const carouselKey = `${activeProgram.id}:${splits.length}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={["top"]}>
      <View style={{ flex: 1, opacity: listReady ? 1 : 0 }} onLayout={handleListLayout}>
        <RNAnimated.FlatList
          key={carouselKey}
          ref={flatListRef}
          data={loopedSplits}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `${item.id}:${index}`}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          removeClippedSubviews={false}
          windowSize={3}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumScrollEnd}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          updateCellsBatchingPeriod={16}
          renderItem={({ item, index }) => {
            const isActivePage = index === listIndex;
            const exercises = exercisesBySplit[item.id] ?? [];

            return (
              <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 16 }}>
                {/* TOP CARD */}
                <RNAnimated.View style={[styles.topCard, { backgroundColor: t.card, borderColor: t.border }]}>
                  <Text style={[styles.splitTitle, { color: t.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.focus ? <Text style={[styles.focus, { color: t.mutedText }]}>{item.focus}</Text> : null}

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: t.primaryBg }]}
                      onPress={() => router.push("/exercise/new")}
                    >
                      <Text style={[styles.primaryText, { color: t.primaryText }]}>Add Exercise</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.secondaryButton,
                        { backgroundColor: t.secondaryBg },
                        completedSplits.includes(item.id) && { backgroundColor: t.success },
                      ]}
                      onPress={() => toggleComplete(item.id)}
                      disabled={item.id !== currentSplit?.id}
                    >
                      <Text style={[styles.secondaryText, { color: t.secondaryText }]}>
                        {completedSplits.includes(item.id) ? "Completed ✓" : "Mark Complete"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dotsRow}>
                    {splits.map((s: SplitLite, i: number) => (
                      <View
                        key={s.id}
                        style={[
                          styles.dot,
                          i === currentIndex && { backgroundColor: t.text },
                          completedSplits.includes(s.id) && { backgroundColor: t.success },
                        ]}
                      />
                    ))}
                  </View>
                </RNAnimated.View>

                {/* EXERCISES */}
                {isActivePage && (
                  <RNAnimated.View style={[styles.exerciseCardWrapper, { backgroundColor: t.card, borderColor: t.border }]}>
                    {exercises.length === 0 ? (
                      <View style={styles.exerciseEmpty}>
                        <Text style={[styles.exerciseEmptyText, { color: t.mutedText }]}>No exercises yet. Tap “Add Exercise”.</Text>
                      </View>
                    ) : (
                      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                        {exercises.map((ex: ExerciseLite, i: number) => (
                          <RNAnimated.View
                            key={ex.id}
                            style={[
                              styles.exerciseCard,
                              {
                                transform: [{ translateY: i * 4 }],
                                zIndex: exercises.length - i,
                                backgroundColor: t.cardAlt,
                                borderColor: t.border,
                              },
                            ]}
                          >
                            <View style={styles.exerciseRow}>
                              {editingId === ex.id ? (
                                <TextInput
                                  value={editValue}
                                  onChangeText={setEditValue}
                                  onSubmitEditing={async () => {
                                    if (!editValue.trim() || !currentSplit?.id || !uid) return;

                                    const { error } = await supabase
                                      .from("exercises")
                                      .update({ name: editValue })
                                      .eq("id", ex.id)
                                      .eq("user_id", uid);

                                    if (error) {
                                      Alert.alert("Rename failed", error.message);
                                      return;
                                    }

                                    setExercisesBySplit((prev) => {
                                      const existing = prev[currentSplit.id] ?? [];
                                      const next = existing.map((e) => (e.id === ex.id ? { ...e, name: editValue } : e));
                                      return { ...prev, [currentSplit.id]: next };
                                    });

                                    setEditingId(null);
                                    setEditValue("");
                                  }}
                                  style={[styles.exerciseInput, { color: t.text, borderColor: t.inputBorder }]}
                                  autoFocus
                                  returnKeyType="done"
                                />
                              ) : (
                                <TouchableOpacity
                                  style={styles.exercisePressArea}
                                  onPress={() => {
                                    if (!ex.slug) return;
                                    router.push(`/exercise/${ex.slug}`);
                                  }}
                                  activeOpacity={0.85}
                                >
                                  <Text style={[styles.exerciseText, { color: t.text }]} numberOfLines={1} ellipsizeMode="tail">
                                    {ex.name}
                                  </Text>
                                </TouchableOpacity>
                              )}

                              <View style={styles.iconRow}>
                                <TouchableOpacity
                                  style={styles.iconButton}
                                  onPress={() => {
                                    setEditingId(ex.id);
                                    setEditValue(ex.name);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }}
                                  hitSlop={10}
                                >
                                  <Ionicons name="create-outline" size={22} color={t.mutedText} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={styles.iconButton}
                                  onPress={() =>
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
                                            .eq("id", ex.id)
                                            .eq("user_id", uid);

                                          if (error) {
                                            Alert.alert("Delete failed", error.message);
                                            return;
                                          }

                                          setExercisesBySplit((prev) => {
                                            const existing = prev[currentSplit.id] ?? [];
                                            return { ...prev, [currentSplit.id]: existing.filter((e) => e.id !== ex.id) };
                                          });
                                        },
                                      },
                                    ])
                                  }
                                  hitSlop={10}
                                >
                                  <Ionicons name="trash-outline" size={22} color={t.danger} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          </RNAnimated.View>
                        ))}
                      </ScrollView>
                    )}
                  </RNAnimated.View>
                )}
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center" },

  topCard: { padding: 20, borderRadius: 22, marginVertical: 12, borderWidth: 1 },
  splitTitle: { fontSize: 22, fontWeight: "600" },
  focus: { marginTop: 4, fontSize: 13 },

  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  primaryButton: { padding: 12, borderRadius: 14, flex: 1, alignItems: "center" },
  primaryText: { fontWeight: "700" },
  secondaryButton: { padding: 12, borderRadius: 14, flex: 1, alignItems: "center" },
  secondaryText: { fontWeight: "700" },

  dotsRow: { flexDirection: "row", gap: 6, marginTop: 14 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: "#333" },

  exerciseCardWrapper: {
    flex: 1,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
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
  exerciseRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 28 },
  exercisePressArea: { flex: 1, justifyContent: "center" },
  exerciseText: { fontSize: 16, fontWeight: "600", letterSpacing: 0.2 },

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
