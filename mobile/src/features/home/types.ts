import type { Dispatch, SetStateAction } from "react";
import type { useRouter } from "expo-router";
import type { useAppTheme } from "@/src/theme/theme";

export type Program = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean | null;
  created_at: string | null;
  schedule_anchor_date: string;
};

export type SplitLite = {
  id: string;
  name: string;
  focus: string | null;
  order_index: number;
};

export type ExerciseLite = {
  id: string;
  name: string;
  slug: string | null;
};

export type LatestLogLite = {
  id: string;
  exercise_id: string;
  weight: number | null;
  reps: number | null;
  sets: number | null;
  created_at: string | null;
  type: string | null;
  day: string | null;
  rpe?: number | null;
};

export type HomeCacheShape = {
  splits: SplitLite[];
  exercisesBySplit: Record<string, ExerciseLite[]>;
  latestLogsByExercise: Record<string, LatestLogLite | null>;
  logHistoryByExercise?: Record<string, LatestLogLite[]>;
};

export type AppTheme = ReturnType<typeof useAppTheme>;

export type ExerciseRowProps = {
  item: ExerciseLite;
  index: number;
  stackSize: number;
  latestLog: LatestLogLite | null;
  currentSplit: SplitLite | null;
  uid: string;
  t: AppTheme;
  router: ReturnType<typeof useRouter>;
  editingId: string | null;
  setEditingId: Dispatch<SetStateAction<string | null>>;
  editValue: string;
  setEditValue: Dispatch<SetStateAction<string>>;
  setExercisesBySplit: Dispatch<SetStateAction<Record<string, ExerciseLite[]>>>;
};

export type SplitPageProps = {
  item: SplitLite;
  index: number;
  listIndex: number;
  t: AppTheme;
  currentIndex: number;
  splits: SplitLite[];
  currentSplit: SplitLite | null;
  activeSplitId: string | null;
  completedSplits: string[];
  toggleComplete: (splitId: string | null) => Promise<void>;
  tourActive: boolean;
  tourStep: string;
  resolvedTutorialProgramId?: string;
  router: ReturnType<typeof useRouter>;
  setTourStep: Dispatch<SetStateAction<string>>;
  exercises: ExerciseLite[];
  latestLogsByExercise: Record<string, LatestLogLite | null>;
  logHistoryByExercise?: Record<string, LatestLogLite[]>;
  uid: string;
  editingId: string | null;
  setEditingId: Dispatch<SetStateAction<string | null>>;
  editValue: string;
  setEditValue: Dispatch<SetStateAction<string>>;
  setExercisesBySplit: Dispatch<SetStateAction<Record<string, ExerciseLite[]>>>;
};

// ✅ FIX: Added all the missing props to ExerciseListProps so TypeScript stops complaining
export type ExerciseListProps = {
  exercises: ExerciseLite[];
  latestLogsByExercise: Record<string, LatestLogLite | null>;
  logHistoryByExercise?: Record<string, LatestLogLite[]>;
  currentSplit: SplitLite | null;
  uid: string;
  t: AppTheme;
  router: ReturnType<typeof useRouter>;
  editingId: string | null;
  setEditingId: Dispatch<SetStateAction<string | null>>;
  editValue: string;
  setEditValue: Dispatch<SetStateAction<string>>;
  setExercisesBySplit: Dispatch<SetStateAction<Record<string, ExerciseLite[]>>>;
};
