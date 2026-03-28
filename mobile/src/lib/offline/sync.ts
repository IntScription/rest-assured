import { supabase } from "@/src/lib/supabase";
import { STORAGE_KEYS } from "./storage-keys";
import { readJson, writeJson } from "./storage";
import { getPendingActions, setPendingActions } from "./queue";
import type { PendingAction, SyncMeta } from "./types";

const DEFAULT_SYNC_META: SyncMeta = {
  isSyncing: false,
  lastSyncStartedAt: null,
  lastSyncCompletedAt: null,
  lastSyncError: null,
};

export async function getSyncMeta(): Promise<SyncMeta> {
  return readJson<SyncMeta>(STORAGE_KEYS.SYNC_META, DEFAULT_SYNC_META);
}

export async function setSyncMeta(meta: SyncMeta): Promise<void> {
  await writeJson(STORAGE_KEYS.SYNC_META, meta);
}

export async function flushPendingActions() {
  const meta = await getSyncMeta();
  if (meta.isSyncing) return;

  await setSyncMeta({
    ...meta,
    isSyncing: true,
    lastSyncStartedAt: new Date().toISOString(),
    lastSyncError: null,
  });

  const actions = await getPendingActions();
  const remaining: PendingAction[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case "profile.setCurrentProgram": {
          const { user_id, current_program_id } = action.payload;
          const { error } = await supabase
            .from("profiles")
            .update({ current_program_id })
            .eq("id", user_id);

          if (error) throw error;
          break;
        }

        case "program.create": {
          const { error } = await supabase.from("programs").insert(action.payload);
          if (error) throw error;
          break;
        }

        case "program.update": {
          const { error } = await supabase
            .from("programs")
            .update(action.payload.updates)
            .eq("id", action.payload.id);

          if (error) throw error;
          break;
        }

        case "program.delete": {
          const { error } = await supabase
            .from("programs")
            .delete()
            .eq("id", action.payload.id);

          if (error) throw error;
          break;
        }

        case "split.create": {
          const { error } = await supabase.from("splits").insert(action.payload);
          if (error) throw error;
          break;
        }

        case "split.update": {
          const { error } = await supabase
            .from("splits")
            .update(action.payload.updates)
            .eq("id", action.payload.id);

          if (error) throw error;
          break;
        }

        case "split.delete": {
          const { error } = await supabase
            .from("splits")
            .delete()
            .eq("id", action.payload.id);

          if (error) throw error;
          break;
        }

        case "split.reorder": {
          for (const item of action.payload.items) {
            const { error } = await supabase
              .from("splits")
              .update({ order_index: item.order_index })
              .eq("id", item.id);

            if (error) throw error;
          }
          break;
        }

        case "exercise.create": {
          const { error } = await supabase.from("exercises").insert(action.payload);
          if (error) throw error;
          break;
        }

        case "exercise.update": {
          const { error } = await supabase
            .from("exercises")
            .update(action.payload.updates)
            .eq("id", action.payload.id);

          if (error) throw error;
          break;
        }

        case "exercise.delete": {
          const { error } = await supabase
            .from("exercises")
            .delete()
            .eq("id", action.payload.id);

          if (error) throw error;
          break;
        }

        case "log.create": {
          const { error } = await supabase.from("logs").insert(action.payload);
          if (error) throw error;
          break;
        }

        case "log.update": {
          const { error } = await supabase
            .from("logs")
            .update(action.payload.updates)
            .eq("id", action.payload.id);

          if (error) throw error;
          break;
        }

        case "log.delete": {
          const { error } = await supabase
            .from("logs")
            .delete()
            .eq("id", action.payload.id);

          if (error) throw error;
          break;
        }

        case "workoutSession.create": {
          const { error } = await supabase.from("workout_sessions").insert(action.payload);
          if (error) throw error;
          break;
        }

        default:
          remaining.push(action);
      }
    } catch {
      remaining.push({
        ...action,
        retries: action.retries + 1,
        status: "failed",
      });
    }
  }

  await setPendingActions(remaining);

  await setSyncMeta({
    isSyncing: false,
    lastSyncStartedAt: meta.lastSyncStartedAt,
    lastSyncCompletedAt: new Date().toISOString(),
    lastSyncError: remaining.length ? "Some actions failed to sync." : null,
  });
}
