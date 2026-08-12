import type { TrainingLog } from "./types";
import { calcVolume } from "./metrics";

export function getNextSetSuggestion(history: TrainingLog[]) {
  const sorted = [...history].sort((a, b) =>
    String(b.log_date ?? b.created_at ?? "").localeCompare(
      String(a.log_date ?? a.created_at ?? "")
    )
  );

  const latest = sorted[0];
  const previous = sorted[1];

  if (!latest) {
    return {
      title: "Start simple",
      suggestion: "Log a comfortable working set first. The app will suggest progression after a few sessions.",
      tone: "neutral" as const,
    };
  }

  const latestVolume = Number(latest.volume ?? calcVolume(latest));
  const previousVolume = previous ? Number(previous.volume ?? calcVolume(previous)) : 0;
  const rpe = Number(latest.rpe ?? 0);

  if (rpe >= 8.5) {
    return {
      title: "Repeat load",
      suggestion: `Repeat ${latest.weight ?? 0}kg × ${latest.reps} × ${latest.sets}. Keep reps cleaner before increasing.`,
      tone: "warning" as const,
    };
  }

  if (previous && latestVolume > previousVolume && latest.reps >= 5) {
    const nextWeight = Math.round((Number(latest.weight ?? 0) + 2.5) * 2) / 2;
    return {
      title: "Small progression",
      suggestion: `Try ${nextWeight}kg for slightly lower reps, or repeat today’s load for more total reps.`,
      tone: "good" as const,
    };
  }

  return {
    title: "Build consistency",
    suggestion: `Repeat ${latest.weight ?? 0}kg × ${latest.reps} × ${latest.sets}, then add reps before load.`,
    tone: "neutral" as const,
  };
}
