import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";

type GlobalProgramRow = {
  id: string;
  program_id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  category: string | null;
  like_count: number;
  import_count: number;
  published_by_user_id: string;
  profiles?: {
    username: string | null;
  } | null;
};

type SplitPreview = {
  id: string;
  name: string;
  order_index: number;
};

type ExercisePreview = {
  id: string;
  split_id: string;
  name: string;
  target_sets: number | null;
  target_reps: string | null;
  order_index: number;
};

export default function GlobalProgramDetailScreen() {
  const t = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [importBusy, setImportBusy] = useState(false);
  const [program, setProgram] = useState<GlobalProgramRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [splits, setSplits] = useState<SplitPreview[]>([]);
  const [exercises, setExercises] = useState<ExercisePreview[]>([]);

  const grouped = useMemo(() => {
    return splits.map((split) => ({
      ...split,
      exercises: exercises
        .filter((exercise) => exercise.split_id === split.id)
        .sort((a, b) => a.order_index - b.order_index),
    }));
  }, [splits, exercises]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserId(user?.id ?? null);

      const { data: globalRow, error: globalError } = await supabase
        .from("global_programs")
        .select("*, profiles:published_by_user_id(username)")
        .eq("id", id)
        .maybeSingle();

      if (globalError || !globalRow) {
        setLoading(false);
        return;
      }

      setProgram(globalRow as GlobalProgramRow);

      const [splitsRes, exercisesRes] = await Promise.all([
        supabase
          .from("splits")
          .select("*")
          .eq("program_id", globalRow.program_id)
          .order("order_index", { ascending: true }),
        supabase
          .from("exercises")
          .select("*")
          .eq("user_id", globalRow.published_by_user_id)
          .order("order_index", { ascending: true }),
      ]);

      const splitRows = (splitsRes.data ?? []) as SplitPreview[];
      const splitIds = new Set(splitRows.map((s) => s.id));
      const exerciseRows = ((exercisesRes.data ?? []) as ExercisePreview[]).filter((e) =>
        splitIds.has(e.split_id)
      );

      setSplits(splitRows);
      setExercises(exerciseRows);
      setLoading(false);
    };

    void load();
  }, [id]);

  const handleImport = async () => {
    if (!program || !userId) {
      Alert.alert("Sign in required", "Please sign in to import this program.");
      return;
    }

    try {
      setImportBusy(true);

      const { data: sourceProgram, error: sourceProgramError } = await supabase
        .from("programs")
        .select("*")
        .eq("id", program.program_id)
        .maybeSingle();

      if (sourceProgramError) throw sourceProgramError;
      if (!sourceProgram) throw new Error("Source program not found.");

      const { data: sourceSplits, error: splitsError } = await supabase
        .from("splits")
        .select("*")
        .eq("program_id", program.program_id)
        .order("order_index", { ascending: true });

      if (splitsError) throw splitsError;

      const splitIds = new Set((sourceSplits ?? []).map((split: any) => split.id));

      const { data: sourceExercises, error: exercisesError } = await supabase
        .from("exercises")
        .select("*")
        .eq("user_id", sourceProgram.user_id)
        .order("order_index", { ascending: true });

      if (exercisesError) throw exercisesError;

      const filteredExercises = ((sourceExercises ?? []) as any[]).filter((exercise) =>
        splitIds.has(exercise.split_id)
      );

      const { data: importedProgram, error: createProgramError } = await supabase
        .from("programs")
        .insert({
          user_id: userId,
          name: program.title,
          is_active: false,
        })
        .select("*")
        .single();

      if (createProgramError) throw createProgramError;

      const splitIdMap = new Map<string, string>();

      for (const split of sourceSplits ?? []) {
        const { data: createdSplit, error: createSplitError } = await supabase
          .from("splits")
          .insert({
            user_id: userId,
            program_id: importedProgram.id,
            name: split.name,
            order_index: split.order_index,
          })
          .select("*")
          .single();

        if (createSplitError) throw createSplitError;
        splitIdMap.set(split.id, createdSplit.id);
      }

      for (const exercise of filteredExercises) {
        const mappedSplitId = splitIdMap.get(exercise.split_id);
        if (!mappedSplitId) continue;

        const { error: createExerciseError } = await supabase.from("exercises").insert({
          user_id: userId,
          split_id: mappedSplitId,
          name: exercise.name,
          target_sets: exercise.target_sets,
          target_reps: exercise.target_reps,
          order_index: exercise.order_index,
          notes: exercise.notes,
        });

        if (createExerciseError) throw createExerciseError;
      }

      const { error: updateError } = await supabase
        .from("global_programs")
        .update({ import_count: (program.import_count ?? 0) + 1 })
        .eq("id", program.id);

      if (updateError) throw updateError;

      setProgram((prev) =>
        prev ? { ...prev, import_count: (prev.import_count ?? 0) + 1 } : prev
      );

      Alert.alert("Imported", "Program imported into Train.");
    } catch (err: any) {
      Alert.alert("Could not import program", err?.message ?? "Please try again.");
    } finally {
      setImportBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.text} />
      </SafeAreaView>
    );
  }

  if (!program) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <Text style={{ color: t.text, fontWeight: "800" }}>Program not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.background }]} edges={["top"]}>
      <Stack.Screen
        options={{
          title: program.title,
          headerShown: true,
          headerStyle: { backgroundColor: t.background },
          headerTintColor: t.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.heroCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>{program.title}</Text>
          <Text style={[styles.meta, { color: t.mutedText }]}>
            @{program.profiles?.username ?? "user"} · {program.difficulty ?? "mixed"} ·{" "}
            {program.category ?? "general"}
          </Text>
          {program.description ? (
            <Text style={[styles.description, { color: t.mutedText }]}>
              {program.description}
            </Text>
          ) : null}

          <View style={styles.statsRow}>
            <Text style={[styles.stat, { color: t.mutedText }]}>
              {program.import_count} imports
            </Text>
            <Text style={[styles.stat, { color: t.mutedText }]}>
              {program.like_count} likes
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            disabled={importBusy}
            onPress={() => void handleImport()}
            style={[styles.importButton, { backgroundColor: t.link, opacity: importBusy ? 0.7 : 1 }]}
          >
            {importBusy ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="white" />
                <Text style={styles.importButtonText}>Import to Train</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {grouped.map((split) => (
          <View
            key={split.id}
            style={[styles.splitCard, { backgroundColor: t.card, borderColor: t.border }]}
          >
            <Text style={[styles.splitTitle, { color: t.text }]}>{split.name}</Text>

            {split.exercises.length > 0 ? (
              split.exercises.map((exercise) => (
                <View
                  key={exercise.id}
                  style={[styles.exerciseRow, { backgroundColor: t.cardAlt, borderColor: t.border }]}
                >
                  <Text style={[styles.exerciseName, { color: t.text }]}>{exercise.name}</Text>
                  <Text style={[styles.exerciseMeta, { color: t.mutedText }]}>
                    {exercise.target_sets ? `${exercise.target_sets} sets` : "Sets not set"}
                    {exercise.target_reps ? ` · ${exercise.target_reps}` : ""}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyText, { color: t.mutedText }]}>No exercises</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 14,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  meta: {
    marginTop: 6,
    fontSize: 13.5,
    lineHeight: 19,
  },
  description: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 12,
  },
  stat: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  importButton: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  importButtonText: {
    color: "white",
    fontWeight: "800",
  },
  splitCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  splitTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  exerciseRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: "800",
  },
  exerciseMeta: {
    marginTop: 4,
    fontSize: 12.5,
  },
  emptyText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
});
