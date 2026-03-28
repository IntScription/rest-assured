import type { SkillLog, SkillMetricType, SkillStage } from "@/src/features/skills/types";

type Args = {
  metricType: SkillMetricType;
  latestLog: SkillLog | null;
  bestLog: SkillLog | null;
  currentStage: SkillStage | null;
};

export function getSkillHighlight({
  metricType,
  latestLog,
  bestLog,
  currentStage,
}: Args) {
  if (metricType === "seconds") {
    if (bestLog?.value != null) return `Best hold: ${bestLog.value}${bestLog.unit ?? "s"}`;
    return `Target: ${currentStage?.target_value ?? 0}${currentStage?.unit ?? "s"}`;
  }

  if (metricType === "reps") {
    if (bestLog?.value != null) return `Best set: ${bestLog.value} reps`;
    return `Target: ${currentStage?.target_value ?? 0} reps`;
  }

  if (metricType === "attempts") {
    if (latestLog?.attempts != null) return `Last practice: ${latestLog.attempts} attempts`;
    return "Track your next attempts";
  }

  if (metricType === "milestone") {
    if (currentStage?.name) return `Current milestone: ${currentStage.name}`;
    return "Start your first milestone";
  }

  return "Keep progressing";
}
