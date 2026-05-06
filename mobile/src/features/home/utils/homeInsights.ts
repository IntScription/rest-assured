import type { ExerciseLite, LatestLogLite, SplitLite } from "../types";
import { formatWeight } from "./formatLatestLog";

export type ExerciseMeta = ExerciseLite & {
  splitId: string;
  splitName: string;
};

export type LogWithExercise = LatestLogLite & {
  exerciseName: string;
  splitName: string;
  exerciseSlug: string | null;
};

export type ProgressNote = {
  id: string;
  tone: "positive" | "warning" | "neutral";
  title: string;
  body: string;
  source?: "coach" | "logs";
  route?: string;
};

export type RecentPr = {
  id: string;
  exerciseName: string;
  splitName: string;
  label: string;
  detail: string;
  exerciseSlug: string | null;
};

export type NeedsAttentionItem = {
  id: string;
  exerciseName: string;
  splitName: string;
  reason: string;
  daysSinceLastLog: number | null;
  exerciseSlug: string | null;
};

type CoachDashboardLike = {
  nextSessionInsight?: { summary?: string | null } | null;
  skillFocusInsight?: { summary?: string | null } | null;
  weeklyReviewInsight?: { summary?: string | null } | null;
  readinessInsight?: {
    summary?: string | null;
    payload?: {
      score?: number | null;
      status?: string | null;
      reasons?: string[] | null;
    } | null;
  } | null;
} | null;

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_ACTIVITY_DAYS = 3;

export function flattenExercisesBySplit(
  splits: SplitLite[],
  exercisesBySplit: Record<string, ExerciseLite[]>
): ExerciseMeta[] {
  const splitNameById = new Map(splits.map((split) => [split.id, split.name]));

  return Object.entries(exercisesBySplit).flatMap(([splitId, exercises]) =>
    exercises.map((exercise) => ({
      ...exercise,
      splitId,
      splitName: splitNameById.get(splitId) ?? "Split",
    }))
  );
}

export function attachExerciseMeta(
  logs: LatestLogLite[],
  exercises: ExerciseMeta[]
): LogWithExercise[] {
  const metaByExerciseId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  return logs
    .map((log) => {
      const meta = metaByExerciseId.get(log.exercise_id);
      if (!meta) return null;

      return {
        ...log,
        exerciseName: meta.name,
        splitName: meta.splitName,
        exerciseSlug: meta.slug ?? null,
      };
    })
    .filter(Boolean) as LogWithExercise[];
}

export function sortLogsDesc<T extends Pick<LatestLogLite, "created_at" | "id">>(logs: T[]) {
  return [...logs].sort((a, b) => {
    const left = new Date(a.created_at ?? 0).getTime();
    const right = new Date(b.created_at ?? 0).getTime();
    if (right !== left) return right - left;
    return String(b.id).localeCompare(String(a.id));
  });
}

export function logScore(log: LatestLogLite) {
  const weight = Number(log.weight ?? 0);
  const reps = Number(log.reps ?? 0);
  const sets = Number(log.sets ?? 0);

  if (!Number.isFinite(reps) || !Number.isFinite(sets)) return 0;

  const base = reps * sets;
  if (!Number.isFinite(weight) || weight <= 0) return base;

  return weight * base;
}

export function formatLogSummary(log: LatestLogLite) {
  const weightText = formatWeight(log.weight as number | string | null | undefined);
  const reps = Number(log.reps ?? 0);
  const sets = Number(log.sets ?? 0);

  if (weightText) return `${weightText} · ${reps} reps · ${sets} sets`;
  return `${reps} reps · ${sets} sets`;
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / DAY_MS);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function buildRecentActivity(logs: LogWithExercise[], limit = 6) {
  const cutoff = Date.now() - RECENT_ACTIVITY_DAYS * DAY_MS;

  return sortLogsDesc(logs)
    .filter((log) => {
      const time = new Date(log.created_at ?? 0).getTime();
      return Number.isFinite(time) && time >= cutoff;
    })
    .slice(0, limit);
}

export function buildCurrentPrs(logs: LogWithExercise[], limit = 24): RecentPr[] {
  const byExercise = new Map<string, LogWithExercise[]>();

  for (const log of logs) {
    const list = byExercise.get(log.exercise_id) ?? [];
    list.push(log);
    byExercise.set(log.exercise_id, list);
  }

  const prs: Array<RecentPr & { score: number; createdAt: number }> = [];

  for (const [exerciseId, exerciseLogs] of byExercise) {
    const sorted = sortLogsDesc(exerciseLogs);
    if (sorted.length === 0) continue;

    const best = [...sorted].sort((a, b) => {
      const scoreDiff = logScore(b) - logScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    })[0];

    if (!best) continue;

    prs.push({
      id: `${exerciseId}:${best.id}:current-pr`,
      exerciseName: best.exerciseName,
      splitName: best.splitName,
      label: "Current PR",
      detail: formatLogSummary(best),
      exerciseSlug: best.exerciseSlug,
      score: logScore(best),
      createdAt: new Date(best.created_at ?? 0).getTime(),
    });
  }

  return prs
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map(({ score: _score, createdAt: _createdAt, ...pr }) => pr);
}

export const buildRecentPrs = buildCurrentPrs;

export function buildNeedsAttention(
  exercises: ExerciseMeta[],
  latestLogsByExercise: Record<string, LatestLogLite | null>,
  limit = 5
): NeedsAttentionItem[] {
  const now = Date.now();

  return exercises
    .map((exercise) => {
      const latest = latestLogsByExercise[exercise.id] ?? null;

      if (!latest?.created_at) {
        return {
          id: exercise.id,
          exerciseName: exercise.name,
          splitName: exercise.splitName,
          reason: "No log yet",
          daysSinceLastLog: null,
          exerciseSlug: exercise.slug ?? null,
        };
      }

      const lastLoggedAt = new Date(latest.created_at).getTime();
      const days = Number.isFinite(lastLoggedAt) ? Math.floor((now - lastLoggedAt) / DAY_MS) : null;

      if (days == null || days < 7) return null;

      return {
        id: exercise.id,
        exerciseName: exercise.name,
        splitName: exercise.splitName,
        reason: days >= 14 ? "Not logged in 2+ weeks" : "Not logged this week",
        daysSinceLastLog: days,
        exerciseSlug: exercise.slug ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const left = a!.daysSinceLastLog ?? 999;
      const right = b!.daysSinceLastLog ?? 999;
      return right - left;
    })
    .slice(0, limit) as NeedsAttentionItem[];
}

function cleanSummary(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildCoachAiNotes(coachData?: CoachDashboardLike): Array<ProgressNote & { priority: number }> {
  if (!coachData) return [];

  const notes: Array<ProgressNote & { priority: number }> = [];
  const nextSession = cleanSummary(coachData.nextSessionInsight?.summary);
  const skillFocus = cleanSummary(coachData.skillFocusInsight?.summary);
  const weeklyReview = cleanSummary(coachData.weeklyReviewInsight?.summary);
  const readinessStatus = cleanSummary(coachData.readinessInsight?.payload?.status);
  const readinessScore = coachData.readinessInsight?.payload?.score;
  const readinessReasons = Array.isArray(coachData.readinessInsight?.payload?.reasons)
    ? coachData.readinessInsight?.payload?.reasons?.filter(Boolean).slice(0, 2)
    : [];

  if (nextSession) {
    notes.push({
      id: "coach:next-session",
      tone: "positive",
      title: "Coach next-session cue",
      body: nextSession,
      source: "coach",
      route: "/coach/ask",
      priority: 7,
    });
  }

  if (skillFocus) {
    notes.push({
      id: "coach:skill-focus",
      tone: "neutral",
      title: "Skill focus",
      body: skillFocus,
      source: "coach",
      route: "/coach",
      priority: 6,
    });
  }

  if (weeklyReview) {
    notes.push({
      id: "coach:weekly-review",
      tone: "neutral",
      title: "Weekly review",
      body: weeklyReview,
      source: "coach",
      route: "/coach",
      priority: 5,
    });
  }

  if (readinessStatus || typeof readinessScore === "number") {
    const status = readinessStatus ?? "unknown";
    notes.push({
      id: "coach:readiness",
      tone: status === "recover" ? "warning" : status === "ready" ? "positive" : "neutral",
      title: "Readiness context",
      body: [
        typeof readinessScore === "number" ? `Readiness ${readinessScore}/100` : null,
        status !== "unknown" ? `status: ${status}` : null,
        readinessReasons?.length ? readinessReasons.join(" · ") : null,
      ]
        .filter(Boolean)
        .join(" — "),
      source: "coach",
      route: "/coach/recovery",
      priority: 4,
    });
  }

  return notes;
}

export function buildCoachProgressNotes(
  logs: LogWithExercise[],
  coachData?: CoachDashboardLike,
  limit = 4
): ProgressNote[] {
  const byExercise = new Map<string, LogWithExercise[]>();

  for (const log of logs) {
    const list = byExercise.get(log.exercise_id) ?? [];
    list.push(log);
    byExercise.set(log.exercise_id, list);
  }

  const notes: Array<ProgressNote & { priority: number }> = buildCoachAiNotes(coachData);

  for (const [exerciseId, exerciseLogs] of byExercise) {
    const sorted = sortLogsDesc(exerciseLogs);
    const latest = sorted[0];
    const previous = sorted[1];

    if (!latest || !previous) continue;

    const latestScore = logScore(latest);
    const previousScore = logScore(previous);
    const change = previousScore > 0 ? ((latestScore - previousScore) / previousScore) * 100 : 0;

    if (change >= 8) {
      notes.push({
        id: `${exerciseId}:improved`,
        tone: "positive",
        title: `${latest.exerciseName} is progressing`,
        body: `Latest log is up about ${Math.round(change)}%. Keep the next jump small and keep form strict.`,
        source: "logs",
        priority: 3,
      });
      continue;
    }

    if (change <= -12) {
      notes.push({
        id: `${exerciseId}:dropped`,
        tone: "warning",
        title: `${latest.exerciseName} dipped`,
        body: "Performance dropped from the previous log. Repeat the same load/reps once before increasing.",
        source: "logs",
        priority: 4,
      });
      continue;
    }

    if (Math.abs(change) < 3 && sorted.length >= 3) {
      const third = sorted[2];
      const thirdScore = logScore(third);
      const stable = Math.abs(latestScore - thirdScore) / Math.max(thirdScore, 1) < 0.05;

      if (stable) {
        notes.push({
          id: `${exerciseId}:stable`,
          tone: "neutral",
          title: `${latest.exerciseName} is stable`,
          body: "You are holding performance. Try adding reps first, then increase load once reps stay clean.",
          source: "logs",
          priority: 2,
        });
      }
    }
  }

  if (notes.length === 0 && logs.length > 0) {
    notes.push({
      id: "coach:baseline",
      tone: "neutral",
      title: "Coach is collecting patterns",
      body: "Keep logging consistently. Once there are more repeated exercises, this section will show stronger progression cues.",
      source: "logs",
      priority: 1,
    });
  }

  return notes
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map(({ priority: _priority, ...note }) => note);
}
