import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
  type TextInputProps,
} from "react-native";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import {
  getOnboardingStep,
  isOnboardingActive,
  stopOnboarding,
} from "@/src/lib/onboarding";

type TutEntry = {
  id: string;
  user_id: string;
  exercise_id: string;
  tut_seconds: number;
  load_kg: number | null;
  sets: number;
  reps: number;
  rpe: number | null;
  rest_seconds: number | null;
  note: string | null;
  performed_on: string;
};

type ExerciseRecord = {
  id: string;
  name: string;
  slug: string;
};

type FormState = {
  tut: string;
  load: string;
  sets: string;
  reps: string;
  rpe: string;
  rest: string;
  note: string;
};

const INITIAL_FORM: FormState = {
  tut: "",
  load: "",
  sets: "",
  reps: "",
  rpe: "",
  rest: "",
  note: "",
};

const TREND_COLORS = {
  latest: "#3B82F6",
  highest: "#22C55E",
  normal: "#94A3B8",
};

const TOUR_HIGHLIGHT_GREEN = "#22C55E";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function getContrastTextColor(backgroundColor: string) {
  const normalized = backgroundColor.replace("#", "");

  if (normalized.length !== 6) return "#FFFFFF";

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.6 ? "#111111" : "#FFFFFF";
}

function formatSeconds(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0s";
  return `${Math.round(value)}s`;
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeAdvancedTourStep(value?: string) {
  if (value === "open_advanced" || value === "advanced-log") {
    return "advanced-log";
  }
  return value ?? "idle";
}

type InputProps = {
  t: ReturnType<typeof useAppTheme>;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: TextInputProps["keyboardType"];
  multiline?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
};

const Input = memo(function Input({
  t,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  multiline = false,
  onFocus,
  onBlur,
}: InputProps) {
  return (
    <TextInput
      style={[
        styles.input,
        {
          backgroundColor: t.background,
          borderColor: t.border,
          color: t.text,
        },
        multiline && styles.multilineInput,
      ]}
      placeholder={placeholder}
      placeholderTextColor={t.mutedText}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      multiline={multiline}
      onFocus={onFocus}
      onBlur={onBlur}
      textAlignVertical={multiline ? "top" : "center"}
      autoCorrect={false}
      autoCapitalize="none"
    />
  );
});

type MetaPillProps = {
  label: string;
  value: string;
  t: ReturnType<typeof useAppTheme>;
};

const MetaPill = memo(function MetaPill({ label, value, t }: MetaPillProps) {
  return (
    <View
      style={[
        styles.metaPill,
        { backgroundColor: t.cardAlt, borderColor: t.border },
      ]}
    >
      <Text style={[styles.metaPillLabel, { color: t.mutedText }]}>
        {label}
      </Text>
      <Text style={[styles.metaPillValue, { color: t.text }]}>{value}</Text>
    </View>
  );
});

type OverviewCardProps = {
  t: ReturnType<typeof useAppTheme>;
  latest: number;
  best: number;
  avg: number;
  total: number;
  recentTrendEntries: TutEntry[];
  trendMax: number;
  latestEntryId: string | null;
};

const OverviewCard = memo(function OverviewCard({
  t,
  latest,
  best,
  avg,
  total,
  recentTrendEntries,
  trendMax,
  latestEntryId,
}: OverviewCardProps) {
  const trendDisplayEntries = useMemo(
    () => recentTrendEntries.slice().reverse(),
    [recentTrendEntries]
  );

  return (
    <View
      style={[
        styles.overviewCard,
        {
          backgroundColor: t.card,
          borderColor: t.border,
        },
      ]}
    >
      <View style={styles.overviewHeaderRow}>
        <View style={styles.overviewTitleWrap}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>Overview</Text>
          <Text style={[styles.overviewSubtext, { color: t.mutedText }]}>
            Track your time under tension progress over time.
          </Text>
        </View>
        <View style={[styles.overviewBadge, { backgroundColor: t.cardAlt }]}>
          <Ionicons name="pulse-outline" size={16} color={t.primaryBg} />
        </View>
      </View>

      <View style={styles.overviewStatsGrid}>
        <View
          style={[
            styles.miniStatCard,
            { backgroundColor: t.cardAlt, borderColor: t.border },
          ]}
        >
          <Text style={[styles.miniStatLabel, { color: t.mutedText }]}>
            Latest
          </Text>
          <Text style={[styles.miniStatValue, { color: t.text }]}>
            {formatSeconds(latest)}
          </Text>
        </View>

        <View
          style={[
            styles.miniStatCard,
            { backgroundColor: t.cardAlt, borderColor: t.border },
          ]}
        >
          <Text style={[styles.miniStatLabel, { color: t.mutedText }]}>
            Best
          </Text>
          <Text style={[styles.miniStatValue, { color: t.text }]}>
            {formatSeconds(best)}
          </Text>
        </View>

        <View
          style={[
            styles.miniStatCard,
            { backgroundColor: t.cardAlt, borderColor: t.border },
          ]}
        >
          <Text style={[styles.miniStatLabel, { color: t.mutedText }]}>
            Average
          </Text>
          <Text style={[styles.miniStatValue, { color: t.text }]}>
            {formatSeconds(avg)}
          </Text>
        </View>

        <View
          style={[
            styles.miniStatCard,
            { backgroundColor: t.cardAlt, borderColor: t.border },
          ]}
        >
          <Text style={[styles.miniStatLabel, { color: t.mutedText }]}>
            Total
          </Text>
          <Text style={[styles.miniStatValue, { color: t.text }]}>
            {formatSeconds(total)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.trendCardInner,
          { backgroundColor: t.background, borderColor: t.border },
        ]}
      >
        <View style={styles.trendTitleRow}>
          <Text style={[styles.trendTitle, { color: t.text }]}>TUT Trend</Text>
          <Text style={[styles.trendHint, { color: t.mutedText }]}>
            Last {Math.max(recentTrendEntries.length, 1)} entries
          </Text>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: TREND_COLORS.latest }]}
            />
            <Text style={[styles.legendText, { color: t.mutedText }]}>
              Latest
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: TREND_COLORS.highest }]}
            />
            <Text style={[styles.legendText, { color: t.mutedText }]}>
              Highest
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: TREND_COLORS.normal }]}
            />
            <Text style={[styles.legendText, { color: t.mutedText }]}>
              Normal
            </Text>
          </View>
        </View>

        {trendDisplayEntries.length ? (
          <View style={styles.trendRow}>
            {trendDisplayEntries.map((entry) => {
              const isLatest = entry.id === latestEntryId;
              const isHighest = entry.tut_seconds === trendMax;

              let barColor = TREND_COLORS.normal;
              if (isHighest) {
                barColor = TREND_COLORS.highest;
              } else if (isLatest) {
                barColor = TREND_COLORS.latest;
              }

              const height = Math.max(
                18,
                Math.round((entry.tut_seconds / trendMax) * 90)
              );

              return (
                <View key={entry.id} style={styles.trendBarWrap}>
                  <Text style={[styles.trendTopValue, { color: t.mutedText }]}>
                    {Math.round(entry.tut_seconds)}
                  </Text>
                  <View
                    style={[
                      styles.trendBar,
                      {
                        height,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                  <Text style={[styles.trendLabel, { color: t.mutedText }]}>
                    {formatDateLabel(entry.performed_on).split(" ")[0]}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyTrend}>
            <Ionicons
              name="analytics-outline"
              size={18}
              color={t.mutedText}
              style={{ marginBottom: 6 }}
            />
            <Text style={[styles.emptyTrendText, { color: t.mutedText }]}>
              Save your first entry to see your TUT trend.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

type EntryCardProps = {
  item: TutEntry;
  t: ReturnType<typeof useAppTheme>;
  onEdit: (entry: TutEntry) => void;
  onDelete: (entryId: string) => void;
};

const EntryCard = memo(function EntryCard({
  item,
  t,
  onEdit,
  onDelete,
}: EntryCardProps) {
  const handleEditPress = useCallback(() => onEdit(item), [item, onEdit]);
  const handleDeletePress = useCallback(() => onDelete(item.id), [item.id, onDelete]);

  return (
    <View
      style={[
        styles.entryCard,
        {
          backgroundColor: t.card,
          borderColor: t.border,
        },
      ]}
    >
      <View style={styles.entryTopRow}>
        <View style={styles.entryTopLeft}>
          <Text style={[styles.entryTut, { color: t.text }]}>
            {formatSeconds(item.tut_seconds)}
          </Text>
          <Text style={[styles.entryDate, { color: t.mutedText }]}>
            {formatDateLabel(item.performed_on)}
          </Text>
        </View>

        <View style={styles.entryActions}>
          <Pressable
            onPress={handleEditPress}
            style={[styles.iconButton, { backgroundColor: t.cardAlt }]}
          >
            <Ionicons name="create-outline" size={16} color={t.text} />
          </Pressable>

          <Pressable
            onPress={handleDeletePress}
            style={[styles.iconButton, { backgroundColor: t.cardAlt }]}
          >
            <Ionicons name="trash-outline" size={16} color={t.danger} />
          </Pressable>
        </View>
      </View>

      <View style={styles.metaWrap}>
        <MetaPill label="Sets" value={String(item.sets)} t={t} />
        <MetaPill label="Reps" value={String(item.reps)} t={t} />
        {item.load_kg != null ? (
          <MetaPill label="Load" value={`${item.load_kg} kg`} t={t} />
        ) : null}
        {item.rpe != null ? (
          <MetaPill label="RPE" value={`${item.rpe}`} t={t} />
        ) : null}
        {item.rest_seconds != null ? (
          <MetaPill label="Rest" value={`${item.rest_seconds}s`} t={t} />
        ) : null}
      </View>

      {item.note ? (
        <View
          style={[
            styles.noteBox,
            { backgroundColor: t.cardAlt, borderColor: t.border },
          ]}
        >
          <Text style={[styles.noteLabel, { color: t.mutedText }]}>Notes</Text>
          <Text style={[styles.noteText, { color: t.text }]}>{item.note}</Text>
        </View>
      ) : null}
    </View>
  );
});

export default function AdvancedScreen() {
  const t = useAppTheme();
  const router = useRouter();

  const primaryButtonTextColor = useMemo(
    () => getContrastTextColor(t.primaryBg),
    [t.primaryBg]
  );

  const params = useLocalSearchParams<{
    slug?: string | string[];
    tourStep?: string | string[];
    tutorialProgramId?: string | string[];
    programId?: string | string[];
  }>();

  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const incomingTourStep = Array.isArray(params.tourStep)
    ? params.tourStep[0]
    : params.tourStep;
  const tutorialProgramId = Array.isArray(params.tutorialProgramId)
    ? params.tutorialProgramId[0]
    : params.tutorialProgramId;
  const fallbackProgramId = Array.isArray(params.programId)
    ? params.programId[0]
    : params.programId;

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState<string>("idle");
  const [finishingTour, setFinishingTour] = useState(false);

  const [exercise, setExercise] = useState<ExerciseRecord | null>(null);
  const [entries, setEntries] = useState<TutEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notesFocused, setNotesFocused] = useState(false);

  const listRef = useRef<FlatList<TutEntry>>(null);
  const noteScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadTour = async () => {
      try {
        const active = await isOnboardingActive();
        const storedStep = await getOnboardingStep();

        if (!mounted) return;
        setTourActive(active);
        setTourStep(normalizeAdvancedTourStep(incomingTourStep || storedStep));
      } catch (error) {
        console.log("loadTour error:", error);
      }
    };

    void loadTour();

    return () => {
      mounted = false;
    };
  }, [incomingTourStep]);

  useEffect(() => {
    return () => {
      if (noteScrollTimeoutRef.current) {
        clearTimeout(noteScrollTimeoutRef.current);
      }
    };
  }, []);

  const fetchExerciseAndEntries = useCallback(async () => {
    if (!slug) {
      setScreenError("Missing exercise slug.");
      setLoading(false);
      return;
    }

    let mounted = true;

    try {
      setLoading(true);
      setScreenError(null);

      const [
        {
          data: { user },
          error: userError,
        },
        { data: exerciseData, error: exerciseError },
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("exercises")
          .select("id, name, slug")
          .eq("slug", slug)
          .maybeSingle(),
      ]);

      if (!mounted) return;

      if (userError || !user) {
        setScreenError("You need to be signed in to use this feature.");
        setLoading(false);
        return;
      }

      setUserId(user.id);

      if (exerciseError) {
        console.error("Failed to fetch exercise:", exerciseError);
        setExercise(null);
        setEntries([]);
        setScreenError("Could not load exercise details.");
        setLoading(false);
        return;
      }

      if (!exerciseData) {
        setExercise(null);
        setEntries([]);
        setScreenError("Exercise not found.");
        setLoading(false);
        return;
      }

      const foundExercise = exerciseData as ExerciseRecord;
      setExercise(foundExercise);

      const { data: logData, error: logError } = await supabase
        .from("exercise_tut_logs")
        .select(
          "id, user_id, exercise_id, tut_seconds, load_kg, sets, reps, rpe, rest_seconds, note, performed_on"
        )
        .eq("exercise_id", foundExercise.id)
        .eq("user_id", user.id)
        .order("performed_on", { ascending: false });

      if (!mounted) return;

      if (logError) {
        console.error("Failed to fetch TUT logs:", logError);
        setEntries([]);
        setScreenError("Could not load TUT entries.");
        setLoading(false);
        return;
      }

      setEntries((logData as TutEntry[]) || []);
      setLoading(false);
    } catch (error) {
      if (!mounted) return;
      console.error("fetchExerciseAndEntries error:", error);
      setEntries([]);
      setScreenError("Something went wrong while loading this page.");
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [slug]);

  useEffect(() => {
    void fetchExerciseAndEntries();
  }, [fetchExerciseAndEntries]);

  const latest = entries[0]?.tut_seconds ?? 0;

  const best = useMemo(
    () => (entries.length ? Math.max(...entries.map((e) => e.tut_seconds)) : 0),
    [entries]
  );

  const avg = useMemo(
    () =>
      entries.length
        ? Math.round(
          entries.reduce((acc, e) => acc + e.tut_seconds, 0) / entries.length
        )
        : 0,
    [entries]
  );

  const total = useMemo(
    () => entries.reduce((acc, e) => acc + e.tut_seconds, 0),
    [entries]
  );

  const recentTrendEntries = useMemo(() => entries.slice(0, 6), [entries]);

  const trendMax = useMemo(
    () => Math.max(...recentTrendEntries.map((e) => e.tut_seconds), 1),
    [recentTrendEntries]
  );

  const latestEntryId = entries[0]?.id ?? null;

  const keyExtractor = useCallback((item: TutEntry) => item.id, []);

  const updateFormField = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => {
        if (prev[field] === value) return prev;
        return { ...prev, [field]: value };
      });
    },
    []
  );

  const resetForm = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setNotesFocused(false);
  }, []);

  const handleGoBack = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.push("/(tabs)");
  }, [router]);

  const finishTourToCleanup = useCallback(async () => {
    if (finishingTour) return;

    const resolvedProgramId = tutorialProgramId || fallbackProgramId;
    setFinishingTour(true);

    try {
      await stopOnboarding();
      setTourActive(false);
      setTourStep("done");

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      router.replace({
        pathname: "/welcome",
        params: {
          mode: "tour_cleanup",
          tutorialProgramId: resolvedProgramId,
        },
      });
    } catch (error) {
      console.error("finishTourToCleanup error:", error);
      Alert.alert(
        "Could not finish tour",
        "Your entry was saved, but the app could not move to the final step."
      );
    } finally {
      setFinishingTour(false);
    }
  }, [fallbackProgramId, finishingTour, router, tutorialProgramId]);

  const handleSave = useCallback(async () => {
    if (!exercise?.id) {
      Alert.alert("Missing exercise", "Could not determine which exercise to save.");
      return;
    }

    if (!userId) {
      Alert.alert("Not signed in", "Please sign in again and try once more.");
      return;
    }

    if (!form.tut.trim() || !form.sets.trim() || !form.reps.trim()) {
      Alert.alert("Missing fields", "Please enter TUT, sets, and reps.");
      return;
    }

    const tutSeconds = Number(form.tut);
    const sets = Number(form.sets);
    const reps = Number(form.reps);

    if (
      !Number.isFinite(tutSeconds) ||
      !Number.isFinite(sets) ||
      !Number.isFinite(reps) ||
      tutSeconds <= 0 ||
      sets <= 0 ||
      reps <= 0
    ) {
      Alert.alert(
        "Invalid values",
        "TUT, sets, and reps must be valid numbers greater than zero."
      );
      return;
    }

    const loadKg = form.load.trim() ? Number(form.load) : null;
    const rpe = form.rpe.trim() ? Number(form.rpe) : null;
    const restSeconds = form.rest.trim() ? Number(form.rest) : null;

    if (loadKg !== null && !Number.isFinite(loadKg)) {
      Alert.alert("Invalid load", "Please enter a valid load.");
      return;
    }

    if (rpe !== null && !Number.isFinite(rpe)) {
      Alert.alert("Invalid RPE", "Please enter a valid RPE.");
      return;
    }

    if (restSeconds !== null && !Number.isFinite(restSeconds)) {
      Alert.alert("Invalid rest", "Please enter valid rest seconds.");
      return;
    }

    setSaving(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const payload = {
      user_id: userId,
      exercise_id: exercise.id,
      tut_seconds: tutSeconds,
      load_kg: loadKg,
      sets,
      reps,
      rpe,
      rest_seconds: restSeconds,
      note: form.note.trim() ? form.note.trim() : null,
      performed_on: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from("exercise_tut_logs")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("exercise_tut_logs").insert(payload);
        if (error) throw error;
      }

      await fetchExerciseAndEntries();
      resetForm();

      if (tourActive && tourStep === "advanced-log") {
        await finishTourToCleanup();
      }
    } catch (error) {
      console.error("Failed to save TUT entry:", error);
      Alert.alert("Save failed", "Could not save your entry. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [
    editingId,
    exercise,
    fetchExerciseAndEntries,
    finishTourToCleanup,
    form.load,
    form.note,
    form.reps,
    form.rest,
    form.rpe,
    form.sets,
    form.tut,
    resetForm,
    tourActive,
    tourStep,
    userId,
  ]);

  const handleEdit = useCallback((entry: TutEntry) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setEditingId(entry.id);
    setForm({
      tut: String(entry.tut_seconds ?? ""),
      load: entry.load_kg == null ? "" : String(entry.load_kg),
      sets: String(entry.sets ?? ""),
      reps: String(entry.reps ?? ""),
      rpe: entry.rpe == null ? "" : String(entry.rpe),
      rest: entry.rest_seconds == null ? "" : String(entry.rest_seconds),
      note: entry.note ?? "",
    });

    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const handleDelete = useCallback(
    (entryId: string) => {
      Alert.alert("Delete entry?", "This TUT entry will be removed permanently.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning
              );

              const { error } = await supabase
                .from("exercise_tut_logs")
                .delete()
                .eq("id", entryId)
                .eq("user_id", userId ?? "");

              if (error) throw error;

              if (editingId === entryId) {
                resetForm();
              }

              await fetchExerciseAndEntries();
            } catch (error) {
              console.error("Failed to delete TUT entry:", error);
              Alert.alert("Delete failed", "Could not delete this entry.");
            }
          },
        },
      ]);
    },
    [editingId, fetchExerciseAndEntries, resetForm, userId]
  );

  const handleNoteFocus = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotesFocused(true);

    if (noteScrollTimeoutRef.current) {
      clearTimeout(noteScrollTimeoutRef.current);
    }

    noteScrollTimeoutRef.current = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: 430,
        animated: true,
      });
    }, 120);
  }, []);

  const handleNoteBlur = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotesFocused(false);
  }, []);

  const handleNoteChange = useCallback(
    (value: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      updateFormField("note", value);
    },
    [updateFormField]
  );

  const renderEntry = useCallback(
    ({ item }: { item: TutEntry }) => (
      <EntryCard item={item} t={t} onEdit={handleEdit} onDelete={handleDelete} />
    ),
    [handleDelete, handleEdit, t]
  );

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.headerRow}>
          <Pressable
            onPress={handleGoBack}
            style={[styles.backIcon, { backgroundColor: t.card }]}
          >
            <Ionicons name="chevron-back" size={20} color={t.text} />
          </Pressable>
        </View>

        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: t.text }]}>Time under tension</Text>
          <Text style={[styles.subtitle, { color: t.mutedText }]}>
            Log and review your TUT performance, notes, and progress in one place.
          </Text>
        </View>

        {tourActive && tourStep === "advanced-log" ? (
          <View
            style={[
              styles.tourBanner,
              {
                backgroundColor: t.card,
                borderColor: TOUR_HIGHLIGHT_GREEN,
              },
            ]}
          >
            <View
              style={[
                styles.tourIconWrap,
                { backgroundColor: t.cardAlt, borderColor: TOUR_HIGHLIGHT_GREEN },
              ]}
            >
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={TOUR_HIGHLIGHT_GREEN}
              />
            </View>
            <View style={styles.tourTextWrap}>
              <Text style={[styles.tourTitle, { color: t.text }]}>
                Fill this data to finish the tour
              </Text>
              <Text style={[styles.tourBody, { color: t.mutedText }]}>
                This page starts empty, which is expected. Add TUT, sets, reps,
                and any extras you want. After saving your first advanced entry,
                you’ll go straight to the final setup screen.
              </Text>
            </View>
          </View>
        ) : null}

        <OverviewCard
          t={t}
          latest={latest}
          best={best}
          avg={avg}
          total={total}
          recentTrendEntries={recentTrendEntries}
          trendMax={trendMax}
          latestEntryId={latestEntryId}
        />

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: t.card,
              borderColor: t.border,
            },
          ]}
        >
          <View style={styles.formHeaderRow}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>
              {editingId ? "Edit Entry" : "Manual Entry"}
            </Text>

            {editingId ? (
              <Pressable onPress={resetForm}>
                <Text style={[styles.clearText, { color: t.primaryBg }]}>
                  Cancel edit
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.rowInputs}>
            <View style={styles.inputCol}>
              <Input
                t={t}
                placeholder="TUT (sec)*"
                value={form.tut}
                onChangeText={(v) => updateFormField("tut", v)}
                keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
              />
            </View>

            <View style={styles.inputCol}>
              <Input
                t={t}
                placeholder="Load (kg)"
                value={form.load}
                onChangeText={(v) => updateFormField("load", v)}
                keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
              />
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={styles.inputCol}>
              <Input
                t={t}
                placeholder="Sets*"
                value={form.sets}
                onChangeText={(v) => updateFormField("sets", v)}
                keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
              />
            </View>

            <View style={styles.inputCol}>
              <Input
                t={t}
                placeholder="Reps*"
                value={form.reps}
                onChangeText={(v) => updateFormField("reps", v)}
                keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
              />
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={styles.inputCol}>
              <Input
                t={t}
                placeholder="RPE"
                value={form.rpe}
                onChangeText={(v) => updateFormField("rpe", v)}
                keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
              />
            </View>

            <View style={styles.inputCol}>
              <Input
                t={t}
                placeholder="Rest (sec)"
                value={form.rest}
                onChangeText={(v) => updateFormField("rest", v)}
                keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
              />
            </View>
          </View>

          {notesFocused && form.note.trim().length > 0 ? (
            <View
              style={[
                styles.notePreviewCard,
                {
                  backgroundColor: t.cardAlt,
                  borderColor: t.border,
                },
              ]}
            >
              <Text style={[styles.notePreviewLabel, { color: t.mutedText }]}>
                Live note preview
              </Text>
              <Text style={[styles.notePreviewText, { color: t.text }]}>
                {form.note}
              </Text>
            </View>
          ) : null}

          <Input
            t={t}
            placeholder="Notes"
            value={form.note}
            onChangeText={handleNoteChange}
            multiline
            keyboardType="default"
            onFocus={handleNoteFocus}
            onBlur={handleNoteBlur}
          />

          <Pressable
            onPress={handleSave}
            disabled={saving || finishingTour}
            style={[
              styles.saveButton,
              {
                backgroundColor:
                  saving || finishingTour ? t.border : t.primaryBg,
              },
            ]}
          >
            {saving || finishingTour ? (
              <ActivityIndicator color={primaryButtonTextColor} />
            ) : (
              <Text
                style={[
                  styles.saveButtonText,
                  { color: primaryButtonTextColor },
                ]}
              >
                {editingId ? "Update Entry" : "Save Entry"}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.entriesHeader}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>History</Text>
          <Text style={[styles.entriesCount, { color: t.mutedText }]}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </Text>
        </View>

        {entries.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={22}
              color={t.mutedText}
              style={{ marginBottom: 8 }}
            />
            <Text style={[styles.emptyTitle, { color: t.text }]}>
              No advanced entries yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: t.mutedText }]}>
              This empty page is normal. Save your first manual TUT log above.
            </Text>
          </View>
        ) : null}
      </>
    ),
    [
      t,
      handleGoBack,
      tourActive,
      tourStep,
      latest,
      best,
      avg,
      total,
      recentTrendEntries,
      trendMax,
      latestEntryId,
      editingId,
      resetForm,
      form.tut,
      form.load,
      form.sets,
      form.reps,
      form.rpe,
      form.rest,
      form.note,
      updateFormField,
      notesFocused,
      handleNoteChange,
      handleNoteFocus,
      handleNoteBlur,
      handleSave,
      saving,
      finishingTour,
      primaryButtonTextColor,
      entries.length,
    ]
  );

  const listFooter = useMemo(
    () => (
      <View style={styles.footerWrap}>
        <Text style={[styles.footerText, { color: t.mutedText }]}>
          Stay tuned for upcoming features and updates.
        </Text>
        <View style={{ height: 24 }} />
      </View>
    ),
    [t.mutedText]
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator color={t.primaryBg} />
      </SafeAreaView>
    );
  }

  if (screenError) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <Ionicons
          name="alert-circle-outline"
          size={28}
          color={t.danger}
          style={{ marginBottom: 10 }}
        />
        <Text style={[styles.errorTitle, { color: t.text }]}>{screenError}</Text>
        <Pressable
          onPress={handleGoBack}
          style={[styles.backButton, { backgroundColor: t.primaryBg }]}
        >
          <Text style={[styles.backButtonText, { color: primaryButtonTextColor }]}>
            Go Back
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: t.background }]}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={12}
      >
        <FlatList
          ref={listRef}
          data={entries}
          keyExtractor={keyExtractor}
          renderItem={renderEntry}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          removeClippedSubviews={Platform.OS === "android"}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={8}
          updateCellsBatchingPeriod={50}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardWrap: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 10,
  },
  backIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
    fontWeight: "500",
  },
  tourBanner: {
    borderWidth: 2,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tourIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
  },
  tourTextWrap: {
    flex: 1,
  },
  tourTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  tourBody: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  overviewCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
  },
  overviewHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  overviewTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  overviewSubtext: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: "500",
  },
  overviewBadge: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  overviewStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  miniStatCard: {
    width: "48%",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  miniStatLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  miniStatValue: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  trendCardInner: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  trendTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  trendTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  trendHint: {
    fontSize: 12,
    fontWeight: "600",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "600",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 130,
  },
  trendBarWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  trendTopValue: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 6,
  },
  trendBar: {
    width: 22,
    borderRadius: 999,
    marginBottom: 8,
  },
  trendLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  emptyTrend: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  emptyTrendText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  formHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  clearText: {
    fontSize: 13,
    fontWeight: "700",
  },
  rowInputs: {
    flexDirection: "row",
    gap: 10,
  },
  inputCol: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  multilineInput: {
    minHeight: 108,
    paddingTop: 14,
  },
  notePreviewCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  notePreviewLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  notePreviewText: {
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  entriesHeader: {
    marginTop: 4,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entriesCount: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  entryCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  entryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  entryTopLeft: {
    flex: 1,
    paddingRight: 12,
  },
  entryTut: {
    fontSize: 20,
    fontWeight: "700",
  },
  entryDate: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  entryActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  metaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  metaPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaPillLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  metaPillValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  noteBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 5,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 14,
  },
  backButton: {
    minWidth: 120,
    paddingHorizontal: 18,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  footerWrap: {
    paddingTop: 4,
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
