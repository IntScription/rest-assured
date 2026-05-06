import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { ExerciseLite, LatestLogLite } from "../types";
import {
  getExerciseProgressInfo,
  getPendingExerciseProgressInfo,
  type ExerciseProgressInfo,
} from "../utils/exerciseProgress";

type Result = {
  historyByExercise: Record<string, LatestLogLite[]>;
  progressByExercise: Record<string, ExerciseProgressInfo>;
};

export function useExerciseProgressMap({
  userId,
  exercises,
  latestLogsByExercise,
  logHistoryByExercise,
}: {
  userId: string;
  exercises: ExerciseLite[];
  latestLogsByExercise: Record<string, LatestLogLite | null>;
  logHistoryByExercise?: Record<string, LatestLogLite[]>;
}): Result {
  const [historyByExercise, setHistoryByExercise] = useState<Record<string, LatestLogLite[]>>({});
  const [loadedExerciseIdsKey, setLoadedExerciseIdsKey] = useState("");
  const previousProgressRef = useRef<Record<string, ExerciseProgressInfo>>({});

  const exerciseIds = useMemo(() => exercises.map((exercise) => exercise.id).filter(Boolean), [exercises]);
  const exerciseIdsKey = useMemo(() => [...exerciseIds].sort().join(":"), [exerciseIds]);

  useEffect(() => {
    let active = true;
    const fetchHistory = async () => {
      if (!userId || exerciseIds.length === 0) {
        setHistoryByExercise({});
        setLoadedExerciseIdsKey(exerciseIdsKey);
        return;
      }

      const { data, error } = await supabase
        .from("logs")
        // ✅ CRITICAL FIX: Removed ', rpe' from this select query
        .select("id, exercise_id, weight, reps, sets, created_at, type, day")
        .eq("user_id", userId)
        .in("exercise_id", exerciseIds)
        .order("created_at", { ascending: false })
        .limit(650);

      if (!active || error) return;

      const next: Record<string, LatestLogLite[]> = {};
      for (const id of exerciseIds) next[id] = [];
      for (const row of (data ?? []) as LatestLogLite[]) {
        if (!next[row.exercise_id]) next[row.exercise_id] = [];
        next[row.exercise_id].push(row);
      }
      setHistoryByExercise(next);
      setLoadedExerciseIdsKey(exerciseIdsKey);
    };

    if (!logHistoryByExercise || Object.keys(logHistoryByExercise).length === 0) {
      void fetchHistory();
    } else {
      setHistoryByExercise(logHistoryByExercise);
      setLoadedExerciseIdsKey(exerciseIdsKey);
    }

    return () => { active = false; };
  }, [userId, exerciseIdsKey, logHistoryByExercise, exerciseIds]);

  const mergedHistoryByExercise = useMemo(() => {
    const next = { ...historyByExercise };
    for (const exercise of exercises) {
      const latest = latestLogsByExercise[exercise.id];
      if (!latest) continue;
      const existing = next[exercise.id] ?? [];
      if (!existing.some((log) => log.id === latest.id)) next[exercise.id] = [latest, ...existing];
    }
    return next;
  }, [exercises, historyByExercise, latestLogsByExercise]);

  const progressByExercise = useMemo(() => {
    const historyLoadedForCurrentSet = loadedExerciseIdsKey === exerciseIdsKey;
    const previousProgress = previousProgressRef.current;
    const next: Record<string, ExerciseProgressInfo> = {};

    for (const exercise of exercises) {
      const latest = latestLogsByExercise[exercise.id];
      if (!latest) {
        next[exercise.id] = getPendingExerciseProgressInfo(null);
        continue;
      }
      if (!historyLoadedForCurrentSet) {
        next[exercise.id] = previousProgress[exercise.id] ?? getPendingExerciseProgressInfo(latest);
        continue;
      }
      next[exercise.id] = getExerciseProgressInfo(latest, mergedHistoryByExercise[exercise.id]);
    }
    previousProgressRef.current = next;
    return next;
  }, [exercises, latestLogsByExercise, mergedHistoryByExercise, loadedExerciseIdsKey, exerciseIdsKey]);

  return { historyByExercise: mergedHistoryByExercise, progressByExercise };
}
