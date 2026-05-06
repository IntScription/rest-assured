import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { Program, SplitLite } from "../types";

export function useSplits(user: User | null, activeProgram: Program | null, isOnline: boolean) {
  const [splits, setSplits] = useState<SplitLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listIndex, setListIndex] = useState(0);

  // ✅ Linter Fix: Added user?.id and activeProgram?.id dependencies
  const fetchSplits = useCallback(async () => {
    if (!user || !activeProgram || !isOnline) return;
    setLoading(true);
    const { data } = await supabase.from("splits").select("id, name, focus, order_index").eq("program_id", activeProgram.id).eq("user_id", user.id).order("order_index", { ascending: true });
    if (data) setSplits(data.map((s: any) => ({ id: s.id, name: s.name, focus: s.focus ?? null, order_index: s.order_index })));
    setLoading(false);
  }, [user?.id, activeProgram?.id, isOnline]);

  useEffect(() => { fetchSplits(); }, [fetchSplits]);

  const loopedSplits = useMemo(() => {
    if (splits.length <= 1) return splits;
    return [splits[splits.length - 1], ...splits, splits[0]];
  }, [splits]);

  return { splits, loopedSplits, loading, fetchSplits, currentIndex, setCurrentIndex, listIndex, setListIndex };
}
