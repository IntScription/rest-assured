import { useCallback, useEffect, useState } from "react";
import { getCoachDashboard } from "@/src/features/coach/api/getCoachDashboard";
import type { CoachDashboardData } from "@/src/features/coach/types/coach";

export function useCoachDashboard(userId: string | null) {
  const [data, setData] = useState<CoachDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await getCoachDashboard(userId);
    setData(result);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, refetch };
}
