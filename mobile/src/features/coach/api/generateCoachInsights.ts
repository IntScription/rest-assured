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
    created_at: log.created_at,
    exercise_name: log.exercises?.name ?? "Exercise",
  }));

  const readiness = buildReadinessInsight({
    userId,
    recovery: input.recovery,
    health: input.todayHealth,
    weeklySessions: input.sessions,
  });

  const nextSession = buildNextSessionInsight({
    userId,
    profile: input.profile,
    recentLogs,
    nextSplitName,
  });

  const weeklyReview = buildWeeklyReviewInsight({
    userId,
    weeklySessions: input.sessions,
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
