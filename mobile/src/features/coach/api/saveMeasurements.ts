import { supabase } from "@/src/lib/supabase";

type SaveMeasurementsInput = {
  user_id: string;
  weight_kg?: number | null;
  waist_cm?: number | null;
  chest_cm?: number | null;
  left_arm_cm?: number | null;
  right_arm_cm?: number | null;
  left_thigh_cm?: number | null;
  right_thigh_cm?: number | null;
  hips_cm?: number | null;
  shoulders_cm?: number | null;
  body_fat_percent?: number | null;
  note?: string | null;
  source?: "manual" | "apple_health" | "imported";
};

export async function saveMeasurements(input: SaveMeasurementsInput) {
  const { data, error } = await supabase
    .from("body_measurement_logs")
    .insert({
      user_id: input.user_id,
      weight_kg: input.weight_kg ?? null,
      waist_cm: input.waist_cm ?? null,
      chest_cm: input.chest_cm ?? null,
      left_arm_cm: input.left_arm_cm ?? null,
      right_arm_cm: input.right_arm_cm ?? null,
      left_thigh_cm: input.left_thigh_cm ?? null,
      right_thigh_cm: input.right_thigh_cm ?? null,
      hips_cm: input.hips_cm ?? null,
      shoulders_cm: input.shoulders_cm ?? null,
      body_fat_percent: input.body_fat_percent ?? null,
      note: input.note ?? null,
      source: input.source ?? "manual",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
