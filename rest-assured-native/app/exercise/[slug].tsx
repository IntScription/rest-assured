import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { useIsOnline } from "@/hooks/use-is-online";
import { cacheGetJson, cacheKey, cacheSetJson } from "@/src/lib/offline-cache";

export default function ExerciseScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const isOnline = useIsOnline();
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = params?.slug;

  const [user, setUser] = useState<any>(null);
  const [exercise, setExercise] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [newLog, setNewLog] = useState({ weight: "", reps: "", sets: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  /* ===== AUTH ===== */
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data?.session?.user ?? null;
      if (!sessionUser) {
        router.replace("/(auth)/login");
        return;
      }
      setUser(sessionUser);
    };
    getUser();
  }, [router]);

  /* ===== FETCH EXERCISE ===== */
  useEffect(() => {
    if (!slug || !user) return;

    const fetchExercise = async () => {
      try {
        const cached = await cacheGetJson<any>(cacheKey(["exercise", user.id, slug]));
        if (cached?.exercise) setExercise(cached.exercise);
        if (cached?.logs) setLogs(cached.logs);
        if (!isOnline && cached) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("exercises")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (error) console.error(error);

        setExercise(data || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchExercise();
  }, [slug, user, isOnline]);

  /* ===== FETCH LOGS ===== */
  useEffect(() => {
    if (!exercise || !user) return;

    const fetchLogs = async () => {
      if (!isOnline) return;
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("exercise_id", exercise.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) console.warn(error);
      setLogs(data || []);
      await cacheSetJson(cacheKey(["exercise", user.id, slug]), { exercise, logs: data || [] });
    };

    fetchLogs();
  }, [exercise, user, isOnline, slug]);

  /* ===== HANDLERS ===== */
  const handleChange = (field: "weight" | "reps" | "sets", value: string) =>
    setNewLog((prev) => ({ ...prev, [field]: value }));

  const calculateVolume = () => {
    const w = parseFloat(newLog.weight) || 0;
    const r = parseInt(newLog.reps) || 0;
    const s = parseInt(newLog.sets) || 0;
    return Math.max(1, w) * r * s;
  };

  const handleSave = async () => {
    if (!exercise || !user) return;

    const w = parseFloat(newLog.weight) || 0;
    const r = parseInt(newLog.reps) || 0;
    const s = parseInt(newLog.sets) || 0;
    const volume = Math.max(1, w) * r * s;

    const { data, error } = await supabase
      .from("logs")
      .insert([{ weight: w, reps: r, sets: s, exercise_id: exercise.id, user_id: user.id, volume }])
      .select()
      .maybeSingle();

    if (error) console.error(error);
    else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLogs((prev) => [...prev, data]);
      setNewLog({ weight: "", reps: "", sets: "" });
      setEditingId(null);
    }
  };

  const handleEdit = (log: any) => {
    setEditingId(log.id);
    setNewLog({ weight: log.weight.toString(), reps: log.reps.toString(), sets: log.sets.toString() });
  };

  const handleUpdate = async () => {
    if (!exercise || !editingId) return;

    const w = parseFloat(newLog.weight) || 0;
    const r = parseInt(newLog.reps) || 0;
    const s = parseInt(newLog.sets) || 0;
    const volume = Math.max(1, w) * r * s;

    const { data, error } = await supabase
      .from("logs")
      .update({ weight: w, reps: r, sets: s, volume })
      .eq("id", editingId)
      .select()
      .maybeSingle();

    if (error) console.error(error);
    else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLogs((prev) => prev.map((l) => (l.id === editingId ? data : l)));
      setNewLog({ weight: "", reps: "", sets: "" });
      setEditingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("logs").delete().eq("id", id);
    if (error) console.error(error);
    else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    }
  };

  /* ===== DASHBOARD METRICS ===== */
  const dashboardMetrics = logs.reduce(
    (acc, log) => {
      acc.totalVolume += log.volume;
      acc.totalReps += log.reps * log.sets;
      acc.totalSets += log.sets;
      acc.prWeight = Math.max(acc.prWeight, log.weight || 0);
      return acc;
    },
    { prWeight: 0, totalVolume: 0, totalReps: 0, totalSets: 0 }
  );

  if (loading)
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <Text style={{ color: t.text }}>Loading...</Text>
      </SafeAreaView>
    );

  if (!exercise)
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <Text style={{ color: t.text }}>Exercise not found</Text>
        <TouchableOpacity onPress={() => router.push("/")} style={{ marginTop: 12 }}>
          <Text style={{ color: t.link, fontWeight: "600" }}>← Back Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={t.primaryText === "#000000" ? "light-content" : "dark-content"} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: t.link }]}>← Back</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: t.text }]}>{exercise.name}</Text>

      {/* DASHBOARD */}
      <View style={styles.dashboard}>
        <View style={[styles.metricBox, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.metricLabel, { color: t.mutedText }]}>PR Weight</Text>
          <Text style={[styles.metricValue, { color: t.text }]}>{dashboardMetrics.prWeight || "Bodyweight"}</Text>
        </View>
        <View style={[styles.metricBox, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.metricLabel, { color: t.mutedText }]}>Total Volume</Text>
          <Text style={[styles.metricValue, { color: t.text }]}>{dashboardMetrics.totalVolume}</Text>
        </View>
        <View style={[styles.metricBox, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.metricLabel, { color: t.mutedText }]}>Total Reps</Text>
          <Text style={[styles.metricValue, { color: t.text }]}>{dashboardMetrics.totalReps}</Text>
        </View>
        <View style={[styles.metricBox, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.metricLabel, { color: t.mutedText }]}>Total Sets</Text>
          <Text style={[styles.metricValue, { color: t.text }]}>{dashboardMetrics.totalSets}</Text>
        </View>
      </View>

      {/* NEW/EDIT FORM */}
      <View style={[styles.form, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.formTitle, { color: t.text }]}>{editingId ? "Edit Log" : "New Log"}</Text>
        <View style={styles.inputRow}>
          <TextInput
            placeholder="Weight"
            placeholderTextColor="#ccc"
            keyboardType="numeric"
            value={newLog.weight}
            onChangeText={(text) => handleChange("weight", text)}
            style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
          />
          <TextInput
            placeholder="Reps"
            placeholderTextColor="#ccc"
            keyboardType="numeric"
            value={newLog.reps}
            onChangeText={(text) => handleChange("reps", text)}
            style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
          />
          <TextInput
            placeholder="Sets"
            placeholderTextColor="#ccc"
            keyboardType="numeric"
            value={newLog.sets}
            onChangeText={(text) => handleChange("sets", text)}
            style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
          />
          <Text style={[styles.volume, { color: t.mutedText }]}>Vol: {calculateVolume()}</Text>
          <TouchableOpacity
            onPress={editingId ? handleUpdate : handleSave}
            style={[styles.saveBtn, { backgroundColor: editingId ? t.link : t.success }]}
          >
            <Text style={styles.saveText}>{editingId ? "Update" : "Save"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* LOG LIST */}
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={[styles.logCard, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.logText, { color: t.text }]}>
              {(item.weight || "Bodyweight")} kg × {item.reps} × {item.sets} sets
            </Text>
            <View style={styles.logBtns}>
              <TouchableOpacity onPress={() => handleEdit(item)} style={[styles.editBtn, { backgroundColor: t.secondaryBg }]}>
                <Text style={{ color: t.secondaryText, fontWeight: "700" }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={[styles.deleteBtn, { backgroundColor: t.danger }]}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", paddingTop: 8, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "bold", textAlign: "center", marginBottom: 12 },
  backBtn: { padding: 8 },
  backText: { fontWeight: "600" },
  dashboard: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12, justifyContent: "space-between" },
  metricBox: { padding: 12, borderRadius: 16, width: "48%", marginBottom: 8, borderWidth: 1 },
  metricLabel: { fontSize: 12 },
  metricValue: { fontSize: 16, fontWeight: "600" },
  form: { borderRadius: 20, padding: 12, marginBottom: 12, borderWidth: 1 },
  formTitle: { fontWeight: "600", fontSize: 16, marginBottom: 8 },
  inputRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  input: { padding: 10, borderRadius: 12, flex: 1, borderWidth: 1 },
  volume: { fontWeight: "600" },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  saveText: { color: "white", fontWeight: "600" },
  logCard: { padding: 16, borderRadius: 16, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1 },
  logText: { fontSize: 16, fontWeight: "600" },
  logBtns: { flexDirection: "row", gap: 8 },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
});
