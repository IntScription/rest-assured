import { format } from "date-fns";
import type { SkillLog, SkillMetricType } from "@/src/features/skills/types";

/**
 * The number that actually gets compared for "personal best" purposes.
 * "attempts"-type skills never populate `value` (only `attempts`), so
 * scoring by `value` alone silently breaks PR detection for them.
 */
export function getSkillMetricValue(log: SkillLog, metricType: SkillMetricType): number | null {
  if (metricType === "attempts") return log.attempts;
  if (metricType === "seconds" || metricType === "reps") return log.value;
  return null;
}

export function getSkillBestLog(logs: SkillLog[], metricType: SkillMetricType): SkillLog | null {
  return logs.reduce<SkillLog | null>((best, log) => {
    const value = getSkillMetricValue(log, metricType);
    if (value === null) return best;
    const bestValue = best ? getSkillMetricValue(best, metricType) : null;
    if (bestValue === null || value > bestValue) return log;
    return best;
  }, null);
}

/**
 * Per-log "was this a personal record when it was logged" flags, mirroring
 * the exercise feature's getPrFlags (see prLogic.ts) — a running best
 * evaluated oldest-to-newest.
 */
export function getSkillPrFlags(logs: SkillLog[], metricType: SkillMetricType): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  let best = -Infinity;

  [...logs].reverse().forEach((log) => {
    const value = getSkillMetricValue(log, metricType);
    if (value === null) {
      flags[log.id] = false;
      return;
    }
    if (value > best) {
      flags[log.id] = true;
      best = value;
    } else {
      flags[log.id] = false;
    }
  });

  return flags;
}

export type SkillTrendPoint = {
  id: string;
  value: number;
  dateLabel: string;
};

/**
 * Chronological (oldest→newest) points for plotting, built from the most
 * recent `maxPoints` logs. `logs` is expected newest-first (the order
 * skill_logs is already fetched in throughout this feature). Logs with no
 * comparable value for this metric type (e.g. a milestone log) are skipped.
 */
export function getSkillTrendSeries(
  logs: SkillLog[],
  metricType: SkillMetricType,
  maxPoints = 10
): SkillTrendPoint[] {
  return logs
    .slice(0, maxPoints)
    .reverse()
    .flatMap((log) => {
      const value = getSkillMetricValue(log, metricType);
      if (value === null) return [];
      const date = new Date(log.logged_at);
      return [
        {
          id: log.id,
          value,
          dateLabel: !Number.isNaN(date.getTime()) ? format(date, "MMM d") : "",
        },
      ];
    });
}
