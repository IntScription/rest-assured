import { STORAGE_KEYS } from "./storage-keys";
import { readJson, writeJson } from "./storage";
import type {
  CachedProfile,
  CachedProgram,
  CachedSplit,
  CachedExercise,
  CachedLog,
  CachedWorkoutSession,
  SplitsByProgramCache,
  ExercisesBySplitCache,
  LogsByExerciseCache,
} from "./types";

export async function getCachedProfile() {
  return readJson<CachedProfile | null>(STORAGE_KEYS.PROFILE, null);
}

export async function setCachedProfile(profile: CachedProfile | null) {
  await writeJson(STORAGE_KEYS.PROFILE, profile);
}

export async function getCachedPrograms() {
  return readJson<CachedProgram[]>(STORAGE_KEYS.PROGRAMS, []);
}

export async function setCachedPrograms(programs: CachedProgram[]) {
  await writeJson(STORAGE_KEYS.PROGRAMS, programs);
}

export async function getCachedActiveProgramId() {
  return readJson<string | null>(STORAGE_KEYS.ACTIVE_PROGRAM_ID, null);
}

export async function setCachedActiveProgramId(id: string | null) {
  await writeJson(STORAGE_KEYS.ACTIVE_PROGRAM_ID, id);
}

export async function getCachedSplitsByProgram() {
  return readJson<SplitsByProgramCache>(STORAGE_KEYS.SPLITS_BY_PROGRAM, {});
}

export async function setCachedSplitsByProgram(value: SplitsByProgramCache) {
  await writeJson(STORAGE_KEYS.SPLITS_BY_PROGRAM, value);
}

export async function upsertCachedSplit(programId: string, split: CachedSplit) {
  const all = await getCachedSplitsByProgram();
  const existing = all[programId] ?? [];
  const index = existing.findIndex((x) => x.id === split.id);

  const next =
    index >= 0
      ? existing.map((x) => (x.id === split.id ? split : x))
      : [...existing, split];

  all[programId] = next.sort((a, b) => a.order_index - b.order_index);
  await setCachedSplitsByProgram(all);
}

export async function getCachedExercisesBySplit() {
  return readJson<ExercisesBySplitCache>(STORAGE_KEYS.EXERCISES_BY_SPLIT, {});
}

export async function setCachedExercisesBySplit(value: ExercisesBySplitCache) {
  await writeJson(STORAGE_KEYS.EXERCISES_BY_SPLIT, value);
}

export async function upsertCachedExercise(splitId: string, exercise: CachedExercise) {
  const all = await getCachedExercisesBySplit();
  const existing = all[splitId] ?? [];
  const index = existing.findIndex((x) => x.id === exercise.id);

  all[splitId] =
    index >= 0
      ? existing.map((x) => (x.id === exercise.id ? exercise : x))
      : [...existing, exercise];

  await setCachedExercisesBySplit(all);
}

export async function getCachedLogsByExercise() {
  return readJson<LogsByExerciseCache>(STORAGE_KEYS.LOGS_BY_EXERCISE, {});
}

export async function setCachedLogsByExercise(value: LogsByExerciseCache) {
  await writeJson(STORAGE_KEYS.LOGS_BY_EXERCISE, value);
}

export async function appendCachedLog(exerciseId: string, log: CachedLog) {
  const all = await getCachedLogsByExercise();
  const existing = all[exerciseId] ?? [];
  all[exerciseId] = [log, ...existing];
  await setCachedLogsByExercise(all);
}

export async function getCachedWorkoutSessions() {
  return readJson<CachedWorkoutSession[]>(STORAGE_KEYS.WORKOUT_SESSIONS, []);
}

export async function setCachedWorkoutSessions(value: CachedWorkoutSession[]) {
  await writeJson(STORAGE_KEYS.WORKOUT_SESSIONS, value);
}
