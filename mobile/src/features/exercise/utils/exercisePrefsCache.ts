import type { ExercisePrefs } from "../types";

/**
 * In-memory, same-session cache of exercise prefs (default tag, rest
 * duration, trend view/metric, weight jump). AsyncStorage is the real
 * source of truth across app restarts, but it's inherently async — reading
 * it after mount means the screen briefly renders with hardcoded defaults
 * before flipping to the user's actual saved prefs. This lets the initial
 * render seed straight from whatever was already loaded/saved earlier in
 * this session, matching exerciseRouteCache's approach for exercise/logs.
 */
const prefsByExerciseId = new Map<string, ExercisePrefs>();

export function setExercisePrefsPreview(exerciseId: string | undefined | null, prefs: ExercisePrefs) {
  if (!exerciseId) return;
  prefsByExerciseId.set(exerciseId, prefs);
}

export function getExercisePrefsPreview(exerciseId: string | undefined | null): ExercisePrefs | null {
  if (!exerciseId) return null;
  return prefsByExerciseId.get(exerciseId) ?? null;
}
