import { supabase } from "@/src/lib/supabase";

type ChallengeDefinition = {
  id: string;
  challenge_type: string;
  target_value: number;
  duration_type: string;
};

type UserChallenge = {
  id: string;
  challenge_id: string;
  progress_value: number;
  status: "active" | "completed" | "expired";
  starts_at: string;
  ends_at: string;
  completed_at: string | null;
};

function isNowWithinRange(startsAt: string, endsAt: string) {
  const now = Date.now();
  return now >= new Date(startsAt).getTime() && now <= new Date(endsAt).getTime();
}

function getStartOfTodayISOString() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function getStartOfWeekISOString() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function getStartOfMonthISOString() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function getPeriodStart(durationType: string) {
  if (durationType === "daily") return getStartOfTodayISOString();
  if (durationType === "weekly") return getStartOfWeekISOString();
  return getStartOfMonthISOString();
}

async function computeProgressForChallenge(params: {
  userId: string;
  challengeType: string;
  durationType: string;
}) {
  const { userId, challengeType, durationType } = params;
  const startDate = getPeriodStart(durationType);

  if (challengeType === "skill_logs" || challengeType === "skill_sessions") {
    const { count, error } = await supabase
      .from("skill_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("logged_at", startDate);

    if (error) throw error;
    return count ?? 0;
  }

  if (challengeType === "active_skills") {
    const { count, error } = await supabase
      .from("user_skills")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active");

    if (error) throw error;
    return count ?? 0;
  }

  return 0;
}

export async function syncSkillChallengesForUser(userId: string) {
  const [defsRes, userChallengesRes] = await Promise.all([
    supabase.from("challenge_definitions").select("*").eq("is_active", true),
    supabase.from("user_challenges").select("*").eq("user_id", userId),
  ]);

  if (defsRes.error) throw defsRes.error;
  if (userChallengesRes.error) throw userChallengesRes.error;

  const defs = (defsRes.data ?? []) as ChallengeDefinition[];
  const userChallenges = (userChallengesRes.data ?? []) as UserChallenge[];

  for (const userChallenge of userChallenges) {
    if (!isNowWithinRange(userChallenge.starts_at, userChallenge.ends_at)) continue;

    const definition = defs.find((d) => d.id === userChallenge.challenge_id);
    if (!definition) continue;

    const progressValue = await computeProgressForChallenge({
      userId,
      challengeType: definition.challenge_type,
      durationType: definition.duration_type,
    });

    const nextStatus =
      progressValue >= Number(definition.target_value) ? "completed" : "active";

    const payload: {
      progress_value: number;
      status: "active" | "completed";
      completed_at?: string;
    } = {
      progress_value: progressValue,
      status: nextStatus,
    };

    if (nextStatus === "completed" && !userChallenge.completed_at) {
      payload.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("user_challenges")
      .update(payload)
      .eq("id", userChallenge.id);

    if (error) throw error;
  }
}
