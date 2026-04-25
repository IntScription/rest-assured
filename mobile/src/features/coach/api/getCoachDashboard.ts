import { supabase } from "@/src/lib/supabase";
import type { CoachDashboardData } from "@/src/features/coach/types/coach";

export async function getCoachDashboard(userId: string): Promise<CoachDashboardData> {
  const today = new Date().toISOString().slice(0, 10);

  const [
    profileRes,
    measurementsRes,
    recoveryRes,
    readinessRes,
    nextSessionRes,
    weeklyReviewRes,
    skillFocusRes,
  ] = await Promise.all([
    supabase.from("coach_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("body_measurement_logs")
      .select("*")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("recovery_checkins")
      .select("*")
      .eq("user_id", userId)
      .eq("checkin_date", today)
      .maybeSingle(),
    supabase
      .from("coach_insights")
      .select("*")
      .eq("user_id", userId)
      .eq("insight_type", "readiness")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("coach_insights")
      .select("*")
      .eq("user_id", userId)
      .eq("insight_type", "next_session")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("coach_insights")
      .select("*")
      .eq("user_id", userId)
      .eq("insight_type", "weekly_review")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("coach_insights")
      .select("*")
      .eq("user_id", userId)
      .eq("insight_type", "skill_focus")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    profile: profileRes.data ?? null,
    latestMeasurements: measurementsRes.data ?? null,
    todayRecovery: recoveryRes.data ?? null,
    readinessInsight: readinessRes.data ?? null,
    nextSessionInsight: nextSessionRes.data ?? null,
    weeklyReviewInsight: weeklyReviewRes.data ?? null,
    skillFocusInsight: skillFocusRes.data ?? null,
  };
}
