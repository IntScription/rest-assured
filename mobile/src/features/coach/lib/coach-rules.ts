import type {
  CoachInsightRow,
  CoachProfileRow,
  RecoveryCheckinRow,
} from "@/src/features/coach/types/coach";
import type { LogRow, PrFlags } from "@/src/features/exercise/types";
import { detectPlateau } from "@/src/features/exercise/utils/plateauDetection";
import { getPrFlags } from "@/src/features/exercise/utils/prLogic";
import type { SkillLog, SkillMetricType } from "@/src/features/skills/types";
import { getSkillBestLog, getSkillPrFlags } from "@/src/features/skills/utils/skill-pr";
import { getNextSetSuggestion } from "@/src/features/training-intelligence/nextSetSuggestion";
import { getRecoveryWarnings } from "@/src/features/training-intelligence/recoveryRules";

type WorkoutLogLite = {
  id: string;
  exercise_id: string;
  weight: number | null;
  reps: number;
  sets: number;
  volume?: number | null;
  rpe?: number | null;
  type?: string | null;
  created_at: string | null;
  exercise_name?: string;
};

type WorkoutSessionLite = {
  id: string;
  workout_date: string;
  completed_at: string | null;
  status?: string | null;
};

type UserSkillLite = {
  id: string;
  skill_id: string;
  status: string;
  skills?: {
    id: string;
    name: string;
    category: string;
    difficulty: string;
    metric_type: SkillMetricType;
  } | null;
};

type HealthSyncDailyLite = {
  sleep_minutes: number | null;
  resting_heart_rate: number | null;
  steps: number | null;
  active_energy_kcal: number | null;
};

function getEffectiveRecovery(params: {
  recovery: RecoveryCheckinRow | null;
  health: HealthSyncDailyLite | null;
}) {
  const sleepHours =
    params.recovery?.sleep_hours != null
      ? params.recovery.sleep_hours
      : params.health?.sleep_minutes != null
        ? Number((params.health.sleep_minutes / 60).toFixed(2))
        : null;

  const restingHeartRate =
    params.recovery?.resting_heart_rate != null
      ? params.recovery.resting_heart_rate
      : params.health?.resting_heart_rate ?? null;

  const steps =
    params.recovery?.steps != null
      ? params.recovery.steps
      : params.health?.steps ?? null;

  const activeEnergy =
    params.recovery?.active_energy_kcal != null
      ? params.recovery.active_energy_kcal
      : params.health?.active_energy_kcal ?? null;

  return {
    sleepHours,
    restingHeartRate,
    steps,
    activeEnergy,
    energyLevel: params.recovery?.energy_level ?? null,
    sorenessLevel: params.recovery?.soreness_level ?? null,
    stressLevel: params.recovery?.stress_level ?? null,
    motivationLevel: params.recovery?.motivation_level ?? null,
  };
}

export function calculateReadinessScore(input: {
  recovery: RecoveryCheckinRow | null;
  health: HealthSyncDailyLite | null;
  weeklySessions: WorkoutSessionLite[];
  recentLogs?: WorkoutLogLite[];
  sessions?: WorkoutSessionLite[];
}): { score: number; status: "ready" | "moderate" | "recover"; reasons: string[] } {
  const { weeklySessions } = input;
  const recovery = getEffectiveRecovery({
    recovery: input.recovery,
    health: input.health,
  });

  let score = 70;
  const reasons: string[] = [];

  if (recovery.sleepHours != null) {
    if (recovery.sleepHours >= 8) {
      score += 10;
      reasons.push("sleep is strong");
    } else if (recovery.sleepHours >= 6.5) {
      score += 4;
      reasons.push("sleep is acceptable");
    } else {
      score -= 12;
      reasons.push("sleep is low");
    }
  }

  if (recovery.energyLevel != null) {
    score += (recovery.energyLevel - 3) * 5;
    if (recovery.energyLevel <= 2) reasons.push("energy feels low");
  }

  if (recovery.sorenessLevel != null) {
    score -= (recovery.sorenessLevel - 1) * 4;
    if (recovery.sorenessLevel >= 4) reasons.push("soreness is high");
  }

  if (recovery.stressLevel != null) {
    score -= (recovery.stressLevel - 1) * 3;
    if (recovery.stressLevel >= 4) reasons.push("stress is elevated");
  }

  if (recovery.restingHeartRate != null) {
    if (recovery.restingHeartRate <= 56) {
      score += 3;
      reasons.push("resting heart rate looks favorable");
    } else if (recovery.restingHeartRate >= 68) {
      score -= 5;
      reasons.push("resting heart rate is elevated");
    }
  }

  if (recovery.steps != null && recovery.steps >= 14000) {
    score -= 2;
    reasons.push("daily activity load is already high");
  }

  if (weeklySessions.length >= 5) {
    score -= 5;
    reasons.push("training frequency this week is high");
  }

  // Adherence/recovery warnings from the wider (30-day) log and session
  // history — days since last workout, 3-days-in-a-row, and high RPE count.
  // See training-intelligence/recoveryRules.ts.
  if (input.recentLogs && input.sessions) {
    const warnings = getRecoveryWarnings({ logs: input.recentLogs, sessions: input.sessions });
    for (const warning of warnings) {
      score -= 6;
      reasons.push(warning);
    }
  }

  if (score >= 75) return { score, status: "ready", reasons };
  if (score >= 55) return { score, status: "moderate", reasons };
  return { score, status: "recover", reasons };
}

export function buildReadinessInsight(params: {
  userId: string;
  recovery: RecoveryCheckinRow | null;
  health: HealthSyncDailyLite | null;
  weeklySessions: WorkoutSessionLite[];
  recentLogs?: WorkoutLogLite[];
  sessions?: WorkoutSessionLite[];
}): Omit<CoachInsightRow, "id" | "created_at"> {
  const result = calculateReadinessScore(params);

  const summary =
    result.status === "ready"
      ? "You look ready to train normally today."
      : result.status === "moderate"
        ? "You can train today, but keep effort and extra volume controlled."
        : "Recovery should take priority today.";

  return {
    user_id: params.userId,
    insight_type: "readiness",
    title: "Today’s Readiness",
    summary,
    payload: {
      score: result.score,
      status: result.status,
      reasons: result.reasons,
      used_health_sync_fallback:
        params.recovery?.sleep_hours == null ||
        params.recovery?.resting_heart_rate == null,
    },
    source: "rule_engine",
    model_name: null,
    valid_from: new Date().toISOString(),
    valid_until: null,
  };
}

function getMostRelevantWeightedLog(logs: WorkoutLogLite[]) {
  return logs.find((log) => typeof log.weight === "number" && log.weight > 0);
}

function toLogRow(userId: string, log: WorkoutLogLite): LogRow {
  return {
    id: log.id,
    user_id: userId,
    exercise_id: log.exercise_id,
    weight: log.weight,
    reps: log.reps,
    sets: log.sets,
    volume: log.volume ?? null,
    created_at: log.created_at,
    type: log.type ?? null,
    rpe: log.rpe ?? null,
  };
}

export function buildNextSessionInsight(params: {
  userId: string;
  profile: CoachProfileRow | null;
  recentLogs: WorkoutLogLite[];
  nextSplitName: string | null;
}): Omit<CoachInsightRow, "id" | "created_at"> {
  const latestWeightedLog = getMostRelevantWeightedLog(params.recentLogs);

  let summary = "Log your next session and Coach will start suggesting targets.";
  let payload: Record<string, unknown> = {
    next_split_name: params.nextSplitName,
    suggestion_available: false,
  };

  if (latestWeightedLog) {
    const exerciseHistory: LogRow[] = params.recentLogs
      .filter((log) => log.exercise_id === latestWeightedLog.exercise_id)
      .map((log) => toLogRow(params.userId, log));

    const prFlags: Record<string, PrFlags> = getPrFlags(exerciseHistory);
    const plateau = detectPlateau(exerciseHistory, prFlags);
    const suggestion = getNextSetSuggestion(exerciseHistory);

    const latestFlags = prFlags[latestWeightedLog.id];
    const isRecentPr = Boolean(latestFlags?.heaviest || latestFlags?.volume);

    const sentences = [suggestion.suggestion];
    if (isRecentPr) {
      sentences.push("Your last set here was a new PR — nice work.");
    }
    if (plateau.isPlateaued) {
      sentences.push(plateau.message);
    }

    summary = sentences.join(" ");

    payload = {
      next_split_name: params.nextSplitName,
      suggestion_available: true,
      based_on_log: {
        exercise_name: latestWeightedLog.exercise_name ?? "Exercise",
        weight: latestWeightedLog.weight,
        reps: latestWeightedLog.reps,
        sets: latestWeightedLog.sets,
      },
      focus_exercise_id: latestWeightedLog.exercise_id,
      focus_exercise_name: latestWeightedLog.exercise_name ?? "Exercise",
      suggestion_title: suggestion.title,
      tone: suggestion.tone,
      is_plateaued: plateau.isPlateaued,
      is_recent_pr: isRecentPr,
    };
  }

  return {
    user_id: params.userId,
    insight_type: "next_session",
    title: "Next Session",
    summary,
    payload,
    source: "rule_engine",
    model_name: null,
    valid_from: new Date().toISOString(),
    valid_until: null,
  };
}

export function buildWeeklyReviewInsight(params: {
  userId: string;
  weeklySessions: WorkoutSessionLite[];
  recentLogs: WorkoutLogLite[];
}): Omit<CoachInsightRow, "id" | "created_at"> {
  const sessionCount = params.weeklySessions.length;
  const totalSets = params.recentLogs.reduce((sum, log) => sum + (log.sets ?? 0), 0);

  let summary = "A steady week overall.";
  if (sessionCount === 0) summary = "No sessions were completed this week yet.";
  else if (sessionCount <= 2) summary = "Consistency can improve this week.";
  else if (sessionCount >= 4) summary = "Training consistency looks solid this week.";

  return {
    user_id: params.userId,
    insight_type: "weekly_review",
    title: "Weekly Review",
    summary,
    payload: {
      sessions_completed: sessionCount,
      total_sets_logged: totalSets,
    },
    source: "rule_engine",
    model_name: null,
    valid_from: new Date().toISOString(),
    valid_until: null,
  };
}

function formatSkillValue(log: SkillLog, metricType: SkillMetricType): string | null {
  if (metricType === "seconds") return `${log.value ?? 0}${log.unit ?? "s"}`;
  if (metricType === "reps") return `${log.value ?? 0} reps`;
  if (metricType === "attempts") return `${log.attempts ?? 0} attempts`;
  return null;
}

export function buildSkillFocusInsight(params: {
  userId: string;
  userSkills: UserSkillLite[];
  skillLogs: SkillLog[];
}): Omit<CoachInsightRow, "id" | "created_at"> {
  const latestSkillLog = params.skillLogs[0] ?? null;
  const activeSkill =
    params.userSkills.find((s) => s.skill_id === latestSkillLog?.skill_id) ??
    params.userSkills[0] ??
    null;

  const skillName = activeSkill?.skills?.name ?? "Skill practice";
  const metricType = activeSkill?.skills?.metric_type ?? null;

  let summary: string;
  let bestLog: SkillLog | null = null;
  let isNewBest = false;

  if (latestSkillLog && activeSkill && metricType) {
    const skillLogsForSkill = params.skillLogs.filter((log) => log.skill_id === activeSkill.skill_id);
    bestLog = getSkillBestLog(skillLogsForSkill, metricType);
    const flags = getSkillPrFlags(skillLogsForSkill, metricType);
    isNewBest = Boolean(flags[latestSkillLog.id]);

    const bestValueLabel = bestLog ? formatSkillValue(bestLog, metricType) : null;

    summary =
      isNewBest && bestValueLabel
        ? `New personal best on ${skillName}: ${bestValueLabel}. Keep building on it.`
        : bestValueLabel
          ? `Keep pushing ${skillName}. Best so far: ${bestValueLabel}.`
          : `Keep pushing ${skillName}. Stay consistent and aim to improve control or output on your next practice.`;
  } else if (activeSkill) {
    summary = `You have ${skillName} active. Log it consistently so Coach can guide progression better.`;
  } else {
    summary = "Start tracking a skill so Coach can suggest a focused progression target.";
  }

  return {
    user_id: params.userId,
    insight_type: "skill_focus",
    title: "Skill Focus",
    summary,
    payload: {
      skill_name: skillName,
      active_skill_id: activeSkill?.skill_id ?? null,
      last_skill_log_at: latestSkillLog?.logged_at ?? null,
      is_new_best: isNewBest,
      best_value: bestLog?.value ?? null,
    },
    source: "rule_engine",
    model_name: null,
    valid_from: new Date().toISOString(),
    valid_until: null,
  };
}
