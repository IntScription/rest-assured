export type SkillCategory =
  | "push"
  | "pull"
  | "core"
  | "balance"
  | "static"
  | "mobility"
  | "legs"
  | "full_body";

export type SkillDifficulty = "beginner" | "intermediate" | "advanced";

export type SkillMetricType = "seconds" | "reps" | "attempts" | "milestone";

export type Skill = {
  id: string;
  slug: string;
  name: string;
  category: SkillCategory;
  difficulty: SkillDifficulty;
  metric_type: SkillMetricType;
  short_description: string | null;
  is_active: boolean;
  created_at: string;
};

export type SkillStage = {
  id: string;
  skill_id: string;
  order_index: number;
  name: string;
  description: string | null;
  target_value: number | null;
  unit: string | null;
  created_at: string;
};

export type UserSkillStatus = "active" | "paused" | "completed" | "archived";

export type UserSkill = {
  id: string;
  user_id: string;
  skill_id: string;
  current_stage_id: string | null;
  status: UserSkillStatus;
  is_favorite: boolean;
  started_at: string;
  last_logged_at: string | null;
  created_at: string;
};

export type SkillLog = {
  id: string;
  user_id: string;
  user_skill_id: string;
  skill_id: string;
  stage_id: string | null;
  value: number | null;
  unit: string | null;
  attempts: number | null;
  notes: string | null;
  workout_session_id: string | null;
  exercise_id: string | null;
  logged_at: string;
  created_at: string;
};

export type UserSkillMilestone = {
  id: string;
  user_id: string;
  user_skill_id: string;
  skill_id: string;
  stage_id: string;
  achieved_at: string;
  best_value: number | null;
  note: string | null;
};

export type SkillDashboardCard = {
  skill: Skill;
  userSkill: UserSkill;
  currentStage: SkillStage | null;
  latestLog: SkillLog | null;
  bestLog: SkillLog | null;
  progressPercent: number;
  highlightText: string;
};

export type SkillsDashboardSummary = {
  activeSkills: number;
  sessionsThisWeek: number;
  streakDays: number;
  completedMilestones: number;
};

export type ChallengeStatus = "active" | "completed" | "expired";

export type ChallengeDefinition = {
  id: string;
  title: string;
  description: string | null;
  challenge_type: string;
  duration_type: string;
  target_value: number;
  is_active: boolean;
  created_at: string;
};

export type UserChallenge = {
  id: string;
  user_id: string;
  challenge_id: string;
  progress_value: number;
  status: ChallengeStatus;
  starts_at: string | null;
  ends_at: string | null;
  completed_at: string | null;
  created_at: string;
};
