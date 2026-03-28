import type { SkillLog } from "@/src/features/skills/types";

export type SkillStreakSummary = {
  currentStreak: number;
  bestStreak: number;
};

function normalizeDate(dateString: string) {
  const d = new Date(dateString);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getSkillStreak(logs: SkillLog[]): SkillStreakSummary {
  if (logs.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: 0,
    };
  }

  const uniqueDays = Array.from(
    new Set(logs.map((log) => normalizeDate(log.logged_at)))
  ).sort((a, b) => b - a);

  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const latestDay = uniqueDays[0];
  if (latestDay === today.getTime() || latestDay === yesterday.getTime()) {
    currentStreak = 1;
    let prev = latestDay;

    for (let i = 1; i < uniqueDays.length; i += 1) {
      const expected = new Date(prev);
      expected.setDate(expected.getDate() - 1);

      if (uniqueDays[i] === expected.getTime()) {
        currentStreak += 1;
        prev = uniqueDays[i];
      } else {
        break;
      }
    }
  }

  let bestStreak = 1;
  let running = 1;

  for (let i = 1; i < uniqueDays.length; i += 1) {
    const prev = new Date(uniqueDays[i - 1]);
    prev.setDate(prev.getDate() - 1);

    if (uniqueDays[i] === prev.getTime()) {
      running += 1;
      bestStreak = Math.max(bestStreak, running);
    } else {
      running = 1;
    }
  }

  return {
    currentStreak,
    bestStreak,
  };
}
