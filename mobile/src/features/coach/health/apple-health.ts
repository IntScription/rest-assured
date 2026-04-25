import {
  HealthType,
  getActiveEnergyBurned,
  getBodyMass,
  getDistanceWalkingRunning,
  getRestingHeartRate,
  getSleepAnalysis,
  getStepCount,
  initHealthKit,
  isHealthDataAvailable,
} from "react-native-use-health-kit";

import { supabase } from "@/src/lib/supabase";

export type AppleHealthSnapshot = {
  steps: number | null;
  active_energy_kcal: number | null;
  sleep_minutes: number | null;
  resting_heart_rate: number | null;
  body_mass_kg: number | null;
  walking_running_distance_m: number | null;
};

type SleepSample = {
  startDate: string | Date;
  endDate: string | Date;
};

const READ_TYPES: HealthType[] = [
  "stepCount",
  "activeEnergyBurned",
  "sleepAnalysis",
  "restingHeartRate",
  "bodyMass",
  "distanceWalkingRunning",
];

export async function requestAppleHealthPermissions() {
  const available = await isHealthDataAvailable();

  if (!available) {
    throw new Error("HealthKit is not available on this device.");
  }

  const authorized = await initHealthKit(READ_TYPES, []);

  if (!authorized) {
    throw new Error("HealthKit permission was denied.");
  }

  return true;
}

function getDateRange(days = 7) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  return { startDate, endDate };
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function isSleepSample(value: unknown): value is SleepSample {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;

  return (
    ("startDate" in record &&
      (typeof record.startDate === "string" || record.startDate instanceof Date)) &&
    ("endDate" in record &&
      (typeof record.endDate === "string" || record.endDate instanceof Date))
  );
}

function normalizeSleepSamples(value: unknown): SleepSample[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isSleepSample);
}

export async function fetchAppleHealthSnapshot(days = 7): Promise<AppleHealthSnapshot> {
  const { startDate, endDate } = getDateRange(days);

  const [
    steps,
    activeEnergy,
    rawSleepSamples,
    restingHeartRate,
    bodyMass,
    distanceWalkingRunning,
  ] = await Promise.all([
    getStepCount({ startDate, endDate }).catch(() => null),
    getActiveEnergyBurned({ startDate, endDate }).catch(() => null),
    getSleepAnalysis({ startDate, endDate }).catch(() => [] as SleepSample[]),
    getRestingHeartRate({ startDate, endDate }).catch(() => null),
    getBodyMass({ startDate, endDate }).catch(() => null),
    getDistanceWalkingRunning({ startDate, endDate }).catch(() => null),
  ]);

  const sleepSamples = normalizeSleepSamples(rawSleepSamples);

  const totalSleepMinutes = sleepSamples.reduce((sum, sample) => {
    return sum + minutesBetween(new Date(sample.startDate), new Date(sample.endDate));
  }, 0);

  return {
    steps: typeof steps === "number" ? steps : null,
    active_energy_kcal: typeof activeEnergy === "number" ? activeEnergy : null,
    sleep_minutes: totalSleepMinutes || null,
    resting_heart_rate: typeof restingHeartRate === "number" ? restingHeartRate : null,
    body_mass_kg: typeof bodyMass === "number" ? bodyMass : null,
    walking_running_distance_m:
      typeof distanceWalkingRunning === "number" ? distanceWalkingRunning : null,
  };
}

export async function syncAppleHealthToSupabase(userId: string, days = 7) {
  await requestAppleHealthPermissions();
  const summary = await fetchAppleHealthSnapshot(days);

  const today = new Date().toISOString().slice(0, 10);

  const { error: dailyError } = await supabase.from("health_sync_daily").upsert(
    {
      user_id: userId,
      sync_date: today,
      steps: summary.steps,
      active_energy_kcal: summary.active_energy_kcal,
      sleep_minutes: summary.sleep_minutes,
      resting_heart_rate: summary.resting_heart_rate,
      body_mass_kg: summary.body_mass_kg,
      source: "apple_health",
      raw_payload: {
        walking_running_distance_m: summary.walking_running_distance_m,
      },
    },
    { onConflict: "user_id,sync_date,source" }
  );

  if (dailyError) throw dailyError;

  const { error: recoveryError } = await supabase.from("recovery_checkins").upsert(
    {
      user_id: userId,
      checkin_date: today,
      steps: summary.steps,
      resting_heart_rate: summary.resting_heart_rate,
      active_energy_kcal: summary.active_energy_kcal,
      sleep_hours:
        summary.sleep_minutes != null
          ? Number((summary.sleep_minutes / 60).toFixed(2))
          : null,
    },
    { onConflict: "user_id,checkin_date" }
  );

  if (recoveryError) throw recoveryError;

  if (summary.body_mass_kg != null) {
    const { error: measurementError } = await supabase.from("body_measurement_logs").insert({
      user_id: userId,
      weight_kg: summary.body_mass_kg,
      source: "apple_health",
      note: "Synced from Apple Health",
    });

    if (measurementError) throw measurementError;
  }

  const { error: profileError } = await supabase
    .from("coach_profiles")
    .update({
      apple_health_connected: true,
    })
    .eq("user_id", userId);

  if (profileError) throw profileError;

  return summary;
}
