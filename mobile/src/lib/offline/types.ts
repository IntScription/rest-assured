export type CachedProfile = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  current_program_id?: string | null;
  current_split_order?: number | null;
  updated_at?: string | null;
  pending_sync?: boolean;
};

export type CachedProgram = {
  id: string;
  user_id: string;
  name: string;
  is_active?: boolean | null;
  created_at?: string | null;
  pending_sync?: boolean;
  deleted_local?: boolean;
};

export type CachedSplit = {
  id: string;
  user_id?: string | null;
  program_id: string;
  name: string;
  focus?: string | null;
  order_index: number;
  created_at?: string | null;
  pending_sync?: boolean;
  deleted_local?: boolean;
};

export type CachedExercise = {
  id: string;
  user_id: string;
  split_id: string;
  name: string;
  slug?: string | null;
  created_at?: string | null;
  pending_sync?: boolean;
  deleted_local?: boolean;
};

export type CachedLog = {
  id: string;
  user_id: string;
  exercise_id: string;
  weight?: number | null;
  reps: number;
  sets: number;
  volume?: number | null;
  day?: string | null;
  type?: string | null;
  rpe?: number | null;
  created_at?: string | null;
  log_date?: string | null;
  pending_sync?: boolean;
  deleted_local?: boolean;
};

export type CachedTutLog = {
  id: string;
  user_id: string;
  exercise_id: string;
  tut_seconds: number;
  load_kg?: number | null;
  sets: number;
  reps: number;
  rpe?: number | null;
  rest_seconds?: number | null;
  note?: string | null;
  performed_on: string;
  pending_sync?: boolean;
  deleted_local?: boolean;
};

export type CachedWorkoutSession = {
  id: string;
  user_id: string;
  split_id?: string | null;
  program_id?: string | null;
  cycle_id?: string | null;
  workout_date: string;
  completed_at?: string | null;
  pending_sync?: boolean;
  deleted_local?: boolean;
};

export type SplitsByProgramCache = Record<string, CachedSplit[]>;
export type ExercisesBySplitCache = Record<string, CachedExercise[]>;
export type LogsByExerciseCache = Record<string, CachedLog[]>;

export type PendingAction =
  | {
    id: string;
    type: "profile.setCurrentProgram";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: {
      user_id: string;
      current_program_id: string | null;
    };
  }
  | {
    id: string;
    type: "program.create";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: CachedProgram;
  }
  | {
    id: string;
    type: "program.update";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: {
      id: string;
      updates: Partial<CachedProgram>;
    };
  }
  | {
    id: string;
    type: "program.delete";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: {
      id: string;
    };
  }
  | {
    id: string;
    type: "split.create";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: CachedSplit;
  }
  | {
    id: string;
    type: "split.update";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: {
      id: string;
      updates: Partial<CachedSplit>;
    };
  }
  | {
    id: string;
    type: "split.delete";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: {
      id: string;
    };
  }
  | {
    id: string;
    type: "split.reorder";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: {
      program_id: string;
      items: { id: string; order_index: number }[];
    };
  }
  | {
    id: string;
    type: "exercise.create";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: CachedExercise;
  }
  | {
    id: string;
    type: "exercise.update";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: {
      id: string;
      updates: Partial<CachedExercise>;
    };
  }
  | {
    id: string;
    type: "exercise.delete";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: {
      id: string;
    };
  }
  | {
    id: string;
    type: "log.create";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: CachedLog;
  }
  | {
    id: string;
    type: "log.update";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: {
      id: string;
      updates: Partial<CachedLog>;
    };
  }
  | {
    id: string;
    type: "log.delete";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: {
      id: string;
    };
  }
  | {
    id: string;
    type: "workoutSession.create";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: CachedWorkoutSession;
  }
  | {
    id: string;
    type: "tutLog.create";
    createdAt: string;
    retries: number;
    status: "pending" | "failed" | "syncing";
    payload: CachedTutLog;
  };

export type SyncMeta = {
  isSyncing: boolean;
  lastSyncStartedAt: string | null;
  lastSyncCompletedAt: string | null;
  lastSyncError: string | null;
};
