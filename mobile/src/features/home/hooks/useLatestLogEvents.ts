import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { LatestLogLite } from "../types";
import { subscribeLatestLog, subscribeLogDeleted } from "../store/home-log-events";

type Args = {
  setLatestLogsByExercise: Dispatch<
    SetStateAction<Record<string, LatestLogLite | null>>
  >;
  setLogHistoryByExercise?: Dispatch<
    SetStateAction<Record<string, LatestLogLite[]>>
  >;
  onDeletedLatestLog?: (exerciseId?: string | null) => void;
};

function sortLogsDesc(logs: LatestLogLite[]) {
  return [...logs].sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime()
  );
}

function uniqueLogs(logs: LatestLogLite[]) {
  const seen = new Set<string>();

  return logs.filter((log) => {
    if (!log?.id) return true;
    if (seen.has(log.id)) return false;
    seen.add(log.id);
    return true;
  });
}

export function useLatestLogEvents(
  args:
    | Dispatch<SetStateAction<Record<string, LatestLogLite | null>>>
    | Args
) {
  const setLatestLogsByExercise =
    typeof args === "function" ? args : args.setLatestLogsByExercise;

  const setLogHistoryByExercise =
    typeof args === "function" ? undefined : args.setLogHistoryByExercise;

  const onDeletedLatestLog =
    typeof args === "function" ? undefined : args.onDeletedLatestLog;

  useEffect(() => {
    const unsubscribeLatest = subscribeLatestLog((log) => {
      setLatestLogsByExercise((prev) => ({
        ...prev,
        [log.exercise_id]: log,
      }));

      setLogHistoryByExercise?.((prev) => {
        const existing = prev[log.exercise_id] ?? [];

        return {
          ...prev,
          [log.exercise_id]: sortLogsDesc(uniqueLogs([log, ...existing])).slice(
            0,
            15
          ),
        };
      });
    });

    const unsubscribeDeleted = subscribeLogDeleted(({ logId, exerciseId }) => {
      let deletedWasVisibleLatest = false;

      setLatestLogsByExercise((prev) => {
        const next = { ...prev };

        if (exerciseId) {
          if (next[exerciseId]?.id === logId) {
            next[exerciseId] = null;
            deletedWasVisibleLatest = true;
          }

          return next;
        }

        for (const [id, log] of Object.entries(next)) {
          if (log?.id === logId) {
            next[id] = null;
            deletedWasVisibleLatest = true;
          }
        }

        return next;
      });

      setLogHistoryByExercise?.((prev) => {
        const next = { ...prev };

        if (exerciseId) {
          next[exerciseId] = (next[exerciseId] ?? []).filter(
            (log) => log.id !== logId
          );
          return next;
        }

        for (const id of Object.keys(next)) {
          next[id] = next[id].filter((log) => log.id !== logId);
        }

        return next;
      });

      if (deletedWasVisibleLatest) {
        onDeletedLatestLog?.(exerciseId);
      }
    });

    return () => {
      unsubscribeLatest();
      unsubscribeDeleted();
    };
  }, [
    onDeletedLatestLog,
    setLatestLogsByExercise,
    setLogHistoryByExercise,
  ]);
}
