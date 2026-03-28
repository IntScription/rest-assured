import { STORAGE_KEYS } from "./storage-keys";
import { readJson, writeJson } from "./storage";
import type { PendingAction } from "./types";

export async function getPendingActions(): Promise<PendingAction[]> {
  return readJson<PendingAction[]>(STORAGE_KEYS.PENDING_ACTIONS, []);
}

export async function setPendingActions(actions: PendingAction[]): Promise<void> {
  await writeJson(STORAGE_KEYS.PENDING_ACTIONS, actions);
}

export async function enqueueAction(action: PendingAction): Promise<void> {
  const current = await getPendingActions();
  const next = mergeAction(current, action);
  await setPendingActions(next);
}

export async function clearPendingActions(): Promise<void> {
  await writeJson(STORAGE_KEYS.PENDING_ACTIONS, []);
}

function mergeAction(
  current: PendingAction[],
  incoming: PendingAction
): PendingAction[] {
  switch (incoming.type) {
    case "profile.setCurrentProgram": {
      // keep only the latest active-program change
      const filtered = current.filter(
        (a) => a.type !== "profile.setCurrentProgram"
      );
      return [...filtered, incoming];
    }

    case "program.update": {
      const index = current.findIndex(
        (a) => a.type === "program.update" && a.payload.id === incoming.payload.id
      );

      if (index === -1) {
        return [...current, incoming];
      }

      const existing = current[index];
      if (existing.type !== "program.update") {
        return [...current, incoming];
      }

      const merged: PendingAction = {
        ...existing,
        payload: {
          id: incoming.payload.id,
          updates: {
            ...existing.payload.updates,
            ...incoming.payload.updates,
          },
        },
      };

      const next = [...current];
      next[index] = merged;
      return next;
    }

    case "split.update": {
      const index = current.findIndex(
        (a) => a.type === "split.update" && a.payload.id === incoming.payload.id
      );

      if (index === -1) {
        return [...current, incoming];
      }

      const existing = current[index];
      if (existing.type !== "split.update") {
        return [...current, incoming];
      }

      const merged: PendingAction = {
        ...existing,
        payload: {
          id: incoming.payload.id,
          updates: {
            ...existing.payload.updates,
            ...incoming.payload.updates,
          },
        },
      };

      const next = [...current];
      next[index] = merged;
      return next;
    }

    case "exercise.update": {
      const index = current.findIndex(
        (a) => a.type === "exercise.update" && a.payload.id === incoming.payload.id
      );

      if (index === -1) {
        return [...current, incoming];
      }

      const existing = current[index];
      if (existing.type !== "exercise.update") {
        return [...current, incoming];
      }

      const merged: PendingAction = {
        ...existing,
        payload: {
          id: incoming.payload.id,
          updates: {
            ...existing.payload.updates,
            ...incoming.payload.updates,
          },
        },
      };

      const next = [...current];
      next[index] = merged;
      return next;
    }

    case "log.update": {
      const index = current.findIndex(
        (a) => a.type === "log.update" && a.payload.id === incoming.payload.id
      );

      if (index === -1) {
        return [...current, incoming];
      }

      const existing = current[index];
      if (existing.type !== "log.update") {
        return [...current, incoming];
      }

      const merged: PendingAction = {
        ...existing,
        payload: {
          id: incoming.payload.id,
          updates: {
            ...existing.payload.updates,
            ...incoming.payload.updates,
          },
        },
      };

      const next = [...current];
      next[index] = merged;
      return next;
    }

    default:
      return [...current, incoming];
  }
}
