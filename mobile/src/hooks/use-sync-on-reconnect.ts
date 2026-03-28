import { useEffect, useRef } from "react";
import { flushPendingActions } from "@/src/lib/offline/sync";

export function useSyncOnReconnect(isOnline: boolean) {
  const wasOnlineRef = useRef(isOnline);

  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    if (!wasOnline && isOnline) {
      void flushPendingActions();
    }
  }, [isOnline]);
}
