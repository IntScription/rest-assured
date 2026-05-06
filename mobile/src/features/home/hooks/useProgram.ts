import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/src/lib/supabase";
import { getActiveProgramSnapshot, publishActiveProgram, subscribeActiveProgram } from "@/src/store/active-program";
import type { Program } from "../types";

export function useProgram(user: User | null) {
  const [activeProgram, setActiveProgram] = useState<Program | null>(() => getActiveProgramSnapshot());
  const [programLoading, setProgramLoading] = useState(true);

  const normalizeProgram = useCallback((program: Program | null | undefined): Program | null => {
    if (!program) return null;
    return {
      ...program,
      created_at: program.created_at ?? null,
      is_active: program.is_active ?? false,
    } as Program;
  }, []);

  const lastPublishedProgramRef = useRef<Program | null>(getActiveProgramSnapshot());

  const sameProgram = useCallback((a: Program | null | undefined, b: Program | null | undefined) => {
    const left = normalizeProgram(a);
    const right = normalizeProgram(b);
    return (
      left?.id === right?.id &&
      left?.is_active === right?.is_active &&
      left?.name === right?.name &&
      left?.created_at === right?.created_at
    );
  }, [normalizeProgram]);

  const applyProgram = useCallback(
    (program: Program | null | undefined, options?: { publish?: boolean }) => {
      const nextProgram = normalizeProgram(program);

      setActiveProgram((prev) => {
        const prevNormalized = normalizeProgram(prev);
        if (sameProgram(prevNormalized, nextProgram)) return prevNormalized;
        return nextProgram;
      });

      if (options?.publish !== false && !sameProgram(lastPublishedProgramRef.current, nextProgram)) {
        lastPublishedProgramRef.current = nextProgram;
        publishActiveProgram(nextProgram);
      } else {
        lastPublishedProgramRef.current = nextProgram;
      }

      setProgramLoading(false);
      return nextProgram;
    },
    [normalizeProgram, sameProgram]
  );

  const fetchProgram = useCallback(
    async (opts?: { silent?: boolean; preferredProgramId?: string | null }) => {
      const silent = opts?.silent ?? false;
      const preferredProgramId = opts?.preferredProgramId ?? getActiveProgramSnapshot()?.id ?? null;

      if (!user) {
        applyProgram(null);
        return;
      }

      if (!silent) setProgramLoading(true);

      if (preferredProgramId) {
        const { data: preferredData, error: preferredError } = await supabase
          .from("programs")
          .select("*")
          .eq("id", preferredProgramId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!preferredError && preferredData) {
          applyProgram({ ...(preferredData as Program), is_active: true } as Program);
          return;
        }
      }

      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        applyProgram(null);
        return;
      }

      applyProgram((data ?? null) as Program | null);
    },
    [user, applyProgram]
  );

  useEffect(() => {
    const snapshot = getActiveProgramSnapshot();
    if (snapshot) {
      applyProgram(snapshot, { publish: false });
    }
    void fetchProgram({ silent: false, preferredProgramId: snapshot?.id ?? null });
  }, [fetchProgram, applyProgram]);

  useFocusEffect(
    useCallback(() => {
      const snapshot = getActiveProgramSnapshot();
      if (snapshot) {
        applyProgram(snapshot, { publish: false });
      }
      void fetchProgram({ silent: true, preferredProgramId: snapshot?.id ?? null });
    }, [fetchProgram, applyProgram])
  );

  useEffect(() => {
    const unsubscribe = subscribeActiveProgram((program: Program | null) => {
      const nextProgram = applyProgram(program, { publish: false });
      if (program?.id) {
        void fetchProgram({ silent: true, preferredProgramId: program.id });
      } else if (!nextProgram) {
        void fetchProgram({ silent: true, preferredProgramId: null });
      }
    });
    return unsubscribe;
  }, [applyProgram, fetchProgram]);

  return { activeProgram, programLoading, fetchProgram };
}
