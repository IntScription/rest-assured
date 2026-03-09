import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";

export default function NewExerciseScreen() {
  const router = useRouter();
  const t = useAppTheme();

  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [splits, setSplits] = useState<any[]>([]);
  const [selectedSplitId, setSelectedSplitId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  /* ===== AUTH ===== */
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data?.session?.user ?? null;
      if (!sessionUser) {
        router.replace("/(auth)/login");
        return;
      }
      setUser(sessionUser);
      setAuthLoading(false);
    };
    checkAuth();
  }, [router]);

  /* ===== FETCH USER SPLITS ===== */
  useEffect(() => {
    if (!user) return;

    const fetchUserSplits = async () => {
      try {
        const { data: program } = await supabase
          .from("programs")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (!program) return;

        const { data: splitsData, error } = await supabase
          .from("splits")
          .select("id, name, order_index")
          .eq("program_id", program.id)
          .order("order_index", { ascending: true });

        if (error) throw error;
        setSplits(splitsData || []);
      } catch (err) {
        console.error("Error fetching splits:", err);
      }
    };

    fetchUserSplits();
  }, [user]);

  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-");

  const handleCreate = async () => {
    if (loading) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("Exercise name is required.");
      return;
    }
    if (!selectedSplitId) {
      setErrorMsg("Please select a split.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    const generatedSlug = generateSlug(trimmedName);

    try {
      const { data: existing } = await supabase
        .from("exercises")
        .select("id, slug")
        .eq("slug", generatedSlug)
        .maybeSingle();

      if (existing) {
        router.push(`/exercise/${existing.slug}`);
        return;
      }

      const { data: newExercise, error: insertError } = await supabase
        .from("exercises")
        .insert({
          name: trimmedName,
          slug: generatedSlug,
          split_id: selectedSplitId,
          user_id: user.id,
        })
        .select()
        .maybeSingle();

      if (insertError) throw insertError;
      router.push(`/exercise/${newExercise.slug}`);
    } catch (err: any) {
      console.error("Error creating exercise:", err);
      setErrorMsg(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );

  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginBottom: 16 }}
        >
          <Text style={[styles.back, { color: t.link }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: t.text }]}>Create New Exercise</Text>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.label, { color: t.mutedText }]}>Exercise Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
            placeholder="Enter exercise name"
            placeholderTextColor={t.mutedText}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setSlug(generateSlug(text));
            }}
          />

          {slug ? <Text style={[styles.slug, { color: t.mutedText }]}>Slug: {slug}</Text> : null}

          <Text style={[styles.label, { color: t.mutedText }]}>Split</Text>
          {splits.length > 0 ? (
            <View style={styles.splitContainer}>
              {splits.map((split) => (
                <TouchableOpacity
                  key={split.id}
                  style={[
                    styles.splitOption,
                    { backgroundColor: t.cardAlt, borderColor: t.border },
                    selectedSplitId === split.id && { backgroundColor: t.success, borderColor: t.success },
                  ]}
                  onPress={() => setSelectedSplitId(split.id)}
                >
                  <Text
                    style={[
                      styles.splitText,
                      { color: t.text },
                      selectedSplitId === split.id && { color: "#fff", fontWeight: "800" },
                    ]}
                  >
                    {split.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={[styles.noSplits, { color: t.mutedText }]}>
              No splits found. Create a split first in your profile.
            </Text>
          )}

          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading}
            style={[styles.button, { backgroundColor: t.success }, loading && { opacity: 0.6 }]}
          >
            <Text style={[styles.buttonText, { color: "#fff" }]}>
              {loading ? "Creating..." : "Create Exercise"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 50 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  back: { fontSize: 16, textDecorationLine: "underline" },

  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },

  card: { padding: 20, borderRadius: 20, borderWidth: 1 },
  label: { fontSize: 14, marginTop: 12, marginBottom: 4 },
  input: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  slug: { marginTop: 6, fontSize: 12 },

  splitContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 8 },
  splitOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  splitText: {},
  noSplits: { fontSize: 12, marginTop: 6 },

  error: { color: "#dc2626", fontSize: 12, marginTop: 6 },
  button: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { fontWeight: "700", fontSize: 16 },
});
