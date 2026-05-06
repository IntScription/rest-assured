import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/src/lib/supabase";
import { useCoachDashboard } from "@/src/features/coach/hooks/useCoachDashboard";
import type { ExerciseLite, LatestLogLite, SplitLite } from "../types";
import {
  attachExerciseMeta,
  buildCoachProgressNotes,
  buildCurrentPrs,
  buildNeedsAttention,
  buildRecentActivity,
  flattenExercisesBySplit,
  sortLogsDesc,
  type LogWithExercise,
} from "../utils/homeInsights";

type UseHomeInsightsArgs = {
  user: User | null;
  isOnline: boolean;
  splits: SplitLite[];
  exercisesBySplit: Record<string, ExerciseLite[]>;
  latestLogsByExercise: Record<string, LatestLogLite | null>;
};

export function useHomeInsights({
  user,
  isOnline,
  splits,
  exercisesBySplit,
  latestLogsByExercise,
}: UseHomeInsightsArgs) {
  const [logs, setLogs] = useState<LatestLogLite[]>([]);
  const fetchSeq = useRef(0);
  const coachDashboard = useCoachDashboard(user?.id ?? null);

  const exercises = useMemo(
    () => flattenExercisesBySplit(splits, exercisesBySplit),
    [splits, exercisesBySplit]
  );

  const exerciseIds = useMemo(() => exercises.map((exercise) => exercise.id), [exercises]);
  const exerciseKey = useMemo(() => exerciseIds.join(","), [exerciseIds]);

  useEffect(() => {
    const latestLogs = Object.values(latestLogsByExercise).filter(Boolean) as LatestLogLite[];

    if (!user || !isOnline || exerciseIds.length === 0) {
      setLogs(sortLogsDesc(latestLogs));
      return;
    }

    const seq = ++fetchSeq.current;

    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from("logs")
        // ✅ Added rpe to select
        .select("id, exercise_id, weight, reps, sets, created_at, type, day, rpe")
        .eq("user_id", user.id)
        .in("exercise_id", exerciseIds)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(240);

      if (seq !== fetchSeq.current) return;

      if (error) {
        setLogs(sortLogsDesc(latestLogs));
        return;
      }

      setLogs((data ?? []) as LatestLogLite[]);
    };

    void fetchLogs();
  }, [user, isOnline, exerciseKey, latestLogsByExercise]);

  const logsWithMeta = useMemo<LogWithExercise[]>(
    () => attachExerciseMeta(logs, exercises),
    [logs, exercises]
  );

  return useMemo(
    () => ({
      recentActivity: buildRecentActivity(logsWithMeta),
      progressNotes: buildCoachProgressNotes(logsWithMeta, coachDashboard.data),
      recentPrs: buildCurrentPrs(logsWithMeta),
      needsAttention: buildNeedsAttention(exercises, latestLogsByExercise),
      coachLoading: coachDashboard.loading,
      refreshCoachInsights: coachDashboard.refetch,
    }),
    [logsWithMeta, coachDashboard.data, coachDashboard.loading, coachDashboard.refetch, exercises, latestLogsByExercise]
  );
}
