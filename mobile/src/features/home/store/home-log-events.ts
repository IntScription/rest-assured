import type { LatestLogLite } from "../types";

type LatestLogListener = (log: LatestLogLite) => void;
type DeletedLogListener = (payload: { logId: string; exerciseId?: string | null }) => void;

const latestLogListeners = new Set<LatestLogListener>();
const deletedLogListeners = new Set<DeletedLogListener>();

export function publishLatestLog(log: LatestLogLite) {
  latestLogListeners.forEach((listener) => listener(log));
}

export function subscribeLatestLog(listener: LatestLogListener) {
  latestLogListeners.add(listener);
  return () => latestLogListeners.delete(listener);
}

export function publishLogDeleted(payload: { logId: string; exerciseId?: string | null }) {
  deletedLogListeners.forEach((listener) => listener(payload));
}

export function subscribeLogDeleted(listener: DeletedLogListener) {
  deletedLogListeners.add(listener);
  return () => deletedLogListeners.delete(listener);
}
