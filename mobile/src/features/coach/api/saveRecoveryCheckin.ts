import { supabase } from "@/src/lib/supabase";

type SaveRecoveryCheckinInput = {
  user_id: string;
  sleep_hours?: number | null;
  energy_level?: number | null;
  soreness_level?: number | null;
  stress_level?: number | null;
  motivation_level?: number | null;
  steps?: number | null;
  resting_heart_rate?: number | null;
  active_energy_kcal?: number | null;
  note?: string | null;
  checkin_date?: string;
};

export async function saveRecoveryCheckin(input: SaveRecoveryCheckinInput) {
  const { data, error } = await supabase
    .from("recovery_checkins")
    .upsert(
      {
        user_id: input.user_id,
        sleep_hours: input.sleep_hours ?? null,
        energy_level: input.energy_level ?? null,
        soreness_level: input.soreness_level ?? null,
        stress_level: input.stress_level ?? null,
        motivation_level: input.motivation_level ?? null,
        steps: input.steps ?? null,
        resting_heart_rate: input.resting_heart_rate ?? null,
        active_energy_kcal: input.active_energy_kcal ?? null,
        note: input.note ?? null,
        checkin_date: input.checkin_date ?? new Date().toISOString().slice(0, 10),
      },
      { onConflict: "user_id,checkin_date" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
