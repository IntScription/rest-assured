import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/src/lib/supabase";
import type { CycleRow, Program, SplitLite } from "../types";

export function useWorkoutCycles(user: User | null, activeProgram: Program | null, splits: SplitLite[]) {
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

  return { activeCycle, completedSplits, ensureActiveCycle, fetchCompletedForCycle, toggleComplete, resetCycle, cycleDone, setCycleDone };
}
