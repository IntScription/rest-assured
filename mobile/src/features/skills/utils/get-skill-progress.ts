import type { SkillLog, SkillMetricType, SkillStage } from "@/src/features/skills/types";

type Args = {
  metricType: SkillMetricType;
  currentStage: SkillStage | null;
  bestLog: SkillLog | null;
};

export function getSkillProgress({ metricType, currentStage, bestLog }: Args) {
  if (!currentStage) return 0;

  if (metricType === "milestone") {
    return bestLog ? 100 : 0;
  }

  const target = currentStage.target_value ?? 0;
  const best = bestLog?.value ?? 0;

  if (target <= 0) return 0;

  return Math.max(0, Math.min(100, (best / target) * 100));
}
