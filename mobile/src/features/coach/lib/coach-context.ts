import type {
  BodyMeasurementLogRow,
  CoachProfileRow,
  RecoveryCheckinRow,
} from "@/src/features/coach/types/coach";

export function buildCoachContext(params: {
  profile: CoachProfileRow | null;
  latestMeasurements: BodyMeasurementLogRow | null;
  todayRecovery: RecoveryCheckinRow | null;
  recentLogs: {
    exercise_name?: string;
    weight: number | null;
    reps: number;
    sets: number;
    created_at: string | null;
  }[];
}) {
  return {
    profile: params.profile
      ? {
        age: params.profile.age,
        sex: params.profile.sex,
        height_cm: params.profile.height_cm,
        weight_kg: params.profile.weight_kg,
        goal: params.profile.goal,
        training_style: params.profile.training_style,
        experience_level: params.profile.experience_level,
        training_days_per_week: params.profile.training_days_per_week,
      }
      : null,
    latest_measurements: params.latestMeasurements,
    today_recovery: params.todayRecovery,
    recent_logs: params.recentLogs.slice(0, 8),
  };
}
