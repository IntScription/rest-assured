import { supabase } from "@/src/lib/supabase";
import type { SkillDbStatus } from "@/src/features/skills/constants";

export async function updateSkillStatus(params: {
  userSkillId: string;
  status: SkillDbStatus;
}) {
  const { userSkillId, status } = params;

  const { error } = await supabase
    .from("user_skills")
    .update({ status })
    .eq("id", userSkillId);

  if (error) throw error;

  return status;
}
