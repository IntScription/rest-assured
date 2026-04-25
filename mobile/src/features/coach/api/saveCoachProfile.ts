import { supabase } from "@/src/lib/supabase";
import type { CoachProfileRow } from "@/src/features/coach/types/coach";

type SaveCoachProfileInput = Partial<CoachProfileRow> & {
  user_id: string;
};

export async function saveCoachProfile(input: SaveCoachProfileInput) {
  const payload = {
    user_id: input.user_id,
    age: input.age ?? null,
    sex: input.sex ?? null,
    height_cm: input.height_cm ?? null,
    weight_kg: input.weight_kg ?? null,
    goal: input.goal ?? "general_fitness",
    training_style: input.training_style ?? "hybrid",
    experience_level: input.experience_level ?? "beginner",
    training_days_per_week: input.training_days_per_week ?? null,
    activity_level: input.activity_level ?? null,
    primary_goal_notes: input.primary_goal_notes ?? null,
    injury_notes: input.injury_notes ?? null,
    equipment_notes: input.equipment_notes ?? null,
    onboarding_completed: input.onboarding_completed ?? false,
    onboarding_step: input.onboarding_step ?? "basics",
    apple_health_connected: input.apple_health_connected ?? false,
  };

  const { data, error } = await supabase
    .from("coach_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
