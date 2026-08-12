import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { supabase } from "@/src/lib/supabase";

/**
 * Lightweight, count-only version of the pending-shares query already used
 * by useTrainData, for the tab bar badge — a persistent, app-wide component
 * that shouldn't duplicate the full share-row fetch just to know "is there
 * anything waiting."
 */
export function usePendingShareCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function fetchCount() {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) {
        if (active) setCount(0);
        return;
      }

      const { count: result } = await supabase
        .from("program_shares")
        .select("id", { count: "exact", head: true })
        .eq("shared_with_user_id", userId)
        .eq("status", "pending");

      if (active) setCount(result ?? 0);
    }

    void fetchCount();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void fetchCount();
    });

    const appStateListener = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void fetchCount();
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      appStateListener.remove();
    };
  }, []);

  return count;
}
