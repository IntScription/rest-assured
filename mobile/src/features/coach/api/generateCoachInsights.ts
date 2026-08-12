import { subDays } from "date-fns";
import { supabase } from "@/src/lib/supabase";
import { getCoachInputs } from "@/src/features/coach/lib/coach-queries";
import {
  buildNextSessionInsight,
  buildReadinessInsight,
  buildSkillFocusInsight,
  buildWeeklyReviewInsight,
} from "@/src/features/coach/lib/coach-rules";

export async function generateCoachInsights(userId: string) {
  const input = await getCoachInputs(userId);

  const nextSplitName =
    input.splits.find((s: any) => typeof s.order_index === "number")?.name ?? null;

  const recentLogs = input.logs.map((log: any) => ({
    id: log.id,
    exercise_id: log.exercise_id,
    weight: log.weight,
    reps: log.reps,
    sets: log.sets,
    volume: log.volume,
    rpe: log.rpe,
    type: log.type,
    created_at: log.created_at,
    exercise_name: log.exercises?.name ?? "Exercise",
  }));

  // Advanced Insights (TUT) sets carry their own RPE in a separate table —
  // fold them into the readiness signal specifically (high-effort sets
  // should count toward recovery warnings regardless of which logging flow
  // they came through), without mixing them into next-session/skill
  // progression logic, which is scoped to the main lifts.
  const tutLogsAsWorkoutLogs = input.tutLogs.map((tut: any) => ({
    id: `tut:${tut.id}`,
    exercise_id: tut.exercise_id,
    weight: tut.load_kg,
    reps: tut.reps,
    sets: tut.sets,
    volume: null,
    rpe: tut.rpe,
    type: "working",
    created_at: tut.performed_on,
  }));

  const recentLogsWithTut = [...recentLogs, ...tutLogsAsWorkoutLogs];

  const last7Date = subDays(new Date(), 7).toISOString().slice(0, 10);
  const weeklySessions = input.sessions.filter((session: any) => session.workout_date >= last7Date);

  const readiness = buildReadinessInsight({
    userId,
    recovery: input.recovery,
    health: input.todayHealth,
    weeklySessions,
    recentLogs: recentLogsWithTut,
    sessions: input.sessions,
  });

  const nextSession = buildNextSessionInsight({
    userId,
    profile: input.profile,
    recentLogs,
    nextSplitName,
  });

  const weeklyReview = buildWeeklyReviewInsight({
    userId,
    weeklySessions,
    recentLogs,
  });

  const skillFocus = buildSkillFocusInsight({
    userId,
    userSkills: input.userSkills,
    skillLogs: input.skillLogs,
  });

  const payload = [readiness, nextSession, weeklyReview, skillFocus];

  const { error } = await supabase.from("coach_insights").insert(payload);
  if (error) throw error;

  return payload;
}
