import { format } from "date-fns";
import type { CompareInsight, CompareInsightTone, LogRow, LogTag, TrendMetric } from "../types";
import { formatCompactWeight, getLogTag } from "./formatters";

export function getComparableLogs(logs: LogRow[], currentTag: LogTag, reps: number) {
  const sameTagLogs = logs.filter((log) => getLogTag(log) === currentTag);
  const closeRepLogs = sameTagLogs.filter((log) => Math.abs(Number(log.reps ?? 0) - reps) <= 1);
  return closeRepLogs.length > 0 ? closeRepLogs : sameTagLogs;
}

export function getTrendMetricValue(log: LogRow, metric: TrendMetric): number | null {
  if (metric === "weight") return Number(log.weight ?? 0);
  if (metric === "reps") return Number(log.reps ?? 0);
  if (metric === "rpe") return log.rpe ?? null;
  return Number(log.volume ?? 0);
}

export function formatTrendMetricValue(metric: TrendMetric, value: number) {
  if (metric === "weight") return formatCompactWeight(value);
  if (metric === "reps") return `${value} reps`;
  if (metric === "rpe") return `RPE ${value}`;
  return `${value}`;
}

export type TrendSeriesPoint = {
  id: string;
  value: number;
  dateLabel: string;
};

/**
 * Chronological (oldest→newest) points for plotting, built from the most
 * recent `maxPoints` working logs. `logs` is expected newest-first, the
 * order the rest of the exercise screen already uses. Logs with no
 * comparable value for this metric (e.g. RPE wasn't logged for that set)
 * are skipped rather than plotted as 0.
 */
export function getTrendSeries(logs: LogRow[], metric: TrendMetric, maxPoints = 10): TrendSeriesPoint[] {
  return logs
    .slice(0, maxPoints)
    .reverse()
    .flatMap((log) => {
      const value = getTrendMetricValue(log, metric);
      if (value === null) return [];
      const date = log.created_at ? new Date(log.created_at) : null;
      return [
        {
          id: log.id,
          value,
          dateLabel: date && !Number.isNaN(date.getTime()) ? format(date, "MMM d") : "",
        },
      ];
    });
}

export function getProgressInsight(
  weightText: string,
  repsText: string,
  setsText: string,
  logs: LogRow[],
  currentTag: LogTag
): CompareInsight {
  const currentWeight = parseFloat(weightText) || 0;
  const currentReps = parseInt(repsText, 10) || 0;
  const currentSets = parseInt(setsText, 10) || 0;

  if (!currentReps || !currentSets) {
    return {
      tone: "neutral",
      title: "Fill reps and sets to compare against your history.",
      details: [],
    };
  }

  const comparableLogs = getComparableLogs(logs, currentTag, currentReps);
  if (comparableLogs.length === 0) {
    return {
      tone: "neutral",
      title: "This will become your first comparable log.",
      details: [],
    };
  }

  const latestComparable = comparableLogs[0];
  const bestComparable = [...comparableLogs].sort(
    (a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0)
  )[0];

  const currentVolume = Math.max(1, currentWeight) * currentReps * currentSets;
  const latestVolume = Number(latestComparable.volume ?? 0);
  const bestVolume = Number(bestComparable.volume ?? 0);

  const weightDelta = currentWeight - Number(latestComparable.weight ?? 0);
  const repDelta = currentReps - Number(bestComparable.reps ?? 0);
  const volumeVsLast = currentVolume - latestVolume;

  let tone: CompareInsightTone = "same";
  let title = "This matches your last comparable set.";

  if (currentWeight <= 0 && currentReps > Number(bestComparable.reps ?? 0)) {
    tone = "up";
    title = "This would beat your best comparable bodyweight set.";
  } else if (currentVolume > bestVolume && bestVolume > 0) {
    tone = "up";
    title = `This beats your best comparable set by ${currentVolume - bestVolume} volume.`;
  } else if (currentVolume > latestVolume) {
    tone = "up";
    title = `This is ${currentVolume - latestVolume} volume above your last comparable set.`;
  } else if (currentVolume < latestVolume) {
    tone = "down";
    title = `${latestVolume - currentVolume} volume below your last comparable set.`;
  }

  const details = [
    `${weightDelta === 0 ? "±0" : weightDelta > 0 ? "+" + weightDelta : String(weightDelta)} kg vs last working`,
    `${repDelta === 0 ? "Matches" : repDelta > 0 ? "+" + repDelta : String(repDelta)} reps vs best comparable`,
    `${volumeVsLast === 0 ? "±0" : volumeVsLast > 0 ? "+" + volumeVsLast : String(volumeVsLast)} volume vs last time`,
  ];

  return { tone, title, details };
}

export function getTrendCallouts(logs: LogRow[]) {
  if (logs.length === 0) return ["No working logs yet."];
  const latest = logs[0];
  const oldestSlice = [...logs].slice(0, 6).reverse();
  const first = oldestSlice[0];
  const last = oldestSlice[oldestSlice.length - 1];
  const weightDelta = Number(last?.weight ?? 0) - Number(first?.weight ?? 0);
  const volumeSeries = oldestSlice.map((log) => Number(log.volume ?? 0));
  let improvingSessions = 1;
  for (let i = volumeSeries.length - 1; i > 0; i -= 1) {
    if (volumeSeries[i] >= volumeSeries[i - 1]) improvingSessions += 1;
    else break;
  }
  const repDelta = Number(last?.reps ?? 0) - Number(first?.reps ?? 0);
  const daysSinceLast = latest?.created_at
    ? Math.floor((Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return [
    weightDelta > 0
      ? `Weight up ${weightDelta} kg over last ${oldestSlice.length} working logs`
      : weightDelta < 0
        ? `Weight down ${Math.abs(weightDelta)} kg over last ${oldestSlice.length} working logs`
        : "Weight is flat across recent working logs",
    improvingSessions >= 3
      ? `Volume improved ${improvingSessions} logs in a row`
      : repDelta > 0
        ? `Rep performance is trending up`
        : repDelta < 0
          ? `Rep performance dipped recently`
          : "Rep performance is flat",
    daysSinceLast !== null && daysSinceLast >= 1
      ? `No working logs in ${daysSinceLast} day${daysSinceLast === 1 ? "" : "s"}`
      : "You logged this exercise recently",
  ];
}
