import type { ExerciseLite, LatestLogLite } from "../types";
import type { ExerciseProgressInfo } from "./exerciseProgress";

export type ExerciseRoutePreview = {
  exercise: ExerciseLite;
  latestLog: LatestLogLite | null;
  progressInfo?: ExerciseProgressInfo;
  cachedAt: number;
};

const previews = new Map<string, ExerciseRoutePreview>();

export function setExerciseRoutePreview(preview: Omit<ExerciseRoutePreview, "cachedAt">) {
  if (!preview.exercise.slug) return;

  previews.set(preview.exercise.slug, {
    ...preview,
    cachedAt: Date.now(),
  });
}

export function getExerciseRoutePreview(slug: string | string[] | undefined) {
  const key = Array.isArray(slug) ? slug[0] : slug;
  if (!key) return null;

  const preview = previews.get(key);
  if (!preview) return null;

  if (Date.now() - preview.cachedAt > 1000 * 60 * 5) {
    previews.delete(key);
    return null;
  }

  return preview;
}

export function clearExerciseRoutePreview(slug: string | string[] | undefined) {
  const key = Array.isArray(slug) ? slug[0] : slug;
  if (!key) return;
  previews.delete(key);
}
