import type { LatestLogLite } from "../types";

export function formatWeight(weight: number | string | null | undefined) {
  const num = Number(weight ?? 0);

  if (!Number.isFinite(num) || num <= 0) return null;
  if (Number.isInteger(num)) return `${num} kg`;

  return `${num.toFixed(1)} kg`;
}

export function formatLatestLog(log: LatestLogLite | null | undefined) {
  if (!log) return "No logs yet";

  const weightText = formatWeight(log.weight as number | string | null | undefined);
  const repsText = `${log.reps} ${log.reps === 1 ? "rep" : "reps"}`;
  const setsText = `${log.sets} ${log.sets === 1 ? "set" : "sets"}`;

  if (weightText) return `Last: ${weightText} · ${repsText} · ${setsText}`;

  return `Last: ${repsText} · ${setsText}`;
}
