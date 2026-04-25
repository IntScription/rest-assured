import { supabase } from "@/src/lib/supabase";
import { buildProgramDraft } from "@/src/features/coach/lib/coach-program-rules";

export async function generateProgramDraft(userId: string) {
  const { data: profile, error } = await supabase
    .from("coach_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!profile) throw new Error("Coach profile not found");

  const draft = buildProgramDraft({
    goal: profile.goal,
    trainingStyle: profile.training_style,
    trainingDaysPerWeek: profile.training_days_per_week,
    experienceLevel: profile.experience_level,
  });

  const { data, error: insertError } = await supabase
    .from("coach_insights")
    .insert({
      user_id: userId,
      insight_type: "plan_adjustment",
      title: "Program Draft",
      summary: `Generated a ${draft.name} split draft.`,
      payload: draft,
      source: "rule_engine",
      model_name: null,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return data;
}
