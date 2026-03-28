export const STORAGE_KEYS = {
  PROFILE: "ra/cache/profile",
  PROGRAMS: "ra/cache/programs",
  ACTIVE_PROGRAM_ID: "ra/cache/activeProgramId",
  SPLITS_BY_PROGRAM: "ra/cache/splitsByProgram",
  EXERCISES_BY_SPLIT: "ra/cache/exercisesBySplit",
  LOGS_BY_EXERCISE: "ra/cache/logsByExercise",
  WORKOUT_SESSIONS: "ra/cache/workoutSessions",

  PENDING_ACTIONS: "ra/sync/pendingActions",
  SYNC_META: "ra/sync/meta",
} as const;
