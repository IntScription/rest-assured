// app/(tabs)/profile.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StatusBar,
  Platform,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { useIsOnline } from "@/hooks/use-is-online";
import { cacheGetJson, cacheKey, cacheSetJson } from "@/src/lib/offline-cache";

type Program = {
  id: string;
  name: string;
  is_active: boolean;
  user_id?: string;
  created_at?: string;
};

type Split = {
  id: string;
  name: string;
  program_id: string;
  order_index: number;
  user_id?: string;
};

const IS_IOS = Platform.OS === "ios";

// bump version to prevent restoring old "deleted programs"
const CACHE_VERSION = "profile_v3";

type InlineActionsProps = {
  onEdit: () => void;
  onDelete: () => void;
  border: string;
  card: string;
  mutedText: string;
};

const InlineActions = React.memo(function InlineActions({
  onEdit,
  onDelete,
  border,
  card,
  mutedText,
}: InlineActionsProps) {
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
      <TouchableOpacity
        onPress={onEdit}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: card,
          alignItems: "center",
          justifyContent: "center",
        }}
        hitSlop={10}
      >
        <Ionicons name="create-outline" size={18} color={mutedText} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onDelete}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: "#ff3b30",
          alignItems: "center",
          justifyContent: "center",
        }}
        hitSlop={10}
      >
        <Ionicons name="trash-outline" size={18} color="white" />
      </TouchableOpacity>
    </View>
  );
});

export default function ProfileScreen() {
  const t = useAppTheme();
  const isOnline = useIsOnline();

  const [userId, setUserId] = useState<string | null>(null);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);

  const [busy, setBusy] = useState(false);

  const [modal, setModal] = useState<{
    visible: boolean;
    type: "program" | "split";
    value: string;
    mode: "create" | "rename";
    targetId: string | null;
  }>({
    visible: false,
    type: "program",
    value: "",
    mode: "create",
    targetId: null,
  });

  const programsRef = useRef<Program[]>([]);
  const splitsRef = useRef<Split[]>([]);
  useEffect(() => {
    programsRef.current = programs;
  }, [programs]);
  useEffect(() => {
    splitsRef.current = splits;
  }, [splits]);

  const programsReqId = useRef(0);
  const splitsReqId = useRef(0);

  const cacheId = useMemo(() => (userId ? cacheKey([CACHE_VERSION, userId]) : null), [userId]);

  const closeModal = useCallback(() => {
    setModal((prev) => ({ ...prev, visible: false, value: "", mode: "create", targetId: null }));
  }, []);

  const openCreateProgram = useCallback(() => {
    setModal({ visible: true, type: "program", value: "", mode: "create", targetId: null });
  }, []);

  const openCreateSplit = useCallback(() => {
    setModal({ visible: true, type: "split", value: "", mode: "create", targetId: null });
  }, []);

  const openRename = useCallback((item: Program | Split, type: "program" | "split") => {
    setModal({ visible: true, type, value: item.name, mode: "rename", targetId: item.id });
  }, []);

  // ---------------- AUTH ----------------
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error) {
        console.log("getUser error:", error);
        return;
      }
      setUserId(data?.user?.id ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ---------------- FETCH PROGRAMS ----------------
  const fetchPrograms = useCallback(async () => {
    if (!userId) return;
    if (!isOnline && programsRef.current.length > 0) return;

    const rid = ++programsReqId.current;

    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (rid !== programsReqId.current) return;

    if (error) {
      console.log("fetchPrograms error:", error);
      return;
    }

    const list = (data ?? []) as Program[];
    setPrograms(list);

    setActiveProgramId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev;
      const dbActive = list.find((p) => p.is_active)?.id ?? null;
      if (dbActive) return dbActive;
      return list.length ? list[0].id : null;
    });
  }, [userId, isOnline]);

  // ---------------- FETCH SPLITS ----------------
  const fetchSplits = useCallback(
    async (programId: string) => {
      if (!userId || !programId) return;
      if (!isOnline && splitsRef.current.length > 0) return;

      const rid = ++splitsReqId.current;

      const { data, error } = await supabase
        .from("splits")
        .select("*")
        .eq("user_id", userId)
        .eq("program_id", programId)
        .order("order_index");

      if (rid !== splitsReqId.current) return;

      if (error) {
        console.log("fetchSplits error:", error);
        return;
      }

      setSplits((data ?? []) as Split[]);
    },
    [userId, isOnline]
  );

  // ---------------- LOAD CACHE + FETCH ----------------
  useEffect(() => {
    if (!userId || !cacheId) return;

    let mounted = true;
    (async () => {
      const cached = await cacheGetJson<{
        programs: Program[];
        splitsByProgram: Record<string, Split[]>;
        activeProgramId: string | null;
      }>(cacheId);

      if (!mounted) return;

      if (cached?.programs?.length) setPrograms(cached.programs);
      if (cached?.activeProgramId) setActiveProgramId(cached.activeProgramId);

      if (cached?.activeProgramId && cached?.splitsByProgram?.[cached.activeProgramId]) {
        setSplits(cached.splitsByProgram[cached.activeProgramId]);
      }

      await fetchPrograms();
    })();

    return () => {
      mounted = false;
    };
  }, [userId, cacheId, fetchPrograms]);

  // active program => refresh splits
  useEffect(() => {
    if (!userId) return;

    splitsReqId.current += 1; // invalidate in-flight

    if (!activeProgramId) {
      setSplits([]);
      return;
    }

    fetchSplits(activeProgramId);
  }, [userId, activeProgramId, fetchSplits]);

  // ---------------- PERSIST CACHE ----------------
  useEffect(() => {
    if (!userId || !cacheId) return;

    (async () => {
      if (programs.length === 0) {
        await cacheSetJson(cacheId, { programs: [], splitsByProgram: {}, activeProgramId: null });
        return;
      }

      const existing = (await cacheGetJson<any>(cacheId)) ?? {};
      const splitsByProgram = { ...(existing.splitsByProgram ?? {}) };

      if (activeProgramId) splitsByProgram[activeProgramId] = splits;

      await cacheSetJson(cacheId, { programs, splitsByProgram, activeProgramId });
    })();
  }, [userId, cacheId, programs, splits, activeProgramId]);

  // ---------------- ACTIVATE PROGRAM ----------------
  const activateProgram = useCallback(
    async (program: Program) => {
      if (!userId) return;
      if (program.id === activeProgramId) return;

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setBusy(true);

      // optimistic
      setPrograms((prev) => prev.map((p) => ({ ...p, is_active: p.id === program.id })));
      setActiveProgramId(program.id);

      try {
        const { error: offError } = await supabase
          .from("programs")
          .update({ is_active: false })
          .eq("user_id", userId)
          .neq("id", program.id);
        if (offError) throw offError;

        const { error: onError } = await supabase
          .from("programs")
          .update({ is_active: true })
          .eq("user_id", userId)
          .eq("id", program.id);
        if (onError) throw onError;
      } catch (e: any) {
        console.log("activateProgram error:", e);
        Alert.alert("Failed", String(e?.message ?? "Could not activate program"));
        programsReqId.current += 1;
        await fetchPrograms();
      } finally {
        setBusy(false);
      }
    },
    [userId, activeProgramId, fetchPrograms]
  );

  // ---------------- DRAG SPLITS ----------------
  const onDragEnd = useCallback(
    async ({ data }: { data: Split[] }) => {
      if (!userId || !activeProgramId) return;

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSplits(data);

      try {
        await Promise.all(
          data.map((item, index) =>
            supabase.from("splits").update({ order_index: index }).eq("user_id", userId).eq("id", item.id)
          )
        );
      } catch (e) {
        console.log("onDragEnd error:", e);
      }
    },
    [userId, activeProgramId]
  );

  // ---------------- DELETE ----------------
  const deleteItem = useCallback(
    async (id: string, type: "program" | "split") => {
      if (!userId) return;

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setBusy(true);

      programsReqId.current += 1;
      splitsReqId.current += 1;

      try {
        if (type === "program") {
          const deletingActive = activeProgramId === id;

          const nextPrograms = programsRef.current.filter((p) => p.id !== id);
          setPrograms(nextPrograms);

          let nextActiveId: string | null = activeProgramId;

          if (deletingActive) {
            nextActiveId =
              nextPrograms.find((p) => p.is_active)?.id ?? (nextPrograms.length ? nextPrograms[0].id : null);
            setActiveProgramId(nextActiveId);
            setSplits([]);
          } else {
            if (activeProgramId && !nextPrograms.some((p) => p.id === activeProgramId)) {
              nextActiveId = nextPrograms.length ? nextPrograms[0].id : null;
              setActiveProgramId(nextActiveId);
              setSplits([]);
            }
          }

          const { error } = await supabase.from("programs").delete().eq("user_id", userId).eq("id", id);
          if (error) throw error;

          if (nextPrograms.length > 0 && nextActiveId) {
            await supabase.from("programs").update({ is_active: false }).eq("user_id", userId);
            await supabase.from("programs").update({ is_active: true }).eq("user_id", userId).eq("id", nextActiveId);
            setPrograms((prev) => prev.map((p) => ({ ...p, is_active: p.id === nextActiveId })));
          }

          if (nextPrograms.length === 0 && cacheId) {
            await cacheSetJson(cacheId, { programs: [], splitsByProgram: {}, activeProgramId: null });
          }

          if (nextActiveId) {
            splitsReqId.current += 1;
            await fetchSplits(nextActiveId);
          }

          return;
        }

        // split delete
        setSplits((prev) => prev.filter((s) => s.id !== id));
        const { error } = await supabase.from("splits").delete().eq("user_id", userId).eq("id", id);
        if (error) throw error;
      } catch (e: any) {
        console.log("deleteItem error:", e);
        Alert.alert("Delete failed", String(e?.message ?? "Unknown error"));
        programsReqId.current += 1;
        splitsReqId.current += 1;
        await fetchPrograms();
      } finally {
        setBusy(false);
      }
    },
    [userId, activeProgramId, fetchPrograms, fetchSplits, cacheId]
  );

  // ---------------- ADD / RENAME ----------------
  const handleModalConfirm = useCallback(async () => {
    if (!userId) return;

    const name = modal.value.trim();
    if (!name) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setBusy(true);

    programsReqId.current += 1;
    splitsReqId.current += 1;

    try {
      // rename
      if (modal.mode === "rename" && modal.targetId) {
        if (modal.type === "program") {
          const { data, error } = await supabase
            .from("programs")
            .update({ name })
            .eq("user_id", userId)
            .eq("id", modal.targetId)
            .select()
            .maybeSingle();

          if (error) throw error;

          setPrograms((prev) => prev.map((p) => (p.id === modal.targetId ? { ...p, name: data?.name ?? name } : p)));
        } else {
          const { data, error } = await supabase
            .from("splits")
            .update({ name })
            .eq("user_id", userId)
            .eq("id", modal.targetId)
            .select()
            .maybeSingle();

          if (error) throw error;

          setSplits((prev) => prev.map((s) => (s.id === modal.targetId ? { ...s, name: data?.name ?? name } : s)));
        }

        closeModal();
        return;
      }

      // create program
      if (modal.type === "program") {
        const makeActive = programsRef.current.length === 0;

        const { data, error } = await supabase
          .from("programs")
          .insert([{ name, is_active: makeActive, user_id: userId }])
          .select()
          .single();

        if (error) throw error;

        setPrograms((prev) => [...prev, data as Program]);

        if (makeActive) {
          setActiveProgramId((data as Program).id);
          setPrograms((prev) => prev.map((p) => ({ ...p, is_active: p.id === (data as Program).id })));
        }

        closeModal();
        return;
      }

      // create split
      if (!activeProgramId) {
        Alert.alert(
          "Select a program",
          programsRef.current.length > 1 ? "Select a program to view splits." : "Create a program first."
        );
        return;
      }

      const { data, error } = await supabase
        .from("splits")
        .insert([{ name, program_id: activeProgramId, order_index: splitsRef.current.length, user_id: userId }])
        .select()
        .single();

      if (error) throw error;

      setSplits((prev) => [...prev, data as Split]);
      closeModal();
    } catch (e: any) {
      console.log("handleModalConfirm error:", e);
      Alert.alert("Action failed", String(e?.message ?? "Unknown error"));
      await fetchPrograms();
    } finally {
      setBusy(false);
    }
  }, [userId, modal, activeProgramId, closeModal, fetchPrograms]);

  const showProgramsEmpty = programs.length === 0;
  const showSelectProgramHint = !activeProgramId && programs.length > 1;
  const showNoSplits = !activeProgramId || splits.length === 0;

  const header = useMemo(() => {
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
        <Text style={{ color: t.text, fontSize: 32, fontWeight: "900", marginBottom: 14 }}>Profile</Text>

        {/* PROGRAMS */}
        <View style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: t.mutedText }}>Programs</Text>

            <TouchableOpacity onPress={openCreateProgram} disabled={busy}>
              <Text style={{ color: t.link, fontWeight: "800" }}>+ Add Program</Text>
            </TouchableOpacity>
          </View>

          {showProgramsEmpty && (
            <View
              style={{
                backgroundColor: t.card,
                borderWidth: 1,
                borderColor: t.border,
                borderRadius: 14,
                padding: 16,
                alignItems: "center",
              }}
            >
              <Ionicons name="folder-open-outline" size={34} color={t.mutedText} />
              <Text style={{ color: t.text, fontSize: 16, marginTop: 10 }}>No programs yet</Text>
              <Text style={{ color: t.mutedText, marginTop: 6, textAlign: "center" }}>
                Create your first training program to get started.
              </Text>
            </View>
          )}

          {programs.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => activateProgram(p)}
              disabled={busy}
              style={{
                marginTop: 10,
                padding: 14,
                borderRadius: 14,
                backgroundColor: t.card,
                borderWidth: 1,
                borderColor: t.border,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ color: t.text, fontSize: 16 }} numberOfLines={1}>
                  {p.name}
                </Text>
              </View>

              {IS_IOS && (
                <InlineActions
                  onEdit={() => openRename(p, "program")}
                  onDelete={() => deleteItem(p.id, "program")}
                  border={t.border}
                  card={t.card}
                  mutedText={t.mutedText}
                />
              )}

              {p.is_active && (
                <View style={{ backgroundColor: t.link, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 10 }}>
                  <Text style={{ color: "white", fontSize: 12 }}>ACTIVE</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* SPLITS HEADER */}
        <View style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: t.mutedText }}>Splits</Text>

          <TouchableOpacity onPress={openCreateSplit} disabled={busy || !activeProgramId}>
            <Text style={{ color: activeProgramId ? t.link : t.mutedText, fontWeight: "800" }}>+ Add Split</Text>
          </TouchableOpacity>
        </View>

        {showSelectProgramHint && (
          <Text style={{ color: t.mutedText, marginBottom: 10 }}>Select a program to view splits.</Text>
        )}

        {showNoSplits && (
          <View
            style={{
              backgroundColor: t.card,
              borderWidth: 1,
              borderColor: t.border,
              borderRadius: 14,
              padding: 16,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Ionicons name="layers-outline" size={34} color={t.mutedText} />
            <Text style={{ color: t.text, fontSize: 16, marginTop: 10 }}>No splits yet</Text>
            <Text style={{ color: t.mutedText, marginTop: 6, textAlign: "center" }}>
              Add splits to organize your weekly workouts.
            </Text>
          </View>
        )}
      </View>
    );
  }, [
    t,
    busy,
    programs,
    showProgramsEmpty,
    showNoSplits,
    showSelectProgramHint,
    activeProgramId,
    activateProgram,
    openCreateProgram,
    openCreateSplit,
    openRename,
    deleteItem,
  ]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
        <StatusBar barStyle={t.primaryText === "#000000" ? "light-content" : "dark-content"} />

        <DraggableFlatList
          data={splits}
          keyExtractor={(item) => item.id}
          onDragEnd={onDragEnd}
          activationDistance={8}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item, drag, isActive }) => (
            <ScaleDecorator>
              <View style={{ paddingHorizontal: 16 }}>
                <TouchableOpacity
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    drag();
                  }}
                  delayLongPress={180}
                  disabled={busy}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    marginBottom: 10,
                    backgroundColor: isActive ? t.cardAlt : t.card,
                    borderWidth: 1,
                    borderColor: t.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ color: t.text }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={{ color: t.mutedText, marginTop: 4, fontSize: 12 }}>Long press to reorder</Text>
                  </View>

                  {IS_IOS && (
                    <InlineActions
                      onEdit={() => openRename(item, "split")}
                      onDelete={() => deleteItem(item.id, "split")}
                      border={t.border}
                      card={t.card}
                      mutedText={t.mutedText}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </ScaleDecorator>
          )}
        />

        {/* MODAL */}
        <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={closeModal}>
          <KeyboardAvoidingView behavior={IS_IOS ? "padding" : undefined} style={{ flex: 1 }}>
            <Pressable
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.7)",
              }}
              onPress={closeModal}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={{
                  width: "85%",
                  backgroundColor: t.card,
                  padding: 20,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: t.border,
                }}
              >
                <TextInput
                  autoFocus
                  placeholder={`${modal.mode === "rename" ? "Rename" : "New"} ${modal.type}`}
                  placeholderTextColor={t.mutedText}
                  value={modal.value}
                  onChangeText={(val) => setModal((prev) => ({ ...prev, value: val }))}
                  returnKeyType="done"
                  onSubmitEditing={handleModalConfirm}
                  style={{
                    color: t.text,
                    borderBottomWidth: 1,
                    borderBottomColor: t.inputBorder,
                    marginBottom: 18,
                    paddingBottom: 8,
                  }}
                />

                <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                  <TouchableOpacity onPress={closeModal} style={{ marginRight: 16 }} hitSlop={10} disabled={busy}>
                    <Text style={{ color: t.mutedText }}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleModalConfirm} hitSlop={10} disabled={busy}>
                    <Text style={{ color: t.link, fontWeight: "bold" }}>{modal.mode === "rename" ? "Save" : "Add"}</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
