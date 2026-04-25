type RecoveryLite = {
  sleep_hours?: number | null;
  energy_level?: number | null;
  soreness_level?: number | null;
  stress_level?: number | null;
  motivation_level?: number | null;
};

type LogLite = {
  exercise_name?: string;
  weight: number | null;
  reps: number;
  sets: number;
};

export function getRecoveryStatus(recovery: RecoveryLite | null) {
  if (!recovery) {
    return {
      label: "Unknown",
      score: 60,
      notes: ["No recent recovery check-in."],
    };
  }

  let score = 70;
  const notes: string[] = [];

  if ((recovery.sleep_hours ?? 0) >= 8) {
    score += 8;
    notes.push("Sleep is strong.");
  } else if ((recovery.sleep_hours ?? 0) < 6.5) {
    score -= 12;
    notes.push("Sleep is low.");
  }

  if ((recovery.energy_level ?? 3) <= 2) {
    score -= 8;
    notes.push("Energy feels low.");
  }

  if ((recovery.soreness_level ?? 1) >= 4) {
    score -= 10;
    notes.push("Soreness is elevated.");
  }

  if ((recovery.stress_level ?? 1) >= 4) {
    score -= 8;
    notes.push("Stress is elevated.");
  }

  if ((recovery.motivation_level ?? 3) >= 4) {
    score += 4;
    notes.push("Motivation is good.");
  }

  const label =
    score >= 78 ? "Ready" :
      score >= 60 ? "Moderate" :
        "Recover";

  return { label, score, notes };
}

export function getProgressionSuggestion(logs: LogLite[]) {
  const latest = logs[0];
  if (!latest) {
    return {
      action: "collect_data",
      summary: "Log more sessions so Coach can suggest progression.",
    };
  }

  if (typeof latest.weight === "number" && latest.weight > 0) {
    if (latest.reps >= 8) {
      return {
        action: "increase_load",
        summary: `Try a small load increase next time for ${latest.exercise_name ?? "your main lift"}.`,
      };
    }

    if (latest.reps <= 4) {
      return {
        action: "hold_load",
        summary: `Keep the same weight and try to add reps before increasing load.`,
      };
    }
  }

  return {
    action: "small_progress",
    summary: `Aim for one more rep or cleaner execution on your next session.`,
  };
}

export function getFatigueAdjustment(recovery: RecoveryLite | null, logs: LogLite[]) {
  const status = getRecoveryStatus(recovery);

  if (status.label === "Recover") {
    return {
      mode: "reduced",
      summary: "Reduce accessory volume and keep effort controlled today.",
    };
  }

  if (status.label === "Moderate") {
    return {
      mode: "controlled",
      summary: "Train normally, but avoid adding extra junk volume.",
    };
  }

  const latest = logs[0];
  if (latest && latest.reps >= 8) {
    return {
      mode: "progress",
      summary: "Recovery looks good enough to try a modest progression.",
    };
  }

  return {
    mode: "normal",
    summary: "Train as planned and focus on quality reps.",
  };
}
