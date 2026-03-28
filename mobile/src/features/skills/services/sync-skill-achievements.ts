import { supabase } from "@/src/lib/supabase";

export type AchievementDefinition = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  requirement_type: string;
  requirement_value: number | null;
  is_active: boolean;
};

type UserAchievementRow = {
  achievement_id: string;
  unlocked_at: string;
};

type ProgressCounters = {
  skill_logs: number;
  skill_milestones: number;
  active_skills: number;
};

async function getProgressCounters(userId: string): Promise<ProgressCounters> {
  const [logsRes, milestonesRes, activeSkillsRes] = await Promise.all([
    supabase
      .from("skill_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("user_skill_milestones")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("user_skills")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  if (logsRes.error) throw logsRes.error;
  if (milestonesRes.error) throw milestonesRes.error;
  if (activeSkillsRes.error) throw activeSkillsRes.error;

  return {
    skill_logs: logsRes.count ?? 0,
    skill_milestones: milestonesRes.count ?? 0,
    active_skills: activeSkillsRes.count ?? 0,
  };
}

function getCurrentValue(
  counters: ProgressCounters,
  requirementType: string
): number {
  if (requirementType === "skill_logs") return counters.skill_logs;
  if (requirementType === "skill_milestones") return counters.skill_milestones;
  if (requirementType === "active_skills") return counters.active_skills;
  return 0;
}

export async function getSkillAchievementProgressForUser(userId: string) {
  const [defsRes, ownedRes, counters] = await Promise.all([
    supabase
      .from("achievement_definitions")
      .select("*")
      .eq("is_active", true),
    supabase
      .from("user_achievements")
      .select("achievement_id, unlocked_at")
      .eq("user_id", userId),
    getProgressCounters(userId),
  ]);

  if (defsRes.error) throw defsRes.error;
  if (ownedRes.error) throw ownedRes.error;

  const defs = (defsRes.data ?? []) as AchievementDefinition[];
  const ownedRows = (ownedRes.data ?? []) as UserAchievementRow[];
  const ownedMap = new Map(
    ownedRows.map((row) => [row.achievement_id, row.unlocked_at])
  );

  return defs.map((definition) => {
    const currentValue = getCurrentValue(counters, definition.requirement_type);
    const targetValue = Number(definition.requirement_value ?? 0);
    const unlockedAt = ownedMap.get(definition.id) ?? null;

    return {
      definition,
      unlocked: Boolean(unlockedAt),
      unlockedAt,
      currentValue,
      targetValue,
      progressPercent:
        targetValue > 0
          ? Math.max(0, Math.min(100, (currentValue / targetValue) * 100))
          : 0,
    };
  });
}

export async function syncSkillAchievementsForUser(userId: string) {
  const progressRows = await getSkillAchievementProgressForUser(userId);

  for (const row of progressRows) {
    if (row.unlocked) continue;
    if (row.currentValue < row.targetValue) continue;

    const { error } = await supabase.from("user_achievements").insert({
      user_id: userId,
      achievement_id: row.definition.id,
    });

    if (error) throw error;
  }
}

export async function syncSkillAchievementsForUserWithResult(userId: string) {
  const before = await getSkillAchievementProgressForUser(userId);

  await syncSkillAchievementsForUser(userId);

  const after = await getSkillAchievementProgressForUser(userId);

  const newlyUnlocked = after.filter((row) => {
    const beforeRow = before.find((b) => b.definition.id === row.definition.id);
    return !beforeRow?.unlocked && row.unlocked;
  });

  return newlyUnlocked;
}
