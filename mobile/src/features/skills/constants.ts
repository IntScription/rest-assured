export const SKILL_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  MASTERED: "archived",
} as const;

export type SkillDbStatus =
  (typeof SKILL_STATUS)[keyof typeof SKILL_STATUS];

export function getSkillStatusLabel(status: string) {
  if (status === SKILL_STATUS.MASTERED) return "Mastered";
  if (status === SKILL_STATUS.ACTIVE) return "Active";
  if (status === SKILL_STATUS.PAUSED) return "Paused";
  return status;
}
