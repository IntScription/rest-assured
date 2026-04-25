import { subDays } from "date-fns";
import { supabase } from "@/src/lib/supabase";
import type { CoachAskContext } from "@/src/features/coach/types/coach";

export async function getCoachInputs(userId: string) {
  const today = new Date();
  const last7Date = subDays(today, 7).toISOString().slice(0, 10);
  const last30Iso = subDays(today, 30).toISOString();
  const todayDate = today.toISOString().slice(0, 10);

  const [
    profileRes,
    recoveryRes,
    todayHealthRes,
    measurementsRes,
    sessionsRes,
    logsRes,
    activeProgramRes,
    splitsRes,
    userSkillsRes,
    skillLogsRes,
    insightsRes,
  ] = await Promise.all([
    supabase.from("coach_profiles").select("*").eq("user_id", userId).maybeSingle(),

    supabase
      .from("recovery_checkins")
      .select("*")
      .eq("user_id", userId)
      .order("checkin_date", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("health_sync_daily")
      .select("*")
      .eq("user_id", userId)
      .eq("sync_date", todayDate)
      .eq("source", "apple_health")
      .maybeSingle(),

    supabase
      .from("body_measurement_logs")
      .select("*")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("workout_date", last7Date)
      .order("workout_date", { ascending: false }),

    supabase
      .from("logs")
      .select("id, exercise_id, weight, reps, sets, created_at, exercises(name, split_id)")
      .eq("user_id", userId)
      .gte("created_at", last30Iso)
      .order("created_at", { ascending: false })
      .limit(40),

    supabase
      .from("programs")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("splits")
      .select("*")
      .eq("user_id", userId)
      .order("order_index", { ascending: true }),

    supabase
      .from("user_skills")
      .select("*, skills(*)")
      .eq("user_id", userId)
      .in("status", ["active"]),

    supabase
      .from("skill_logs")
      .select("*")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(30),

    supabase
      .from("coach_insights")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return {
    profile: profileRes.data ?? null,
    recovery: recoveryRes.data ?? null,
    todayHealth: todayHealthRes.data ?? null,
    measurements: measurementsRes.data ?? null,
    sessions: sessionsRes.data ?? [],
    logs: logsRes.data ?? [],
    activeProgram: activeProgramRes.data ?? null,
    splits: splitsRes.data ?? [],
    userSkills: userSkillsRes.data ?? [],
    skillLogs: skillLogsRes.data ?? [],
    insights: insightsRes.data ?? [],
  };
}

export async function buildCoachAskContext(userId: string): Promise<CoachAskContext> {
  const input = await getCoachInputs(userId);

  return {
    profile: input.profile,
    latestMeasurements: input.measurements,
    todayRecovery: input.recovery,
    recentLogs: input.logs.map((log: any) => ({
      exercise_name: log.exercises?.name ?? "Exercise",
      weight: log.weight,
      reps: log.reps,
      sets: log.sets,
      created_at: log.created_at,
    })),
    recentSkillLogs: input.skillLogs.map((row: any) => ({
      skill_id: row.skill_id,
      value: row.value ?? null,
      unit: row.unit ?? null,
      logged_at: row.logged_at,
    })),
    latestInsights: input.insights,
  };
}
