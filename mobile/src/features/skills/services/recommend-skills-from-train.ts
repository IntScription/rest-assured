import { supabase } from "@/src/lib/supabase";
import type { Skill } from "@/src/features/skills/types";

const KEYWORD_MAP: { skillName: string; keywords: string[] }[] = [
  { skillName: "Handstand", keywords: ["pike", "handstand", "wall walk", "overhead"] },
  { skillName: "L-Sit", keywords: ["l-sit", "dip", "support hold", "core"] },
  { skillName: "Front Lever", keywords: ["row", "pull up", "pull-up", "lat", "lever"] },
  { skillName: "Planche", keywords: ["planche", "lean", "pseudo planche", "push up"] },
  { skillName: "Dragon Flag", keywords: ["dragon flag", "hollow", "core", "abs"] },
  { skillName: "Pike Push-Up", keywords: ["pike", "shoulder press", "overhead", "push up"] },
];

export async function getRecommendedSkillsFromTrain(userId: string) {
  const [skillsRes, activeProgramRes] = await Promise.all([
    supabase.from("skills").select("*").eq("is_active", true),
    supabase
      .from("programs")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (skillsRes.error) throw skillsRes.error;
  if (activeProgramRes.error) throw activeProgramRes.error;

  const skills = (skillsRes.data ?? []) as Skill[];
  const activeProgram = activeProgramRes.data;

  if (!activeProgram) return [];

  const { data: splits, error: splitsError } = await supabase
    .from("splits")
    .select("id")
    .eq("program_id", activeProgram.id);

  if (splitsError) throw splitsError;

  const splitIds = (splits ?? []).map((row) => row.id);
  if (splitIds.length === 0) return [];

  const { data: exercises, error: exercisesError } = await supabase
    .from("exercises")
    .select("name")
    .in("split_id", splitIds);

  if (exercisesError) throw exercisesError;

  const names = ((exercises ?? []) as { name: string }[]).map((row) =>
    row.name.toLowerCase()
  );

  const matchedSkillNames = new Set<string>();

  for (const mapping of KEYWORD_MAP) {
    const matched = mapping.keywords.some((keyword) =>
      names.some((name) => name.includes(keyword))
    );
    if (matched) matchedSkillNames.add(mapping.skillName.toLowerCase());
  }

  return skills.filter((skill) => matchedSkillNames.has(skill.name.toLowerCase()));
}
