import {
  SKILL_STATUS,
  type SkillDbStatus,
} from "@/src/features/skills/constants";
import type { UserSkillStatus } from "@/src/features/skills/types";

export function normalizeSkillStatus(
  status: UserSkillStatus | SkillDbStatus | null | undefined
): SkillDbStatus {
  if (status === SKILL_STATUS.ACTIVE || status === SKILL_STATUS.PAUSED) {
    return status;
  }

  return SKILL_STATUS.MASTERED;
}
