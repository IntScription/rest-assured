import type { LatestLogLite } from "../types";

export type ExerciseProgressTone = "up" | "down" | "same" | "new" | "none" | "pending";

export type ExerciseSparkPoint = {
  id: string;
  value: number;
  isLatest: boolean;
};

export type ExerciseProgressInfo = {
  tone: ExerciseProgressTone;
  label: string;
  detail: string;
  isPr: boolean;
  prLabel: string | null;
  sparkline: ExerciseSparkPoint[];
  rpeSparkline: ExerciseSparkPoint[]; // ✅ Added RPE Sparkline array
  trendLabel: string;
};

function toNumber(value: number | string | null | undefined) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function volumeOf(log: LatestLogLite | null | undefined) {
  if (!log) return 0;
  const weight = toNumber(log.weight);
  const reps = toNumber(log.reps);
  const sets = toNumber(log.sets);
  return Math.max(weight, 1) * reps * sets;
}

function sortNewestFirst(logs: LatestLogLite[]) {
  return [...logs].sort((a, b) => {
    const byDate = String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
    if (byDate !== 0) return byDate;
    return String(b.id ?? "").localeCompare(String(a.id ?? ""));
  });
}

function getPrLabel(latest: LatestLogLite, logs: LatestLogLite[]) {
  if (logs.length === 0) return null;
  const latestWeight = toNumber(latest.weight);
  const latestReps = toNumber(latest.reps);
  const latestVolume = volumeOf(latest);
  const bestWeight = Math.max(0, ...logs.map((log) => toNumber(log.weight)));
  const bestVolume = Math.max(0, ...logs.map(volumeOf));
  const bestReps = Math.max(0, ...logs.map((log) => toNumber(log.reps)));
  if (latestWeight > 0 && latestWeight >= bestWeight && bestWeight > 0) return "Weight PR";
  if (latestReps >= bestReps && bestReps > 0) return "Rep PR";
  if (latestVolume >= bestVolume && bestVolume > 0) return "Volume PR";
  return null;
}

function buildSparkline(logs: LatestLogLite[]) {
  const latestFive = sortNewestFirst(logs).slice(0, 5).reverse();
  const values = latestFive.map(volumeOf);
  const max = Math.max(1, ...values);
  return latestFive.map((log, index) => ({
    id: log.id,
    value: Math.max(0.18, values[index] / max),
    isLatest: index === latestFive.length - 1,
  }));
}

// ✅ Added dedicated builder for RPE sparklines
function buildRpeSparkline(logs: LatestLogLite[]) {
  const latestRpeLogs = sortNewestFirst(logs)
    .filter((log) => log.rpe != null)
    .slice(0, 5)
    .reverse();

  return latestRpeLogs.map((log, index) => ({
    id: log.id,
    value: Math.max(0.18, (log.rpe ?? 0) / 10), // Assuming max RPE is 10
    isLatest: index === latestRpeLogs.length - 1,
  }));
}

function buildTrendLabel(logs: LatestLogLite[]) {
  const sorted = sortNewestFirst(logs);
  if (sorted.length < 2) return "";
  const last = volumeOf(sorted[0]);
  const prev = volumeOf(sorted[1]);
  const diff = Math.round(last - prev);
  if (diff > 0) return "Trending up";
  if (diff < 0) return "Needs recovery";
  return "Stable";
}

export function getPendingExerciseProgressInfo(latestLog: LatestLogLite | null | undefined): ExerciseProgressInfo {
  if (!latestLog) {
    return { tone: "none", label: "", detail: "", isPr: false, prLabel: null, sparkline: [], rpeSparkline: [], trendLabel: "" };
  }
  return { tone: "pending", label: "", detail: "", isPr: false, prLabel: null, sparkline: [], rpeSparkline: [], trendLabel: "" };
}

export function getExerciseProgressInfo(
  latestLog: LatestLogLite | null | undefined,
  history: LatestLogLite[] | null | undefined
): ExerciseProgressInfo {
  if (!latestLog) {
    return { tone: "none", label: "", detail: "", isPr: false, prLabel: null, sparkline: [], rpeSparkline: [], trendLabel: "" };
  }

  const sorted = sortNewestFirst(history?.length ? history : [latestLog]);
  const latest = sorted.find((log) => log.id === latestLog.id) ?? sorted[0] ?? latestLog;
  const previous = sorted.find((log) => log.id !== latest.id) ?? null;

  const prLabel = getPrLabel(latest, sorted);
  const sparkline = buildSparkline(sorted);
  const rpeSparkline = buildRpeSparkline(sorted); // ✅ Populated here
  const trendLabel = buildTrendLabel(sorted);

  if (!previous) {
    return { tone: "new", label: "First log", detail: "", isPr: Boolean(prLabel), prLabel, sparkline, rpeSparkline, trendLabel };
  }

  const volumeDiff = Math.round(volumeOf(latest) - volumeOf(previous));

  if (volumeDiff > 0) {
    return { tone: "up", label: `+${volumeDiff} volume`, detail: "", isPr: Boolean(prLabel), prLabel, sparkline, rpeSparkline, trendLabel };
  }
  if (volumeDiff < 0) {
    return { tone: "down", label: `${volumeDiff} volume`, detail: "", isPr: Boolean(prLabel), prLabel, sparkline, rpeSparkline, trendLabel };
  }

  return { tone: "same", label: "Matched last", detail: "", isPr: Boolean(prLabel), prLabel, sparkline, rpeSparkline, trendLabel };
}
