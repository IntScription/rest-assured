import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/src/lib/supabase";
import type { ExerciseLite, LatestLogLite, SplitLite } from "../types";

export function useExercisesAndLatestLogs(user: User | null, currentSplit: SplitLite | null, isOnline: boolean) {
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
        // ✅ CRITICAL FIX: Removed ', rpe' from this select query
        .select("id, exercise_id, weight, reps, sets, created_at, type, day")
        .eq("user_id", user.id)
        .in("exercise_id", exerciseIds)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });

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
  }, [currentSplit?.id, exercisesBySplit, latestLogsByExercise, fetchExercises, fetchLatestLogsForExercises]);

  return { exercisesBySplit, setExercisesBySplit, latestLogsByExercise, setLatestLogsByExercise, editingId, setEditingId, editValue, setEditValue, fetchExercises };
}
