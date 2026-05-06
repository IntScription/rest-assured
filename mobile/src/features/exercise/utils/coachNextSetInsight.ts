export type CoachInsightTone = "push" | "hold" | "caution" | "neutral";

export type CoachInsightInput = {
  currentWeight: number;
  currentReps: number;
  currentSets: number;
  lastWeight: number;
  lastReps: number;
  lastSets: number;
  bestWeight: number;
  bestReps: number;
  bestSets: number;
  lastVolume: number;
  bestVolume: number;
  currentVolume: number;
  restSecondsLeft: number;
  recentWorkingLogCount: number;
  daysSinceLastWorkingLog: number | null;
};

export type CoachNextSetInsight = {
  tone: CoachInsightTone;
  title: string;
  body: string;
  disclaimer: string;
};

function pctDiff(current: number, base: number) {
  if (!Number.isFinite(base) || base <= 0) return 0;
  return ((current - base) / base) * 100;
}

export function getCoachNextSetInsight(input: CoachInsightInput): CoachNextSetInsight {
  const {
    currentWeight,
    currentReps,
    currentSets,
    lastWeight,
    lastReps,
    bestVolume,
    currentVolume,
    restSecondsLeft,
    recentWorkingLogCount,
    daysSinceLastWorkingLog,
  } = input;

  const disclaimer =
    "Coach is only giving context from your logs. You decide the set based on form, fatigue, pain, and recovery.";

  if (!currentReps || !currentSets) {
    return {
      tone: "neutral",
      title: "Fill the set first",
      body: "Add reps and sets so Coach can compare this attempt with your recent working logs.",
      disclaimer,
    };
  }

  if (recentWorkingLogCount === 0) {
    return {
      tone: "neutral",
      title: "First useful data point",
      body: "Save a clean working set first. After a few sessions, Coach can give better trend-based insights.",
      disclaimer,
    };
  }

  if (restSecondsLeft > 0) {
    return {
      tone: "hold",
      title: "Let the rest timer finish",
      body: `You still have ${restSecondsLeft}s of rest. Rushing the next set may make the comparison less useful.`,
      disclaimer,
    };
  }

  if (daysSinceLastWorkingLog !== null && daysSinceLastWorkingLog >= 7) {
    return {
      tone: "caution",
      title: "Ease back in",
      body: `It has been ${daysSinceLastWorkingLog} days since your last working log here. Consider matching last time before pushing harder.`,
      disclaimer,
    };
  }

  const weightJumpPct = pctDiff(currentWeight, lastWeight);
  const volumeJumpPct = pctDiff(currentVolume, Number(input.lastVolume ?? 0));

  if (currentWeight > lastWeight && weightJumpPct >= 12) {
    return {
      tone: "caution",
      title: "Big weight jump detected",
      body: `This is about ${Math.round(weightJumpPct)}% heavier than your last comparable weight. Only take it if warm-ups and form feel solid.`,
      disclaimer,
    };
  }

  if (bestVolume > 0 && currentVolume > bestVolume) {
    return {
      tone: "push",
      title: "Potential volume PR",
      body: "This set would beat your best logged volume here. Treat it as an attempt, not an obligation.",
      disclaimer,
    };
  }

  if (volumeJumpPct >= 18) {
    return {
      tone: "caution",
      title: "Volume jump is aggressive",
      body: `This is roughly ${Math.round(volumeJumpPct)}% above your last working volume. Keep reps controlled and stop if form breaks.`,
      disclaimer,
    };
  }

  if (currentWeight === lastWeight && currentReps === lastReps) {
    return {
      tone: "hold",
      title: "Repeat is valid",
      body: "Repeating the last set can still be progress if execution, depth, tempo, or rest quality improves.",
      disclaimer,
    };
  }

  return {
    tone: "push",
    title: "Reasonable progression",
    body: "This looks like a normal next-set attempt from your recent logs. Use it only if form and recovery feel right.",
    disclaimer,
  };
}
