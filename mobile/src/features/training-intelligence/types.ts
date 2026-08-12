export type TrainingLog = {
  id: string;
  exercise_id: string;
  split_id?: string | null;
  exercise_name?: string | null;
  split_name?: string | null;
  weight: number | null;
  reps: number;
  sets: number;
  volume?: number | null;
  rpe?: number | null;
  created_at: string | null;
  log_date?: string | null;
  type?: string | null;
  day?: string | null;
};

export type WorkoutSession = {
  id?: string;
  workout_date: string;
  split_id?: string | null;
  program_id?: string | null;
  session_type?: "workout" | "rest" | string | null;
  status?: "completed" | "missed" | "skipped" | "auto_completed_rest" | string | null;
  source?: "manual" | "auto" | "system" | string | null;
};

export type SplitLike = {
  id: string;
  name: string;
  focus?: string | null;
  is_rest_day?: boolean | null;
};

export type MonthlyTrainingStats = {
  month: string;
  workoutsCompleted: number;
  restDaysCompleted: number;
  skippedOrMissed: number;
  totalLogs: number;
  totalSets: number;
  totalVolume: number;
  uniqueTrainingDays: number;
  topExercises: { exerciseId: string; name: string; volume: number; logs: number }[];
  highestVolumeDay: { date: string; volume: number } | null;
  splitBalance: { split: string; volume: number; logs: number }[];
  consistencyScore: number;
  warnings: string[];
};
