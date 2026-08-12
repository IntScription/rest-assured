import { useEffect, useRef } from "react";
import { flushPendingActions } from "@/src/lib/offline/sync";

export function useSyncOnReconnect(isOnline: boolean) {
  // Starts false so a cold launch that's already online still flushes once,
  // in addition to firing on every later offline -> online transition.
  const wasOnlineRef = useRef(false);

  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    if (!wasOnline && isOnline) {
      void flushPendingActions();
    }
  }, [isOnline]);
}
