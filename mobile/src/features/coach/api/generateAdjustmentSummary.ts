import { subDays } from "date-fns";
import { supabase } from "@/src/lib/supabase";
import { buildAdjustmentSummary } from "@/src/features/coach/lib/coach-program-rules";

export async function generateAdjustmentSummary(userId: string) {
  const last21Iso = subDays(new Date(), 21).toISOString();

  const [logsRes, recoveryRes] = await Promise.all([
    supabase
      .from("logs")
      .select("weight, reps, sets, created_at, exercises(name)")
      .eq("user_id", userId)
      .gte("created_at", last21Iso)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("recovery_checkins")
      .select("*")
      .eq("user_id", userId)
      .order("checkin_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (logsRes.error) throw logsRes.error;
  if (recoveryRes.error) throw recoveryRes.error;

  const summary = buildAdjustmentSummary({
    recentLogs: (logsRes.data ?? []).map((row: any) => ({
      exercise_name: row.exercises?.name ?? "Exercise",
      weight: row.weight,
      reps: row.reps,
      sets: row.sets,
    })),
    recovery: recoveryRes.data
      ? {
        sleep_hours: recoveryRes.data.sleep_hours,
        soreness_level: recoveryRes.data.soreness_level,
        stress_level: recoveryRes.data.stress_level,
      }
      : null,
  });

  const { data, error } = await supabase
    .from("coach_insights")
    .insert({
      user_id: userId,
      insight_type: "plan_adjustment",
      title: "Auto Adjustment",
      summary: summary.adjustment,
      payload: summary,
      source: "rule_engine",
      model_name: null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
