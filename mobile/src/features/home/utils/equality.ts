import type { ExerciseLite, LatestLogLite, SplitLite } from "../types";

export function sameSplit(
  a: SplitLite | null | undefined,
  b: SplitLite | null | undefined
) {
  return (
    a?.id === b?.id &&
    a?.name === b?.name &&
    a?.focus === b?.focus &&
    a?.order_index === b?.order_index
  );
}

export function sameSplitList(a: SplitLite[], b: SplitLite[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    if (!sameSplit(a[i], b[i])) return false;
  }

  return true;
}

export function sameExercise(
  a: ExerciseLite | null | undefined,
  b: ExerciseLite | null | undefined
) {
  return a?.id === b?.id && a?.name === b?.name && a?.slug === b?.slug;
}

export function sameExerciseList(a: ExerciseLite[], b: ExerciseLite[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    if (!sameExercise(a[i], b[i])) return false;
  }

  return true;
}

export function sameLatestLog(
  a: LatestLogLite | null | undefined,
  b: LatestLogLite | null | undefined
) {
  return (
    a?.id === b?.id &&
    a?.exercise_id === b?.exercise_id &&
    a?.weight === b?.weight &&
    a?.reps === b?.reps &&
    a?.sets === b?.sets &&
    a?.created_at === b?.created_at &&
    a?.type === b?.type &&
    a?.day === b?.day
  );
}

export function sameStringList(a: string[], b: string[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}
