import type { SkillDbStatus } from "@/src/features/skills/constants";

type SkillStatusListener = (payload: {
  userSkillId: string;
  status: SkillDbStatus;
}) => void;

const skillStatusMap = new Map<string, SkillDbStatus>();
const skillStatusListeners = new Set<SkillStatusListener>();

export function getSkillStatusSync(
  userSkillId: string
): SkillDbStatus | null {
  return skillStatusMap.get(userSkillId) ?? null;
}

export function publishSkillStatusSync(params: {
  userSkillId: string;
  status: SkillDbStatus;
}) {
  const { userSkillId, status } = params;

  skillStatusMap.set(userSkillId, status);

  for (const listener of skillStatusListeners) {
    listener({ userSkillId, status });
  }
}

export function subscribeSkillStatusSync(
  listener: SkillStatusListener
) {
  skillStatusListeners.add(listener);

  return () => {
    skillStatusListeners.delete(listener);
  };
}

export function clearSkillStatusSync(userSkillId: string) {
  skillStatusMap.delete(userSkillId);
}
