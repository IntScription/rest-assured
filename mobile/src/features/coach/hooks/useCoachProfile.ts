import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { CoachProfileRow } from "@/src/features/coach/types/coach";

export function useCoachProfile(userId: string | null) {
  const [profile, setProfile] = useState<CoachProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("coach_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile((data as CoachProfileRow | null) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { profile, loading, refetch, setProfile };
}
