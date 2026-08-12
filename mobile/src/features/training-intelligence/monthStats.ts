import type { MonthlyTrainingStats, TrainingLog, WorkoutSession } from "./types";
import { calcVolume, getLogDate } from "./metrics";
import { getRecoveryWarnings } from "./recoveryRules";
import { getSplitBalance, getSplitBalanceWarnings } from "./splitBalance";

export function buildMonthlyStats({
  month,
  logs,
  sessions,
}: {
  month: string;
  logs: TrainingLog[];
  sessions: WorkoutSession[];
}): MonthlyTrainingStats {
  const monthLogs = logs.filter((log) => getLogDate(log).startsWith(month));
  const monthSessions = sessions.filter((session) =>
    session.workout_date.startsWith(month)
  );

  const completed = monthSessions.filter((session) =>
    ["completed", "auto_completed_rest"].includes(
      String(session.status ?? "completed")
    )
  );

  const restDaysCompleted = completed.filter((session) =>
    ["rest"].includes(String(session.session_type ?? ""))
  ).length;

  const skippedOrMissed = monthSessions.filter((session) =>
    ["skipped", "missed"].includes(String(session.status ?? ""))
  ).length;

  const totalSets = monthLogs.reduce((sum, log) => sum + Number(log.sets ?? 0), 0);
  const totalVolume = monthLogs.reduce(
    (sum, log) => sum + Number(log.volume ?? calcVolume(log)),
    0
  );

  const uniqueTrainingDays = new Set(monthLogs.map(getLogDate)).size;

  const byExercise = new Map<string, { exerciseId: string; name: string; volume: number; logs: number }>();
  const byDate = new Map<string, number>();

  monthLogs.forEach((log) => {
    const exerciseId = log.exercise_id;
    const name = log.exercise_name || "Exercise";
    const volume = Number(log.volume ?? calcVolume(log));
    const current = byExercise.get(exerciseId) ?? {
      exerciseId,
      name,
      volume: 0,
      logs: 0,
    };

    current.volume += volume;
    current.logs += 1;

    byExercise.set(exerciseId, current);

    const date = getLogDate(log);
    byDate.set(date, (byDate.get(date) ?? 0) + volume);
  });

  const highestVolumeDay = [...byDate.entries()]
    .map(([date, volume]) => ({ date, volume }))
    .sort((a, b) => b.volume - a.volume)[0] ?? null;

  const warnings = [
    ...getRecoveryWarnings({ logs: monthLogs, sessions: monthSessions }),
    ...getSplitBalanceWarnings(monthLogs),
  ];

  const consistencyScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        uniqueTrainingDays * 5 +
          completed.length * 2 -
          skippedOrMissed * 6 -
          warnings.length * 4
      )
    )
  );

  return {
    month,
    workoutsCompleted: completed.length - restDaysCompleted,
    restDaysCompleted,
    skippedOrMissed,
    totalLogs: monthLogs.length,
    totalSets,
    totalVolume,
    uniqueTrainingDays,
    topExercises: [...byExercise.values()]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5),
    highestVolumeDay,
    splitBalance: getSplitBalance(monthLogs),
    consistencyScore,
    warnings,
  };
}
