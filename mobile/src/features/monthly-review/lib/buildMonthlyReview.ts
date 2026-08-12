import { supabase } from "@/src/lib/supabase";
import { getMonthEnd, getMonthStart } from "@/src/features/train/lib/calendarDates";
import { buildMonthlyStats } from "@/src/features/training-intelligence/monthStats";
import type { TrainingLog, WorkoutSession } from "@/src/features/training-intelligence/types";

export async function buildMonthlyReview({
  userId,
  programId,
  monthDate,
}: {
  userId: string;
  programId?: string | null;
  monthDate: string;
}) {
  const start = getMonthStart(monthDate);
  const end = getMonthEnd(monthDate);
  const month = start.slice(0, 7);

  const [logsRes, sessionsRes] = await Promise.all([
    supabase
      .from("logs")
      .select(`
        id,
        exercise_id,
        weight,
        reps,
        sets,
        volume,
        created_at,
        log_date,
        type,
        day,
        exercises(name, split_id, splits(name))
      `)
      .eq("user_id", userId)
      .gte("log_date", start)
      .lte("log_date", end),

    supabase
      .from("workout_sessions")
      .select("id, workout_date, split_id, program_id, session_type, status, source")
      .eq("user_id", userId)
      .gte("workout_date", start)
      .lte("workout_date", end),
  ]);

  if (logsRes.error) throw logsRes.error;
  if (sessionsRes.error) throw sessionsRes.error;

  const logs = ((logsRes.data ?? []) as any[]).map((row) => ({
    ...row,
    exercise_name: row.exercises?.name ?? null,
    split_id: row.exercises?.split_id ?? null,
    split_name: row.exercises?.splits?.name ?? row.day ?? null,
  })) as TrainingLog[];

  const sessions = (sessionsRes.data ?? []) as WorkoutSession[];

  const stats = buildMonthlyStats({
    month,
    logs,
    sessions: programId
      ? sessions.filter((session) => session.program_id === programId)
      : sessions,
  });

  return stats;
}

export async function saveMonthlyReview({
  userId,
  programId,
  reviewMonth,
  stats,
  aiFeedback,
}: {
  userId: string;
  programId?: string | null;
  reviewMonth: string;
  stats: unknown;
  aiFeedback?: unknown;
}) {
  const { error } = await supabase.from("monthly_training_reviews").upsert(
    {
      user_id: userId,
      program_id: programId ?? null,
      review_month: reviewMonth,
      stats,
      ai_feedback: aiFeedback ?? null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,program_id,review_month",
    }
  );

  if (error) throw error;
}
