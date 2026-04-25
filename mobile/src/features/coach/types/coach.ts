export type CoachGoal =
  | "fat_loss"
  | "recomp"
  | "hypertrophy"
  | "strength"
  | "skill"
  | "general_fitness";

export type CoachTrainingStyle =
  | "calisthenics"
  | "weighted_calisthenics"
  | "gym"
  | "hybrid"
  | "bodyweight";

export type CoachExperienceLevel = "beginner" | "intermediate" | "advanced";

export type CoachActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type CoachOnboardingStep =
  | "basics"
  | "measurements"
  | "lifestyle"
  | "health_permissions"
  | "complete";

export type CoachSex = "male" | "female" | "other" | "prefer_not_to_say";

export type CoachProfileRow = {
  user_id: string;
  age: number | null;
  sex: CoachSex | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: CoachGoal;
  training_style: CoachTrainingStyle;
  experience_level: CoachExperienceLevel;
  training_days_per_week: number | null;
  activity_level: CoachActivityLevel | null;
  primary_goal_notes: string | null;
  injury_notes: string | null;
  equipment_notes: string | null;
  onboarding_completed: boolean;
  onboarding_step: CoachOnboardingStep;
  apple_health_connected: boolean;
  created_at: string;
  updated_at: string;
};

export type BodyMeasurementLogRow = {
  id: string;
  user_id: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
  hips_cm: number | null;
  shoulders_cm: number | null;
  body_fat_percent: number | null;
  source: "manual" | "apple_health" | "imported";
  note: string | null;
  logged_at: string;
  created_at: string;
};

export type RecoveryCheckinRow = {
  id: string;
  user_id: string;
  sleep_hours: number | null;
  energy_level: number | null;
  soreness_level: number | null;
  stress_level: number | null;
  motivation_level: number | null;
  steps: number | null;
  resting_heart_rate: number | null;
  active_energy_kcal: number | null;
  note: string | null;
  checkin_date: string;
  created_at: string;
};

export type CoachInsightType =
  | "readiness"
  | "next_session"
  | "weekly_review"
  | "plan_adjustment"
  | "skill_focus"
  | "nutrition_hint";

export type CoachInsightRow = {
  id: string;
  user_id: string;
  insight_type: CoachInsightType;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  source: "rule_engine" | "ai" | "hybrid";
  model_name: string | null;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
};

export type CoachConversationRow = {
  id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  message: string;
  context: Record<string, unknown>;
  created_at: string;
};

export type CoachDashboardData = {
  profile: CoachProfileRow | null;
  latestMeasurements: BodyMeasurementLogRow | null;
  todayRecovery: RecoveryCheckinRow | null;
  readinessInsight: CoachInsightRow | null;
  nextSessionInsight: CoachInsightRow | null;
  weeklyReviewInsight: CoachInsightRow | null;
  skillFocusInsight: CoachInsightRow | null;
};

export type CoachAskContext = {
  profile: Partial<CoachProfileRow> | null;
  latestMeasurements: BodyMeasurementLogRow | null;
  todayRecovery: RecoveryCheckinRow | null;
  recentLogs: {
    exercise_name: string;
    weight: number | null;
    reps: number;
    sets: number;
    created_at: string | null;
  }[];
  recentSkillLogs: {
    skill_id: string;
    value: number | null;
    unit: string | null;
    logged_at: string;
  }[];
  latestInsights: CoachInsightRow[];
};

export type CoachProviderRequest = {
  prompt: string;
  context: CoachAskContext;
};

export type CoachProviderResponse = {
  message: string;
  model: string | null;
  source: "hosted" | "local";
};
