import type { TrainingLog } from "./types";
import { daysBetween, getTodayDateString } from "../train/lib/calendarDates";
import { getLogDate } from "./metrics";
import { averageGapBetweenDates } from "./streaks";

export function getExerciseDueSoonMessage(logs: TrainingLog[]) {
  const dates = logs.map(getLogDate).filter(Boolean).sort();

  if (!dates.length) return "No history yet. Log this exercise once to start tracking frequency.";

  const lastDate = dates[dates.length - 1];
  const gap = daysBetween(lastDate, getTodayDateString());
  const averageGap = averageGapBetweenDates(dates);

  if (averageGap && gap > averageGap * 1.5) {
    return `Overdue. Last logged ${gap} days ago; usual gap is about ${averageGap.toFixed(1)} days.`;
  }

  if (gap >= 5) return `Due soon. Last logged ${gap} days ago.`;

  return `On track. Last logged ${gap === 0 ? "today" : `${gap} days ago`}.`;
}
