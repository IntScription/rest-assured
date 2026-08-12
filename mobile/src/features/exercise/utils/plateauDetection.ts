import type { LogRow, PrFlags } from "../types";
import { getLogTag } from "./formatters";

export type PlateauResult = {
  isPlateaued: boolean;
  sessionsConsidered: number;
  message: string;
};

const MIN_SESSIONS = 4;

function getSessionDate(log: Pick<LogRow, "log_date" | "created_at">) {
  return log.log_date ?? (log.created_at ? log.created_at.slice(0, 10) : null);
}

/**
 * A plateau is simply: no new weight or volume PR across your last few
 * training sessions for this exercise. Reuses the existing PR-flag
 * computation (getPrFlags) rather than a separate progression metric,
 * so "plateaued" and "PR'd" can never disagree with each other.
 */
export function detectPlateau(
  logs: LogRow[],
  prFlags: Record<string, PrFlags>,
  minSessions: number = MIN_SESSIONS
): PlateauResult {
  const working = logs.filter((log) => getLogTag(log) !== "warmup");

  const sessionDates = [...new Set(working.map(getSessionDate).filter((d): d is string => !!d))]
    .sort()
    .reverse();

  if (sessionDates.length < minSessions) {
    return {
      isPlateaued: false,
      sessionsConsidered: sessionDates.length,
      message: `Log a few more sessions (${sessionDates.length}/${minSessions}) before Coach can assess a plateau.`,
    };
  }

  const recentSessionDates = new Set(sessionDates.slice(0, minSessions));
  const recentLogs = working.filter((log) => {
    const date = getSessionDate(log);
    return date !== null && recentSessionDates.has(date);
  });

  const hasRecentPr = recentLogs.some(
    (log) => prFlags[log.id]?.heaviest || prFlags[log.id]?.volume
  );

  if (hasRecentPr) {
    return {
      isPlateaued: false,
      sessionsConsidered: minSessions,
      message: `You set a new weight or volume PR within your last ${minSessions} sessions.`,
    };
  }

  return {
    isPlateaued: true,
    sessionsConsidered: minSessions,
    message: `No new weight or volume PR in your last ${minSessions} sessions. Consider a deload, a technique focus, or a rep/weight variation.`,
  };
}
