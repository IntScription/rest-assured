import { format } from "date-fns";
import type { LatestLogLite } from "../types";

export type SmartRepeatSuggestion = {
  weight: number | string | null;
  reps: number;
  sets: number;
  type: LatestLogLite["type"];
  day: LatestLogLite["day"];
  note: string;
  isSuggestedProgression: boolean;
};

function toNumber(value: number | string | null | undefined) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function sortNewestFirst(logs: LatestLogLite[]) {
  return [...logs].sort((a, b) => {
    const byDate = String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
    if (byDate !== 0) return byDate;
    return String(b.id ?? "").localeCompare(String(a.id ?? ""));
  });
}

export function getSmartRepeatSuggestion(
  latestLog: LatestLogLite | null | undefined,
  history: LatestLogLite[] | null | undefined
): SmartRepeatSuggestion | null {
  if (!latestLog) return null;

  const sorted = sortNewestFirst(history?.length ? history : [latestLog]);
  const latest = sorted.find((log) => log.id === latestLog.id) ?? sorted[0] ?? latestLog;
  const previous = sorted.find((log) => log.id !== latest.id) ?? null;

  const latestWeight = toNumber(latest.weight);
  const latestReps = Math.max(1, Math.round(toNumber(latest.reps)));
  const latestSets = Math.max(1, Math.round(toNumber(latest.sets)));

  if (!previous) {
    return {
      weight: latest.weight,
      reps: latestReps,
      sets: latestSets,
      type: latest.type,
      day: latest.day,
      note: "Repeat last log",
      isSuggestedProgression: false,
    };
  }

  const previousWeight = toNumber(previous.weight);
  const previousReps = toNumber(previous.reps);

  const weightWentUp = latestWeight > previousWeight;
  const repsWentUp = latestReps > previousReps;
  const sameLoadOrBodyweight = latestWeight === previousWeight;

  if (weightWentUp || (sameLoadOrBodyweight && repsWentUp)) {
    return {
      weight: latest.weight,
      reps: latestReps + 1,
      sets: latestSets,
      type: latest.type,
      day: latest.day,
      note: "+1 rep suggested",
      isSuggestedProgression: true,
    };
  }

  return {
    weight: latest.weight,
    reps: latestReps,
    sets: latestSets,
    type: latest.type,
    day: latest.day,
    note: "Repeat last log",
    isSuggestedProgression: false,
  };
}

export function formatRepeatPreview(suggestion: SmartRepeatSuggestion | null) {
  if (!suggestion) return "No previous log";

  const weight = toNumber(suggestion.weight);
  const weightText = weight > 0
    ? Number.isInteger(weight)
      ? `${weight}kg`
      : `${weight.toFixed(1)}kg`
    : "BW";

  return `${weightText} · ${suggestion.reps} reps · ${suggestion.sets} sets`;
}

export function getRepeatLogInsertPayload({
  userId,
  exerciseId,
  suggestion,
}: {
  userId: string;
  exerciseId: string;
  suggestion: SmartRepeatSuggestion;
}) {
  return {
    user_id: userId,
    exercise_id: exerciseId,
    weight: suggestion.weight,
    reps: suggestion.reps,
    sets: suggestion.sets,
    type: suggestion.type,
    day: suggestion.day ?? format(new Date(), "yyyy-MM-dd"),
  };
}
