import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";

import { supabase } from "@/src/lib/supabase";
import { cacheGetJson, cacheKey, cacheSetJson } from "@/src/lib/offline-cache";
import { publishActiveProgram, type Program as StoreProgram } from "@/src/store/active-program";
import { normalizeProgram, normalizeSplitOrder } from "../utils";
import type { Program, Split } from "../types";

const CACHE_VERSION = "train-v12";

type UsernameMap = Record<string, string | null>;

const safeHaptics = {
  async notify(type: "success" | "warning" | "error" = "success") {
    try {
      const map = {
        success: Haptics.NotificationFeedbackType.Success,
        warning: Haptics.NotificationFeedbackType.Warning,
        error: Haptics.NotificationFeedbackType.Error,
      };
      await Haptics.notificationAsync(map[type]);
    } catch {}
  },
};

function mergeUsernameDirectory(base: UsernameMap, incoming: UsernameMap) {
  if (!incoming || Object.keys(incoming).length === 0) return base;

  const next = { ...base };

  Object.entries(incoming).forEach(([id, username]) => {
    if (!id) return;
    next[id] = username ?? null;
  });

  return next;
}

async function fetchUsernameMap(userIds: (string | null | undefined)[]) {
  const ids = Array.from(new Set(userIds.filter((value): value is string => Boolean(value))));

  if (ids.length === 0) return {} as UsernameMap;

  const { data, error } = await supabase.from("profiles").select("id, username").in("id", ids);

  if (error) return {} as UsernameMap;

  const map: UsernameMap = {};
  ((data ?? []) as { id: string; username: string | null }[]).forEach((row) => {
    map[row.id] = row.username ?? null;
  });

  return map;
}

export function useTrainData(userId: string | null) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [splitCountsByProgram, setSplitCountsByProgram] = useState<Record<string, number>>({});

  const [pendingShares, setPendingShares] = useState<any[]>([]);
  const [sentShares, setSentShares] = useState<any[]>([]);
  const [recentImports, setRecentImports] = useState<any[]>([]);
  const [programImports, setProgramImports] = useState<Record<string, any>>({});
  const [usernameDirectory, setUsernameDirectory] = useState<UsernameMap>({});
  const [manageSplits, setManageSplits] = useState<Split[]>([]);

  const [busy, setBusy] = useState(false);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const programsRef = useRef<Program[]>([]);
  const usernameDirectoryRef = useRef<UsernameMap>({});

  useEffect(() => {
    programsRef.current = programs;
  }, [programs]);

  useEffect(() => {
    usernameDirectoryRef.current = usernameDirectory;
  }, [usernameDirectory]);

  const activeProgram = useMemo(
    () => programs.find((program) => program.id === activeProgramId) ?? null,
    [activeProgramId, programs]
  );

  const fetchPrograms = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) return;

    const list = ((data ?? []) as any[]).map((item) => normalizeProgram(item));

    setPrograms(list);
    setActiveProgramId((prev) => {
      if (prev && list.some((program) => program.id === prev)) return prev;
      return list.find((program) => program.is_active)?.id ?? list[0]?.id ?? null;
    });
  }, [userId]);

  const fetchSplitCounts = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase.from("splits").select("program_id").eq("user_id", userId);

    const nextCounts: Record<string, number> = {};
    (data ?? []).forEach((item: any) => {
      nextCounts[item.program_id] = (nextCounts[item.program_id] ?? 0) + 1;
    });

    setSplitCountsByProgram(nextCounts);
  }, [userId]);

  const fetchSplitsForProgram = useCallback(
    async (programId: string) => {
      if (!userId || !programId) return [] as Split[];

      const { data, error } = await supabase
        .from("splits")
        .select("*")
        .eq("user_id", userId)
        .eq("program_id", programId)
        .order("order_index");

      if (error) return [] as Split[];

      const next = normalizeSplitOrder((data ?? []) as Split[]);
      setManageSplits(next);
      return next;
    },
    [userId]
  );

  const fetchProgramImports = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("program_imports")
      .select("program_id, shared_by_user_id")
      .eq("imported_by_user_id", userId);

    if (error) return;

    const rows = (data ?? []) as { program_id: string; shared_by_user_id: string | null }[];
    const usernameMap = await fetchUsernameMap(rows.map((row) => row.shared_by_user_id));

    setUsernameDirectory((prev) => mergeUsernameDirectory(prev, usernameMap));

    const cachedDirectory = usernameDirectoryRef.current;
    const nextMap: Record<string, any> = {};

    rows.forEach((row) => {
      nextMap[row.program_id] = {
        program_id: row.program_id,
        shared_by_user_id: row.shared_by_user_id,
        shared_by_username: row.shared_by_user_id
          ? usernameMap[row.shared_by_user_id] ?? cachedDirectory[row.shared_by_user_id] ?? null
          : null,
      };
    });

    setProgramImports(nextMap);
  }, [userId]);

  const fetchSharesAndImports = useCallback(async () => {
    if (!userId) return;

    const [pendingRes, sentRes, importsRes] = await Promise.all([
      supabase
        .from("program_shares")
        .select(
          "id, status, created_at, program_id, shared_by_user_id, program_name_snapshot, shared_by_username_snapshot"
        )
        .eq("shared_with_user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("program_shares")
        .select("id, status, created_at, program_id, shared_with_user_id, program_name_snapshot")
        .eq("shared_by_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("program_imports")
        .select("id, created_at, program_id, shared_by_user_id")
        .eq("imported_by_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    const localProgramNameMap = new Map(programsRef.current.map((program) => [program.id, program.name]));

    if (pendingRes.data) {
      const rows = pendingRes.data as any[];
      const missingIds = rows
        .filter((row) => !row.shared_by_username_snapshot && row.shared_by_user_id)
        .map((row) => row.shared_by_user_id);

      const usernameMap = await fetchUsernameMap(missingIds);
      setUsernameDirectory((prev) => mergeUsernameDirectory(prev, usernameMap));

      const cachedDirectory = usernameDirectoryRef.current;

      setPendingShares(
        rows.map((row) => ({
          id: row.id,
          status: row.status,
          created_at: row.created_at ?? null,
          program_id: row.program_id ?? null,
          shared_by_user_id: row.shared_by_user_id ?? null,
          program_name:
            row.program_name_snapshot?.trim() ||
            (row.program_id ? localProgramNameMap.get(row.program_id) : null) ||
            "Program",
          sender_username:
            row.shared_by_username_snapshot?.trim() ||
            (row.shared_by_user_id
              ? usernameMap[row.shared_by_user_id] ?? cachedDirectory[row.shared_by_user_id] ?? null
              : null),
        }))
      );
    }

    if (sentRes.data) {
      const rows = sentRes.data as any[];
      const usernameMap = await fetchUsernameMap(rows.map((row) => row.shared_with_user_id));
      setUsernameDirectory((prev) => mergeUsernameDirectory(prev, usernameMap));

      const cachedDirectory = usernameDirectoryRef.current;

      setSentShares(
        rows.map((row) => ({
          id: row.id,
          status: row.status,
          created_at: row.created_at ?? null,
          program_id: row.program_id ?? null,
          shared_with_user_id: row.shared_with_user_id ?? null,
          program_name:
            row.program_name_snapshot?.trim() ||
            (row.program_id ? localProgramNameMap.get(row.program_id) : null) ||
            "Program",
          receiver_username: row.shared_with_user_id
            ? usernameMap[row.shared_with_user_id] ?? cachedDirectory[row.shared_with_user_id] ?? null
            : null,
        }))
      );
    }

    if (importsRes.data) {
      const rows = importsRes.data as any[];
      const usernameMap = await fetchUsernameMap(rows.map((row) => row.shared_by_user_id));
      setUsernameDirectory((prev) => mergeUsernameDirectory(prev, usernameMap));

      const cachedDirectory = usernameDirectoryRef.current;

      setRecentImports(
        rows.map((row) => ({
          id: row.id,
          created_at: row.created_at ?? null,
          program_id: row.program_id ?? null,
          shared_by_user_id: row.shared_by_user_id ?? null,
          program_name: (row.program_id ? localProgramNameMap.get(row.program_id) : null) || "Program",
          shared_by_username: row.shared_by_user_id
            ? usernameMap[row.shared_by_user_id] ?? cachedDirectory[row.shared_by_user_id] ?? null
            : null,
        }))
      );
    }
  }, [userId]);

  const hydrateCacheThenFetch = useCallback(async () => {
    if (!userId) {
      setScreenLoading(false);
      return;
    }

    try {
      const cached = await cacheGetJson<any>(cacheKey([CACHE_VERSION, userId]));

      if (cached?.programs?.length) setPrograms(cached.programs);
      if (cached?.activeProgramId) setActiveProgramId(cached.activeProgramId);
      if (cached?.splitCountsByProgram) setSplitCountsByProgram(cached.splitCountsByProgram);
      if (cached?.pendingShares) setPendingShares(cached.pendingShares);
      if (cached?.sentShares) setSentShares(cached.sentShares);
      if (cached?.recentImports) setRecentImports(cached.recentImports);
      if (cached?.programImports) setProgramImports(cached.programImports);
      if (cached?.usernameDirectory) setUsernameDirectory(cached.usernameDirectory);

      await Promise.all([fetchPrograms(), fetchSplitCounts(), fetchProgramImports(), fetchSharesAndImports()]);
    } finally {
      setScreenLoading(false);
    }
  }, [fetchProgramImports, fetchPrograms, fetchSharesAndImports, fetchSplitCounts, userId]);

  useEffect(() => {
    if (userId) void hydrateCacheThenFetch();
  }, [hydrateCacheThenFetch, userId]);

  useEffect(() => {
    if (!userId) return;

    void cacheSetJson(cacheKey([CACHE_VERSION, userId]), {
      programs,
      activeProgramId,
      splitCountsByProgram,
      pendingShares,
      sentShares,
      recentImports,
      programImports,
      usernameDirectory,
    });
  }, [
    activeProgramId,
    pendingShares,
    programImports,
    programs,
    recentImports,
    sentShares,
    splitCountsByProgram,
    userId,
    usernameDirectory,
  ]);

  const handleRefresh = useCallback(async () => {
    if (!userId) return;

    try {
      setRefreshing(true);
      await Promise.all([fetchPrograms(), fetchSplitCounts(), fetchProgramImports(), fetchSharesAndImports()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchProgramImports, fetchPrograms, fetchSharesAndImports, fetchSplitCounts, userId]);

  const setActiveProgram = useCallback(
    async (program: Program) => {
      if (!userId || busy || program.id === activeProgramId) return;

      const previousPrograms = programsRef.current;
      const normalized = normalizeProgram({ ...program, is_active: true });

      setPrograms((prev) => prev.map((item) => ({ ...item, is_active: item.id === program.id })));
      setActiveProgramId(program.id);
      publishActiveProgram(normalized as StoreProgram);

      try {
        setBusy(true);

        await supabase.from("programs").update({ is_active: false }).eq("user_id", userId);
        await supabase.from("programs").update({ is_active: true }).eq("user_id", userId).eq("id", program.id);

        await safeHaptics.notify("success");
      } catch (error: any) {
        setPrograms(previousPrograms);
        setActiveProgramId(previousPrograms.find((item) => item.is_active)?.id ?? null);
        Alert.alert("Could not select program", String(error?.message ?? "Unknown error"));
        await fetchPrograms();
      } finally {
        setBusy(false);
      }
    },
    [activeProgramId, busy, fetchPrograms, userId]
  );

  const deleteItem = useCallback(
    async (id: string, type: "program" | "split") => {
      if (!userId || busy) return;

      Alert.alert(`Delete ${type}?`, `This will remove the ${type}.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const previousPrograms = programsRef.current;
            const previousSplits = manageSplits;

            try {
              setBusy(true);

              const table = type === "program" ? "programs" : "splits";

              if (type === "program") {
                const nextPrograms = previousPrograms.filter((program) => program.id !== id);
                setPrograms(nextPrograms);

                if (activeProgramId === id) {
                  setActiveProgramId(nextPrograms[0]?.id ?? null);
                }
              } else {
                setManageSplits((prev) => normalizeSplitOrder(prev.filter((split) => split.id !== id)));
              }

              const { error } = await supabase.from(table).delete().eq("user_id", userId).eq("id", id);
              if (error) throw error;

              await Promise.all([fetchSplitCounts(), fetchProgramImports(), fetchSharesAndImports()]);
            } catch (error: any) {
              setPrograms(previousPrograms);
              setManageSplits(previousSplits);
              Alert.alert("Delete failed", String(error?.message ?? "Unknown error"));
              await fetchPrograms();
              await fetchSplitCounts();
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [
      activeProgramId,
      busy,
      fetchProgramImports,
      fetchPrograms,
      fetchSharesAndImports,
      fetchSplitCounts,
      manageSplits,
      userId,
    ]
  );

  const reorderSplits = useCallback(
    async ({ data }: { data: Split[] }) => {
      if (!userId) return;

      const previous = manageSplits;
      const ordered = normalizeSplitOrder(data);

      setManageSplits(ordered);

      try {
        const updates = ordered.map((item) =>
          supabase
            .from("splits")
            .update({ order_index: item.order_index })
            .eq("id", item.id)
            .eq("user_id", userId)
        );

        await Promise.all(updates);
      } catch {
        setManageSplits(previous);
        Alert.alert("Could not reorder splits");
      }
    },
    [manageSplits, userId]
  );

  const handleAcceptShare = useCallback(
    async (shareId: string) => {
      try {
        setBusy(true);

        const { error } = await supabase.rpc("accept_program_share", { p_share_id: shareId });
        if (error) throw error;

        await safeHaptics.notify("success");
        await Promise.all([
          fetchSharesAndImports(),
          fetchPrograms(),
          fetchProgramImports(),
          fetchSplitCounts(),
        ]);

        Toast.show({ type: "success", text1: "Program imported" });
      } catch (error: any) {
        Alert.alert("Accept failed", error?.message ?? "Could not accept");
      } finally {
        setBusy(false);
      }
    },
    [fetchProgramImports, fetchPrograms, fetchSharesAndImports, fetchSplitCounts]
  );

  const handleDeclineShare = useCallback(
    async (shareId: string) => {
      try {
        setBusy(true);

        const { error } = await supabase.rpc("decline_program_share", { p_share_id: shareId });
        if (error) throw error;

        await fetchSharesAndImports();
      } catch (error: any) {
        Alert.alert("Decline failed", error?.message ?? "Could not decline");
      } finally {
        setBusy(false);
      }
    },
    [fetchSharesAndImports]
  );

  return {
    programs,
    activeProgram,
    activeProgramId,
    splitCountsByProgram,
    pendingShares,
    sentShares,
    recentImports,
    programImports,
    usernameDirectory,
    screenLoading,
    refreshing,
    handleRefresh,
    setActiveProgram,
    deleteItem,
    manageSplits,
    fetchSplitsForProgram,
    reorderSplits,
    handleAcceptShare,
    handleDeclineShare,
    busy,
  };
}
