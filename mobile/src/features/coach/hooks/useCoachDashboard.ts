import { useCallback, useEffect, useRef, useState } from "react";
import { getCoachDashboard } from "@/src/features/coach/api/getCoachDashboard";
import type { CoachDashboardData } from "@/src/features/coach/types/coach";
import { cacheGetJson, cacheKey, cacheSetJson } from "@/src/lib/offline-cache";

export function useCoachDashboard(userId: string | null) {
  const [data, setData] = useState<CoachDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);

  const refetch = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!userId) {
        setData(null);
        setLoading(false);
        return;
      }

      // First visit (or a cold refetch with nothing on screen yet): check
      // the last-known dashboard before deciding whether to block on a
      // spinner — this hook previously had no caching, so every Coach tab
      // visit showed the full-screen spinner even for a returning user.
      if (!options?.silent && !hasDataRef.current) {
        const cached = await cacheGetJson<CoachDashboardData>(cacheKey(["coach-dashboard", userId]));
        if (cached && !hasDataRef.current) {
          hasDataRef.current = true;
          setData(cached);
          setLoading(false);
        } else {
          setLoading(true);
        }
      }

      const result = await getCoachDashboard(userId);
      hasDataRef.current = true;
      setData(result);
      setLoading(false);
      void cacheSetJson(cacheKey(["coach-dashboard", userId]), result);
    },
    [userId]
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, refetch };
}
