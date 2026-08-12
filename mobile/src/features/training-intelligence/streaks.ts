import { addDays, daysBetween, getTodayDateString } from "../train/lib/calendarDates";

export function getTrainingConsistencyStreak(completedDates: string[]) {
  const completed = new Set(completedDates);
  let streak = 0;
  let cursor = getTodayDateString();

  for (let i = 0; i < 365; i++) {
    if (completed.has(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }

    break;
  }

  return streak;
}

export function averageGapBetweenDates(dates: string[]) {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length < 2) return null;

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1], sorted[i]));
  }

  return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
}
