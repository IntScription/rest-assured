import type { TrainingLog, WorkoutSession } from "./types";
import { daysBetween, getTodayDateString } from "../train/lib/calendarDates";
import { getLogDate } from "./metrics";

export function getRecoveryWarnings({
  logs,
  sessions,
}: {
  logs: TrainingLog[];
  sessions: WorkoutSession[];
}) {
  const warnings: string[] = [];
  const today = getTodayDateString();

  const completedDates = [...new Set(
    sessions
      .filter((session) =>
        ["completed", "auto_completed_rest"].includes(String(session.status ?? "completed"))
      )
      .map((session) => session.workout_date)
  )].sort();

  const lastWorkoutDate = completedDates[completedDates.length - 1] ?? null;

  if (lastWorkoutDate) {
    const gap = daysBetween(lastWorkoutDate, today);
    if (gap >= 6) {
      warnings.push(`Last workout was ${gap} days ago. Ease back in with a conservative session.`);
    }
  }

  const logDates = [...new Set(logs.map(getLogDate).filter(Boolean))].sort();
  const recent = logDates.slice(-5);

  if (recent.length >= 3) {
    const last = recent.slice(-3);
    const span = daysBetween(last[0], last[2]);
    if (span <= 2) {
      warnings.push("You trained 3 days in a row. Consider a rest or lighter skill day.");
    }
  }

  const highRpeCount = logs.filter((log) => Number(log.rpe ?? 0) >= 8.5).length;
  if (highRpeCount >= 3) {
    warnings.push("Several recent sets were high RPE. Consider repeating load or taking a lighter day.");
  }

  return warnings;
}
