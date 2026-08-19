import { Platform } from "react-native";
import type { LiveActivity } from "expo-widgets";
import type { RestTimerActivityProps } from "./RestTimerActivity";

export type RestTimerLiveActivityInstance = LiveActivity<RestTimerActivityProps> | null;

// `expo-widgets` (and this file's own RestTimerActivity.tsx, which calls
// createLiveActivity() at module scope) touch the native module the moment
// they're imported — a stale dev-client build without the native module
// linked throws immediately, the same class of crash the CSV export bug
// hit with expo-sharing. Since CustomTabBar mounts on every screen, that
// import has to be deferred to call-time and swallowed here, never at the
// top of CustomTabBar.tsx.
async function loadRestTimerActivityFactory() {
  if (Platform.OS !== "ios") return null;

  try {
    const mod = await import("./RestTimerActivity");
    return mod.default;
  } catch {
    return null;
  }
}

export async function startRestTimerLiveActivity(
  props: RestTimerActivityProps
): Promise<RestTimerLiveActivityInstance> {
  const factory = await loadRestTimerActivityFactory();
  if (!factory) return null;

  try {
    return factory.start(props);
  } catch {
    return null;
  }
}

export async function updateRestTimerLiveActivity(
  instance: RestTimerLiveActivityInstance,
  props: RestTimerActivityProps
): Promise<void> {
  if (!instance) return;

  try {
    await instance.update(props);
  } catch {
    // Best-effort — the Live Activity mirror is a nice-to-have, never worth
    // surfacing an error over for the actual in-app rest timer.
  }
}

export async function endRestTimerLiveActivity(instance: RestTimerLiveActivityInstance): Promise<void> {
  if (!instance) return;

  try {
    await instance.end("immediate");
  } catch {
    // ignore
  }
}
