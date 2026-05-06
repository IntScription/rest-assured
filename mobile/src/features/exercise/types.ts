import type { Ionicons } from "@expo/vector-icons";

export type ExerciseRow = {
  id: string;
  name: string;
  slug: string | null;
  split_id?: string | null;
};

export type SplitRowLite = {
  id: string;
  name: string;
};

export type TutPreviewRow = {
  id: string;
  tut_seconds: number;
  performed_on: string;
};

export type LogTag = "working" | "warmup" | "topset";
export type LogFilter = "all" | "working" | "warmup" | "topset";
export type TrendMetric = "volume" | "weight" | "reps";
export type TrendView = "graph" | "list";

export type LogRow = {
  id: string;
  user_id: string;
  exercise_id: string;
  weight: number | null;
  reps: number;
  sets: number;
  volume: number | null;
  created_at: string | null;
  day?: string | null;
  type?: string | null;
  pending?: boolean;
  local_temp_id?: string;
};

export type ExerciseCacheShape = {
  exercise: ExerciseRow | null;
  logs: LogRow[];
  splitName?: string | null;
};

export type PendingLogPayload = {
  local_temp_id: string;
  weight: number;
  reps: number;
  sets: number;
  volume: number;
  day: string | null;
  type: LogTag;
  created_at: string;
};

export type ExercisePrefs = {
  defaultTag: LogTag;
  restDuration: number;
  trendMetric: TrendMetric;
  trendView: TrendView;
  weightJump: number;
};

export type SessionSummary = {
  logs: number;
  volume: number;
  heaviest: number;
  bestSet: string;
};

export type PrFlags = {
  heaviest: boolean;
  volume: boolean;
  reps: boolean;
};

export type CurrentPrOwners = {
  heaviestId: string | null;
  volumeId: string | null;
  repsId: string | null;
};

export type CompareInsightTone = "up" | "same" | "down" | "neutral";

export type CompareInsight = {
  tone: CompareInsightTone;
  title: string;
  details: string[];
};

export type RecordShortcut = {
  key: string;
  label: string;
  value: string;
  logId: string | null;
  accent: string;
};

export type SuggestionAction = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  apply: () => void;
};

export type LogMarkers = {
  isCurrentHeaviest: boolean;
  isCurrentVolume: boolean;
  isCurrentRep: boolean;
  isPreviousHeaviest: boolean;
  isPreviousVolume: boolean;
  isPreviousRep: boolean;
  isTodayHeaviest: boolean;
  isTodayVolume: boolean;
  isSessionBest: boolean;
  hasAnyPr: boolean;
};

export type ThemeLike = {
  background?: string;
  card: string;
  cardAlt: string;
  text: string;
  mutedText: string;
  border: string;
  inputBg?: string;
  inputBorder?: string;
  link: string;
  danger?: string;
  success?: string;
  primaryBg?: string;
  primaryText?: string;
  secondaryBg?: string;
  secondaryText?: string;
};
