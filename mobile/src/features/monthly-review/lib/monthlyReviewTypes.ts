import type { MonthlyTrainingStats } from "@/src/features/training-intelligence/types";

export type MonthlyAiFeedback = {
  headline: string;
  positives: string[];
  warnings: string[];
  nextMonthFocus: string[];
  deloadSuggestion: string | null;
  coachNote: string;
};

export type MonthlyReviewPayload = {
  stats: MonthlyTrainingStats;
  aiFeedback?: MonthlyAiFeedback | null;
};
