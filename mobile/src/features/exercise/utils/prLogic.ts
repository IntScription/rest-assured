import { isToday } from "date-fns";
import { PR_COLORS } from "../constants";
import type { CurrentPrOwners, LogRow, PrFlags, RecordShortcut } from "../types";
import { formatCompactWeight, getLogTag } from "./formatters";

export function getLogAchievement(
  nextLog: Pick<LogRow, "weight" | "reps" | "sets" | "volume" | "type">,
  previousLogs: LogRow[]
) {
  const tag = getLogTag(nextLog);
  const weight = Number(nextLog.weight ?? 0);
  const reps = Number(nextLog.reps ?? 0);
  const volume = Number(nextLog.volume ?? 0);

  const workingLogs = previousLogs.filter((log) => getLogTag(log) !== "warmup");
  const sameCategoryLogs =
    tag === "warmup" ? previousLogs.filter((log) => getLogTag(log) === "warmup") : workingLogs;

  const heaviest = Math.max(0, ...sameCategoryLogs.map((log) => Number(log.weight ?? 0)));
  const bestVolume = Math.max(0, ...sameCategoryLogs.map((log) => Number(log.volume ?? 0)));
  const bestBodyweightReps = Math.max(
    0,
    ...sameCategoryLogs.filter((log) => Number(log.weight ?? 0) <= 0).map((log) => Number(log.reps ?? 0))
  );

  if (weight > heaviest) return "New heaviest PR";
  if (volume > bestVolume) return "New volume PR";
  if (weight <= 0 && reps > bestBodyweightReps) return "New bodyweight rep PR";
  if (previousLogs.length === 0) return "First log saved";
  if (tag === "topset") return "Top set logged";
  return "Log saved";
}

export function getPrFlags(logs: LogRow[]) {
  const flags: Record<string, PrFlags> = {};
  let heaviest = 0;
  let bestVolume = 0;
  let bestBodyweightReps = 0;

  [...logs].reverse().forEach((log) => {
    const weight = Number(log.weight ?? 0);
    const volume = Number(log.volume ?? 0);
    const reps = Number(log.reps ?? 0);

    const current: PrFlags = {
      heaviest: false,
      volume: false,
      reps: false,
    };

    if (weight > heaviest) {
      current.heaviest = true;
      heaviest = weight;
    }
    if (volume > bestVolume) {
      current.volume = true;
      bestVolume = volume;
    }
    if (weight <= 0 && reps > bestBodyweightReps) {
      current.reps = true;
      bestBodyweightReps = reps;
    }

    flags[log.id] = current;
  });

  return flags;
}

export function getCurrentPrOwners(logs: LogRow[]): CurrentPrOwners {
  let heaviestId: string | null = null;
  let volumeId: string | null = null;
  let repsId: string | null = null;
  let heaviest = -1;
  let bestVolume = -1;
  let bestBodyweightReps = -1;

  for (const log of logs) {
    const weight = Number(log.weight ?? 0);
    const volume = Number(log.volume ?? 0);
    const reps = Number(log.reps ?? 0);

    if (weight > heaviest) {
      heaviest = weight;
      heaviestId = log.id;
    }
    if (volume > bestVolume) {
      bestVolume = volume;
      volumeId = log.id;
    }
    if (weight <= 0 && reps > bestBodyweightReps) {
      bestBodyweightReps = reps;
      repsId = log.id;
    }
  }

  return { heaviestId, volumeId, repsId };
}

export function getTodayLogIds(logs: LogRow[]) {
  return logs.filter((log) => {
    if (!log.created_at) return false;
    const d = new Date(log.created_at);
    return !Number.isNaN(d.getTime()) && isToday(d);
  });
}

export function getPrBoardItems(
  logs: LogRow[],
  currentPrOwners: CurrentPrOwners,
  dashboardMetrics: { bestVolumeLog: LogRow | null; bodyweightRepPR: number },
  lastLog: LogRow | null
): RecordShortcut[] {
  const bestVolumeLabel = dashboardMetrics.bestVolumeLog
    ? `${formatCompactWeight(dashboardMetrics.bestVolumeLog.weight)} × ${dashboardMetrics.bestVolumeLog.reps} × ${dashboardMetrics.bestVolumeLog.sets}`
    : "—";
  const lastLoggedLabel = lastLog
    ? `${formatCompactWeight(lastLog.weight)} × ${lastLog.reps} × ${lastLog.sets}`
    : "—";

  return [
    {
      key: "heaviest",
      label: "Heaviest PR",
      value:
        currentPrOwners.heaviestId && logs.find((log) => log.id === currentPrOwners.heaviestId)
          ? (() => {
            const found = logs.find((log) => log.id === currentPrOwners.heaviestId)!;
            return `${formatCompactWeight(found.weight)} × ${found.reps}`;
          })()
          : "—",
      logId: currentPrOwners.heaviestId,
      accent: PR_COLORS.heaviest,
    },
    {
      key: "volume",
      label: "Volume PR",
      value: bestVolumeLabel,
      logId: dashboardMetrics.bestVolumeLog?.id ?? null,
      accent: PR_COLORS.volume,
    },
    {
      key: "bw",
      label: "BW Rep PR",
      value: dashboardMetrics.bodyweightRepPR > 0 ? `${dashboardMetrics.bodyweightRepPR} reps` : "—",
      logId: currentPrOwners.repsId,
      accent: PR_COLORS.reps,
    },
    {
      key: "last",
      label: "Last Logged",
      value: lastLoggedLabel,
      logId: lastLog?.id ?? null,
      accent: PR_COLORS.recent,
    },
  ];
}
