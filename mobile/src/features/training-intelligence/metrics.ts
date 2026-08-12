import type { TrainingLog } from "./types";

export function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getLogDate(log: Pick<TrainingLog, "log_date" | "created_at">) {
  if (log.log_date) return log.log_date;
  if (log.created_at) return log.created_at.slice(0, 10);
  return "";
}

export function calcVolume(log?: Partial<TrainingLog> | null) {
  if (!log) return 0;
  return Math.max(1, n(log.weight)) * n(log.reps) * n(log.sets);
}

export function formatCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `${Math.round(value)}`;
}

export function estimatedOneRepMax(weight: number, reps: number) {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}
