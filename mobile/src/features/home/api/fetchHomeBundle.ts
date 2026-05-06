import { supabase } from "@/src/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { LatestLogLite, Program, SplitLite } from "../types";

export async function fetchHomeBundle(user: User, activeProgram: Program) {
  const { data: splitRows, error: splitsError } = await supabase
    .from("splits")
    .select("id, name, focus, order_index")
    .eq("program_id", activeProgram.id)
    .eq("user_id", user.id)
    .order("order_index", { ascending: true });

  if (splitsError) throw splitsError;

  const splits: SplitLite[] = (splitRows ?? []).map((split: any) => ({
    id: split.id,
    name: split.name,
    focus: split.focus ?? null,
    order_index: split.order_index,
  }));

  const splitIds = splits.map((split) => split.id);
  const exercisesBySplit: Record<string, any[]> = {};
  for (const splitId of splitIds) { exercisesBySplit[splitId] = []; }

  if (splitIds.length === 0) {
    return { splits, exercisesBySplit, latestLogsByExercise: {}, logHistoryByExercise: {} };
  }

  const { data: exerciseRows, error: exError } = await supabase
    .from("exercises")
    .select("id, name, slug, split_id")
    .eq("user_id", user.id)
    .in("split_id", splitIds)
    .order("id", { ascending: true });

  if (exError) throw exError;

  const exerciseIds: string[] = [];

  (exerciseRows ?? []).forEach((row: any) => {
    if (!exercisesBySplit[row.split_id]) exercisesBySplit[row.split_id] = [];
    exercisesBySplit[row.split_id].push({
      id: row.id,
      name: row.name,
      slug: row.slug ?? null
    });
    exerciseIds.push(row.id);
  });

  const latestLogsByExercise: Record<string, LatestLogLite | null> = {};
  const logHistoryByExercise: Record<string, LatestLogLite[]> = {};

  if (exerciseIds.length > 0) {
    // ✅ CRITICAL FIX: Removed ', rpe' from this select query
    const { data: logRows, error: logsError } = await supabase
      .from("logs")
      .select("id, exercise_id, weight, reps, sets, created_at, type, day")
      .eq("user_id", user.id)
      .in("exercise_id", exerciseIds)
      .order("created_at", { ascending: false });

    if (logsError) throw logsError;

    (logRows ?? []).forEach((row: any) => {
      if (!latestLogsByExercise[row.exercise_id]) latestLogsByExercise[row.exercise_id] = row;
      if (!logHistoryByExercise[row.exercise_id]) logHistoryByExercise[row.exercise_id] = [];

      if (logHistoryByExercise[row.exercise_id].length < 15) {
        logHistoryByExercise[row.exercise_id].push(row);
      }
    });
  }

  return { splits, exercisesBySplit, latestLogsByExercise, logHistoryByExercise };
}
