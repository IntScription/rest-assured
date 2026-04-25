type ProgramDraftInput = {
  goal: string | null | undefined;
  trainingStyle: string | null | undefined;
  trainingDaysPerWeek: number | null | undefined;
  experienceLevel: string | null | undefined;
};

export type ProgramDraft = {
  name: string;
  splits: {
    name: string;
    focus: string;
    order_index: number;
  }[];
};

export function buildProgramDraft(input: ProgramDraftInput): ProgramDraft {
  const days = input.trainingDaysPerWeek ?? 4;
  const style = input.trainingStyle ?? "hybrid";
  const goal = input.goal ?? "general_fitness";

  if (days <= 3) {
    return {
      name: `${style} ${goal} 3-day`,
      splits: [
        { name: "Upper", focus: "Push + Pull", order_index: 0 },
        { name: "Lower", focus: "Legs + Core", order_index: 1 },
        { name: "Full Body", focus: "Strength + Skill", order_index: 2 },
      ],
    };
  }

  if (days === 4) {
    return {
      name: `${style} ${goal} 4-day`,
      splits: [
        { name: "Push A", focus: "Horizontal push + accessories", order_index: 0 },
        { name: "Pull A", focus: "Vertical pull + rows", order_index: 1 },
        { name: "Legs", focus: "Lower body + core", order_index: 2 },
        { name: "Push/Pull B", focus: "Variation + skill emphasis", order_index: 3 },
      ],
    };
  }

  return {
    name: `${style} ${goal} 5-day`,
    splits: [
      { name: "Push", focus: "Chest + shoulders + triceps", order_index: 0 },
      { name: "Pull", focus: "Back + biceps", order_index: 1 },
      { name: "Legs", focus: "Lower body", order_index: 2 },
      { name: "Upper Skill", focus: "Weighted calisthenics + skill", order_index: 3 },
      { name: "Accessories", focus: "Weak points + recovery work", order_index: 4 },
    ],
  };
}

export function buildAdjustmentSummary(input: {
  recentLogs: {
    exercise_name?: string;
    weight: number | null;
    reps: number;
    sets: number;
  }[];
  recovery: {
    sleep_hours?: number | null;
    soreness_level?: number | null;
    stress_level?: number | null;
  } | null;
}) {
  const latest = input.recentLogs[0];
  const sleep = input.recovery?.sleep_hours ?? null;
  const soreness = input.recovery?.soreness_level ?? null;
  const stress = input.recovery?.stress_level ?? null;

  let adjustment = "Keep current training structure.";
  let intensity = "normal";

  if ((sleep !== null && sleep < 6.5) || (soreness !== null && soreness >= 4)) {
    adjustment = "Reduce accessory volume and keep 1-2 reps in reserve.";
    intensity = "reduced";
  } else if (latest && typeof latest.weight === "number" && latest.weight > 0 && latest.reps >= 8) {
    adjustment = "Try a small load increase on your main lift next session.";
    intensity = "progress";
  } else if (stress !== null && stress >= 4) {
    adjustment = "Keep intensity moderate and prioritize clean technique.";
    intensity = "controlled";
  }

  return {
    adjustment,
    intensity,
    main_exercise: latest?.exercise_name ?? null,
  };
}
