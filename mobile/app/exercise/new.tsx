import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { cacheGetJson, cacheKey, cacheSetJson } from "@/src/lib/offline-cache";
import OnboardingBanner from "@/src/components/OnboardingBanner";
import {
  getOnboardingStep,
  isOnboardingActive,
  setOnboardingStep,
} from "@/src/lib/onboarding";

type SplitItem = {
  id: string;
  name: string;
  order_index: number;
  program_id?: string | null;
};

type ExistingExerciseLite = {
  id: string;
  name: string;
  slug: string | null;
  split_id: string | null;
  created_at?: string | null;
};

const MAX_NAME_LENGTH = 60;
const DUPLICATE_CHECK_DELAY = 220;

const SUGGESTED_EXERCISES = [
  "Bench Press",
  "Incline Dumbbell Press",
  "Overhead Press",
  "Lateral Raise",
  "Tricep Pushdown",
  "Pull-Up",
  "Lat Pulldown",
  "Barbell Row",
  "Pendlay Row",
  "Face Pull",
  "Bicep Curl",
  "Hammer Curl",
  "Squat",
  "Romanian Deadlift",
  "Leg Press",
  "Leg Curl",
  "Leg Extension",
  "Calf Raise",
  "Dead Hang",
];

function getFirstParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizeExerciseName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function titleCaseWords(value: string) {
  return normalizeExerciseName(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function generateSlug(value: string) {
  return normalizeExerciseName(value)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function normalizeForDuplicateCheck(value: string) {
  return normalizeExerciseName(value).toLowerCase();
}

function getUniqueSlug(baseSlug: string, existingExercises: ExistingExerciseLite[]) {
  const used = new Set(
    existingExercises
      .map((exercise) => exercise.slug)
      .filter((slug): slug is string => typeof slug === "string" && slug.length > 0)
  );

  if (!used.has(baseSlug)) return baseSlug;

  let i = 2;
  while (used.has(`${baseSlug}-${i}`)) i += 1;
  return `${baseSlug}-${i}`;
}

function getSplitBasedSuggestions(splitName: string | undefined | null) {
  const lower = (splitName ?? "").toLowerCase();

  if (
    lower.includes("push") ||
    lower.includes("chest") ||
    lower.includes("shoulder") ||
    lower.includes("tricep")
  ) {
    return [
      "Bench Press",
      "Incline Dumbbell Press",
      "Overhead Press",
      "Lateral Raise",
      "Tricep Pushdown",
      "Dips",
    ];
  }

  if (lower.includes("pull") || lower.includes("back") || lower.includes("bicep")) {
    return [
      "Pull-Up",
      "Lat Pulldown",
      "Barbell Row",
      "Pendlay Row",
      "Face Pull",
      "Hammer Curl",
    ];
  }

  if (
    lower.includes("leg") ||
    lower.includes("quad") ||
    lower.includes("hamstring") ||
    lower.includes("glute") ||
    lower.includes("calf")
  ) {
    return [
      "Squat",
      "Romanian Deadlift",
      "Leg Press",
      "Leg Curl",
      "Leg Extension",
      "Calf Raise",
    ];
  }

  if (lower.includes("core") || lower.includes("abs")) {
    return ["Dragon Flag", "Hanging Knee Raise", "Cable Crunch", "Plank", "L-Sit", "Ab Wheel"];
  }

  return SUGGESTED_EXERCISES.slice(0, 8);
}

export default function NewExerciseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    splitId?: string | string[];
    splitName?: string | string[];
    tourStep?: string | string[];
    tutorialProgramId?: string | string[];
    programId?: string | string[];
  }>();
  const t = useAppTheme();

  const inputRef = useRef<TextInput>(null);
  const mountedRef = useRef(true);

  const incomingTourStep = getFirstParam(params.tourStep);
  const tutorialProgramId = getFirstParam(params.tutorialProgramId);
  const fallbackProgramId = getFirstParam(params.programId);
  const preferredSplitId = getFirstParam(params.splitId).trim();
  const preferredSplitName = getFirstParam(params.splitName).trim();
  const routeProgramId = tutorialProgramId || fallbackProgramId || "";

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState<string>("idle");

  const [user, setUser] = useState<{ id: string } | null>(null);
  const [resolvedProgramId, setResolvedProgramId] = useState<string>(routeProgramId);

  const [name, setName] = useState("");
  const [splits, setSplits] = useState<SplitItem[]>([]);
  const [selectedSplitId, setSelectedSplitId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [splitsLoading, setSplitsLoading] = useState(true);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);

  const [allUserExercises, setAllUserExercises] = useState<ExistingExerciseLite[]>([]);
  const [existingExercises, setExistingExercises] = useState<ExistingExerciseLite[]>([]);
  const [recentExercises, setRecentExercises] = useState<ExistingExerciseLite[]>([]);
  const [duplicateMatch, setDuplicateMatch] = useState<ExistingExerciseLite | null>(null);
  const [forceCreateDuplicate, setForceCreateDuplicate] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const splitCacheKey = useMemo(() => {
    if (!user?.id || !resolvedProgramId) return null;
    return cacheKey(["new-exercise", "last-split", user.id, resolvedProgramId]);
  }, [user?.id, resolvedProgramId]);

  const normalizedName = useMemo(() => normalizeExerciseName(name), [name]);
  const prettyName = useMemo(() => titleCaseWords(name), [name]);
  const slugBase = useMemo(() => generateSlug(name), [name]);

  const selectedSplit = useMemo(
    () => splits.find((split) => split.id === selectedSplitId) ?? null,
    [splits, selectedSplitId]
  );

  const splitSuggestions = useMemo(
    () => getSplitBasedSuggestions(selectedSplit?.name ?? preferredSplitName),
    [selectedSplit?.name, preferredSplitName]
  );

  const recentSuggestionNames = useMemo(
    () => recentExercises.map((exercise) => exercise.name),
    [recentExercises]
  );

  const bestForSplitNames = useMemo(() => {
    const seen = new Set(recentSuggestionNames.map((item) => normalizeForDuplicateCheck(item)));
    return splitSuggestions.filter((item) => {
      const normalized = normalizeForDuplicateCheck(item);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [recentSuggestionNames, splitSuggestions]);

  const fallbackSuggestionNames = useMemo(() => {
    const seen = new Set(
      [...recentSuggestionNames, ...bestForSplitNames].map((item) => normalizeForDuplicateCheck(item))
    );
    return SUGGESTED_EXERCISES.filter((item) => {
      const normalized = normalizeForDuplicateCheck(item);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    }).slice(0, 8);
  }, [bestForSplitNames, recentSuggestionNames]);

  const canSubmit =
    normalizedName.length > 0 && selectedSplitId.length > 0 && !loading && !splitsLoading;

  const readySlug = useMemo(() => {
    if (!slugBase) return "";
    return getUniqueSlug(slugBase, allUserExercises);
  }, [allUserExercises, slugBase]);

  const resetFeedback = useCallback(() => {
    setSubmitAttempted(false);
    setStatusMsg("");
    setErrorMsg("");
    setCreateSuccess(false);
  }, []);

  const focusInputSoon = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleNameChange = useCallback(
    (value: string) => {
      const next = value.replace(/^\s+/, "");
      setName(next);
      resetFeedback();
    },
    [resetFeedback]
  );

  const clearName = useCallback(() => {
    setName("");
    resetFeedback();
    focusInputSoon();
  }, [focusInputSoon, resetFeedback]);

  const handleUseSuggestion = useCallback(
    (value: string) => {
      setName(titleCaseWords(value));
      resetFeedback();
      focusInputSoon();
    },
    [focusInputSoon, resetFeedback]
  );

  const handleRenameSlightly = useCallback(() => {
    const base = prettyName || normalizedName || "Exercise";
    setName(titleCaseWords(`${base} 2`));
    setErrorMsg("");
    setStatusMsg("Tweaked the name so you can create a variation.");
    focusInputSoon();
  }, [focusInputSoon, normalizedName, prettyName]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadTour = async () => {
      try {
        const [active, storedStep] = await Promise.all([
          isOnboardingActive(),
          getOnboardingStep(),
        ]);

        if (!mountedRef.current) return;
        setTourActive(active);
        setTourStep(incomingTourStep || storedStep || "idle");
      } catch (error) {
        console.log("loadTour error:", error);
      }
    };

    void loadTour();
  }, [incomingTourStep]);

  useEffect(() => {
    const loadUserAndProgram = async () => {
      setAuthLoading(true);

      const {
        data: { user: currentUser },
        error,
      } = await supabase.auth.getUser();

      if (!mountedRef.current) return;

      if (error || !currentUser) {
        setUser(null);
        setErrorMsg("You need to be signed in to create exercises.");
        setAuthLoading(false);
        return;
      }

      setUser({ id: currentUser.id });

      let nextProgramId = routeProgramId;

      if (!nextProgramId) {
        const { data: activeProgram, error: activeProgramError } = await supabase
          .from("programs")
          .select("id")
          .eq("user_id", currentUser.id)
          .eq("is_active", true)
          .maybeSingle();

        if (!mountedRef.current) return;
        if (activeProgramError) {
          setResolvedProgramId("");
          setErrorMsg("Could not load the active program.");
          setAuthLoading(false);
          return;
        }

        nextProgramId = activeProgram?.id ?? "";
      }

      if (!mountedRef.current) return;

      setResolvedProgramId(nextProgramId);
      setErrorMsg(nextProgramId ? "" : "No active program found.");
      setAuthLoading(false);
    };

    void loadUserAndProgram();
  }, [routeProgramId]);

  useEffect(() => {
    if (!user?.id) return;

    const loadSplitsAndExercises = async () => {
      setSplitsLoading(true);

      try {
        const exercisesQuery = supabase
          .from("exercises")
          .select("id, name, slug, split_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        const splitsQuery = (resolvedProgramId
          ? supabase
            .from("splits")
            .select("id, name, order_index, program_id")
            .eq("user_id", user.id)
            .eq("program_id", resolvedProgramId)
          : supabase
            .from("splits")
            .select("id, name, order_index, program_id")
            .eq("user_id", user.id)
        ).order("order_index", { ascending: true });

        const [exerciseResult, splitResult] = await Promise.all([exercisesQuery, splitsQuery]);

        if (!mountedRef.current) return;
        if (exerciseResult.error) throw exerciseResult.error;
        if (splitResult.error) throw splitResult.error;

        const safeAllExercises = (exerciseResult.data ?? []) as ExistingExerciseLite[];
        const safeSplits = (splitResult.data ?? []) as SplitItem[];
        const splitIds = new Set(safeSplits.map((split) => split.id));

        const programExercises = safeAllExercises.filter(
          (exercise) => !!exercise.split_id && splitIds.has(exercise.split_id)
        );

        setAllUserExercises(safeAllExercises);
        setSplits(safeSplits);
        setExistingExercises(programExercises);

        const recentByName = new Map<string, ExistingExerciseLite>();
        for (const exercise of programExercises) {
          const key = normalizeForDuplicateCheck(exercise.name);
          if (!recentByName.has(key)) recentByName.set(key, exercise);
        }
        setRecentExercises(Array.from(recentByName.values()).slice(0, 6));

        const cachedSplitId = splitCacheKey ? await cacheGetJson<string>(splitCacheKey) : null;
        if (!mountedRef.current) return;

        const nextSelectedSplitId =
          (preferredSplitId && safeSplits.some((s) => s.id === preferredSplitId) && preferredSplitId) ||
          (cachedSplitId && safeSplits.some((s) => s.id === cachedSplitId) && cachedSplitId) ||
          safeSplits[0]?.id ||
          "";

        setSelectedSplitId(nextSelectedSplitId);

        if (safeSplits.length === 0) {
          setStatusMsg("");
          setErrorMsg("Create a split in this program first before adding an exercise.");
        } else {
          setErrorMsg("");
        }
      } catch (error) {
        console.error("loadSplitsAndExercises error:", error);
        if (!mountedRef.current) return;
        setSplits([]);
        setAllUserExercises([]);
        setExistingExercises([]);
        setRecentExercises([]);
        setErrorMsg("Could not load your splits and exercises.");
      } finally {
        if (mountedRef.current) setSplitsLoading(false);
      }
    };

    void loadSplitsAndExercises();
  }, [preferredSplitId, resolvedProgramId, splitCacheKey, user?.id]);

  useEffect(() => {
    if (!splitCacheKey || !selectedSplitId) return;
    void cacheSetJson(splitCacheKey, selectedSplitId);
  }, [selectedSplitId, splitCacheKey]);

  useEffect(() => {
    if (!normalizedName || !selectedSplitId) {
      setDuplicateMatch(null);
      setForceCreateDuplicate(false);
      setDuplicateLoading(false);
      return;
    }

    setDuplicateLoading(true);

    const timeout = setTimeout(() => {
      const normalized = normalizeForDuplicateCheck(normalizedName);
      const exactMatch =
        existingExercises.find(
          (exercise) =>
            normalizeForDuplicateCheck(exercise.name) === normalized &&
            exercise.split_id === selectedSplitId
        ) ?? null;

      if (!mountedRef.current) return;
      setDuplicateMatch(exactMatch);
      setForceCreateDuplicate(false);
      setDuplicateLoading(false);
    }, DUPLICATE_CHECK_DELAY);

    return () => clearTimeout(timeout);
  }, [existingExercises, normalizedName, selectedSplitId]);

  const handleCreate = useCallback(
    async (mode: "open" | "stay" = "open") => {
      Keyboard.dismiss();
      setSubmitAttempted(true);
      setStatusMsg("");
      setErrorMsg("");
      setCreateSuccess(false);

      if (!user?.id) {
        setErrorMsg("You need to be signed in to create an exercise.");
        return;
      }

      if (!resolvedProgramId) {
        setErrorMsg("No active program found.");
        return;
      }

      if (!normalizedName) {
        setErrorMsg("Enter an exercise name.");
        return;
      }

      if (normalizedName.length > MAX_NAME_LENGTH) {
        setErrorMsg(`Exercise name must be ${MAX_NAME_LENGTH} characters or less.`);
        return;
      }

      if (!selectedSplitId) {
        setErrorMsg("Select a split first.");
        return;
      }

      if (duplicateMatch && !forceCreateDuplicate) {
        setErrorMsg("This exercise already exists in this split.");
        return;
      }

      const baseSlug = slugBase || generateSlug(normalizedName);
      if (!baseSlug) {
        setErrorMsg("Please use letters or numbers in the exercise name.");
        return;
      }

      const finalName = prettyName || normalizedName;
      const finalSlug = getUniqueSlug(baseSlug, allUserExercises);

      setLoading(true);

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const payload = {
          user_id: user.id,
          split_id: selectedSplitId,
          name: finalName,
          slug: finalSlug,
        };

        const insertWithSlug = async (slug: string) =>
          supabase
            .from("exercises")
            .insert({ ...payload, slug })
            .select("id, name, slug, split_id, created_at")
            .single();

        let result = await insertWithSlug(finalSlug);

        if (result.error?.code === "23505") {
          const retrySlug = getUniqueSlug(`${baseSlug}-${Date.now()}`, allUserExercises);
          result = await insertWithSlug(retrySlug);
        }

        if (result.error) throw result.error;

        const createdExercise = result.data as ExistingExerciseLite;

        if (!mountedRef.current) return;

        setAllUserExercises((prev) => [createdExercise, ...prev]);
        setExistingExercises((prev) => [createdExercise, ...prev]);
        setRecentExercises((prev) => {
          const next = [
            createdExercise,
            ...prev.filter(
              (item) =>
                normalizeForDuplicateCheck(item.name) !== normalizeForDuplicateCheck(createdExercise.name)
            ),
          ];
          return next.slice(0, 6);
        });

        setStatusMsg(mode === "stay" ? "Exercise created. You can add another one." : "Exercise created.");
        setName("");
        setDuplicateMatch(null);
        setForceCreateDuplicate(false);
        setCreateSuccess(true);

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const shouldAdvanceTour = tourActive && tourStep === "create_exercise";
        if (shouldAdvanceTour) {
          await setOnboardingStep("open_log");
          if (mountedRef.current) setTourStep("open_log");
        }

        if (mode === "stay" && !shouldAdvanceTour) {
          focusInputSoon();
          return;
        }

        setTimeout(() => {
          if (!mountedRef.current) return;
          router.replace({
            pathname: "/exercise/[slug]",
            params: {
              slug: createdExercise.slug ?? finalSlug,
              tourStep:
                shouldAdvanceTour || incomingTourStep === "create_exercise"
                  ? "open_log"
                  : undefined,
              tutorialProgramId: tutorialProgramId || fallbackProgramId,
              programId: tutorialProgramId || fallbackProgramId,
            },
          });
        }, 180);
      } catch (error: any) {
        console.error("handleCreate error:", error);
        const message =
          typeof error?.message === "string" && error.message.length > 0
            ? error.message
            : "Could not create the exercise.";

        if (!mountedRef.current) return;
        setErrorMsg(message);
        Alert.alert("Create failed", message);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [
      allUserExercises,
      duplicateMatch,
      fallbackProgramId,
      focusInputSoon,
      forceCreateDuplicate,
      incomingTourStep,
      normalizedName,
      prettyName,
      resolvedProgramId,
      router,
      selectedSplitId,
      slugBase,
      tourActive,
      tourStep,
      tutorialProgramId,
      user?.id,
    ]
  );

  if (authLoading || splitsLoading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator color={t.primaryBg} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[styles.container, { paddingBottom: 132 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {tourActive && tourStep === "create_exercise" ? (
              <OnboardingBanner
                t={t}
                title="Create your first exercise"
                body="Step 1: pick the split. Step 2: name the exercise. Step 3: save it and open the exercise to add your first log."
                primaryLabel="Type name"
                onPrimary={focusInputSoon}
              />
            ) : null}

            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: t.text }]}>New Exercise</Text>
                <Text style={[styles.subtitle, { color: t.mutedText }]}>Create an exercise, place it in the right split, and start logging fast.</Text>
              </View>

              <Pressable
                onPress={() => router.back()}
                style={[styles.backButton, { backgroundColor: t.cardAlt, borderColor: t.border }]}
              >
                <Ionicons name="close" size={20} color={t.text} />
              </Pressable>
            </View>

            <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.label, { color: t.text, marginBottom: 0 }]}>Split</Text>
                {selectedSplit?.name ? (
                  <View style={[styles.selectedBadge, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                    <Ionicons name="checkmark-circle" size={14} color={t.success} />
                    <Text style={[styles.selectedBadgeText, { color: t.text }]}>Selected: {selectedSplit.name}</Text>
                  </View>
                ) : null}
              </View>

              {splits.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="layers-outline" size={18} color={t.mutedText} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.emptyTitle, { color: t.text }]}>Create a split first</Text>
                    <Text style={[styles.emptyText, { color: t.mutedText }]}>Exercises belong inside a split like Push, Pull, Legs, or Core.</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push("/(tabs)/profile")}
                    style={[styles.emptyAction, { backgroundColor: t.primaryBg }]}
                  >
                    <Text style={[styles.emptyActionText, { color: t.primaryText }]}>Create Split</Text>
                  </Pressable>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.splitScrollContent}
                >
                  {splits.map((split) => {
                    const selected = split.id === selectedSplitId;
                    return (
                      <TouchableOpacity
                        key={split.id}
                        activeOpacity={0.85}
                        onPress={() => setSelectedSplitId(split.id)}
                        style={[
                          styles.splitChip,
                          selected
                            ? { backgroundColor: t.primaryBg, borderColor: t.primaryBg }
                            : { backgroundColor: t.cardAlt, borderColor: t.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.splitChipText,
                            { color: selected ? t.primaryText : t.text },
                          ]}
                        >
                          {split.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <Text style={[styles.label, { color: t.text, marginTop: 18 }]}>Exercise name</Text>
              <View style={styles.inputShell}>
                <TextInput
                  ref={inputRef}
                  value={name}
                  onChangeText={handleNameChange}
                  placeholder="e.g. Incline Dumbbell Press"
                  placeholderTextColor={t.mutedText}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  maxLength={MAX_NAME_LENGTH}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  onSubmitEditing={() => {
                    if (canSubmit) void handleCreate();
                  }}
                  style={[
                    styles.input,
                    {
                      backgroundColor: t.background,
                      borderColor: duplicateMatch && !forceCreateDuplicate ? t.danger : t.border,
                      color: t.text,
                      paddingRight: 44,
                    },
                  ]}
                />
                {name.length > 0 ? (
                  <Pressable
                    onPress={clearName}
                    style={[styles.clearButton, { backgroundColor: t.cardAlt, borderColor: t.border }]}
                  >
                    <Ionicons name="close" size={16} color={t.mutedText} />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: t.mutedText }]}>{normalizedName.length}/{MAX_NAME_LENGTH}</Text>
                {!!readySlug && <Text style={[styles.metaText, { color: t.mutedText }]}>slug: {readySlug}</Text>}
              </View>

              {prettyName && prettyName !== normalizedName ? (
                <Text style={[styles.previewText, { color: t.mutedText }]}>Will save as: {prettyName}</Text>
              ) : null}

              {normalizedName && selectedSplitId ? (
                <View style={[styles.readyStrip, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                  <View style={styles.readyItem}>
                    <Text style={[styles.readyLabel, { color: t.mutedText }]}>Split</Text>
                    <Text style={[styles.readyValue, { color: t.text }]}>{selectedSplit?.name ?? "—"}</Text>
                  </View>
                  <View style={styles.readyDivider} />
                  <View style={styles.readyItem}>
                    <Text style={[styles.readyLabel, { color: t.mutedText }]}>Name</Text>
                    <Text style={[styles.readyValue, { color: t.text }]} numberOfLines={1}>{prettyName || normalizedName}</Text>
                  </View>
                  <View style={styles.readyDivider} />
                  <View style={styles.readyItem}>
                    <Text style={[styles.readyLabel, { color: t.mutedText }]}>Slug</Text>
                    <Text style={[styles.readyValue, { color: t.text }]} numberOfLines={1}>{readySlug || "—"}</Text>
                  </View>
                </View>
              ) : null}

              {duplicateLoading ? (
                <View style={styles.inlineStatus}>
                  <ActivityIndicator size="small" color={t.primaryBg} />
                  <Text style={[styles.inlineStatusText, { color: t.mutedText }]}>Checking duplicates…</Text>
                </View>
              ) : null}

              {duplicateMatch ? (
                <View style={[styles.infoBox, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                  <Ionicons name="alert-circle-outline" size={18} color={t.danger} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoText, { color: t.text }]}>Same exercise name already exists in this split: {duplicateMatch.name}</Text>
                    <View style={styles.inlineActions}>
                      <Pressable
                        onPress={() => {
                          setForceCreateDuplicate(true);
                          setErrorMsg("");
                          setStatusMsg("Duplicate allowed. You can create it now.");
                        }}
                        style={[styles.inlineActionButton, { backgroundColor: t.primaryBg }]}
                      >
                        <Text style={[styles.inlineActionButtonText, { color: t.primaryText }]}>Use existing name anyway</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleRenameSlightly}
                        style={[styles.inlineGhostButton, { borderColor: t.border, backgroundColor: t.background }]}
                      >
                        <Text style={[styles.inlineGhostButtonText, { color: t.text }]}>Rename slightly</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : null}

              {errorMsg ? <Text style={[styles.feedbackText, { color: t.danger }]}>{errorMsg}</Text> : null}
              {!errorMsg && statusMsg ? <Text style={[styles.feedbackText, { color: t.success }]}>{statusMsg}</Text> : null}
              {submitAttempted && !normalizedName ? (
                <Text style={[styles.helperText, { color: t.mutedText }]}>Add a name first to continue.</Text>
              ) : null}
            </View>

            <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={styles.suggestionHeader}>
                <Text style={[styles.label, { color: t.text, marginBottom: 0 }]}>Quick picks</Text>
                {selectedSplit?.name ? (
                  <Text style={[styles.helperTextTight, { color: t.mutedText }]}>Best for {selectedSplit.name}</Text>
                ) : null}
              </View>

              {recentSuggestionNames.length > 0 ? (
                <View style={styles.groupBlock}>
                  <Text style={[styles.groupTitle, { color: t.text }]}>Recent</Text>
                  <View style={styles.suggestionWrap}>
                    {recentSuggestionNames.map((item) => {
                      const active = normalizeForDuplicateCheck(item) === normalizeForDuplicateCheck(name);
                      return (
                        <Pressable
                          key={`recent-${item}`}
                          onPress={() => handleUseSuggestion(item)}
                          style={[
                            styles.suggestionChip,
                            active
                              ? { backgroundColor: t.primaryBg, borderColor: t.primaryBg }
                              : { backgroundColor: t.cardAlt, borderColor: t.border },
                          ]}
                        >
                          <Ionicons name="time-outline" size={14} color={active ? t.primaryText : t.mutedText} />
                          <Text style={[styles.suggestionChipText, { color: active ? t.primaryText : t.text }]}>{item}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {bestForSplitNames.length > 0 ? (
                <View style={styles.groupBlock}>
                  <Text style={[styles.groupTitle, { color: t.text }]}>Best for this split</Text>
                  <View style={styles.suggestionWrap}>
                    {bestForSplitNames.map((item) => {
                      const active = normalizeForDuplicateCheck(item) === normalizeForDuplicateCheck(name);
                      return (
                        <Pressable
                          key={`split-${item}`}
                          onPress={() => handleUseSuggestion(item)}
                          style={[
                            styles.suggestionChip,
                            active
                              ? { backgroundColor: t.primaryBg, borderColor: t.primaryBg }
                              : { backgroundColor: t.cardAlt, borderColor: t.border },
                          ]}
                        >
                          <Ionicons name="sparkles-outline" size={14} color={active ? t.primaryText : t.mutedText} />
                          <Text style={[styles.suggestionChipText, { color: active ? t.primaryText : t.text }]}>{item}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {fallbackSuggestionNames.length > 0 ? (
                <View style={styles.groupBlock}>
                  <Text style={[styles.groupTitle, { color: t.text }]}>More ideas</Text>
                  <View style={styles.suggestionWrap}>
                    {fallbackSuggestionNames.map((item) => {
                      const active = normalizeForDuplicateCheck(item) === normalizeForDuplicateCheck(name);
                      return (
                        <Pressable
                          key={`fallback-${item}`}
                          onPress={() => handleUseSuggestion(item)}
                          style={[
                            styles.suggestionChip,
                            active
                              ? { backgroundColor: t.primaryBg, borderColor: t.primaryBg }
                              : { backgroundColor: t.cardAlt, borderColor: t.border },
                          ]}
                        >
                          <Ionicons name="barbell-outline" size={14} color={active ? t.primaryText : t.mutedText} />
                          <Text style={[styles.suggestionChipText, { color: active ? t.primaryText : t.text }]}>{item}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>

            {recentExercises.length > 0 ? (
              <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
                <Text style={[styles.label, { color: t.text }]}>Recent exercises</Text>
                {recentExercises.map((exercise, index) => (
                  <Pressable
                    key={exercise.id}
                    onPress={() => handleUseSuggestion(exercise.name)}
                    style={[
                      styles.recentRow,
                      {
                        borderBottomColor: t.border,
                        borderBottomWidth: index === recentExercises.length - 1 ? 0 : StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: t.cardAlt }]}>
                      <Ionicons name="barbell-outline" size={16} color={t.mutedText} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recentName, { color: t.text }]}>{exercise.name}</Text>
                      <Text style={[styles.recentMeta, { color: t.mutedText }]}>Tap to reuse this name</Text>
                    </View>
                    <Ionicons name="arrow-up-circle-outline" size={18} color={t.mutedText} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {nameFocused ? <View style={{ height: 20 }} /> : null}
          </ScrollView>

          <View style={[styles.stickyFooter, { backgroundColor: t.background, borderTopColor: t.border }]}>
            {!tourActive || tourStep !== "create_exercise" ? (
              <Pressable
                disabled={!canSubmit || loading || splits.length === 0}
                onPress={() => void handleCreate("stay")}
                style={[
                  styles.secondaryFooterButton,
                  {
                    borderColor: t.border,
                    backgroundColor: t.card,
                    opacity: !canSubmit || loading || splits.length === 0 ? 0.55 : 1,
                  },
                ]}
              >
                <Text style={[styles.secondaryFooterButtonText, { color: t.text }]}>Create & add another</Text>
              </Pressable>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={!canSubmit || loading || splits.length === 0}
              onPress={() => void handleCreate("open")}
              style={[
                styles.primaryFooterButton,
                {
                  backgroundColor:
                    !canSubmit || loading || splits.length === 0 ? t.border : createSuccess ? t.success : t.primaryBg,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={t.primaryText} />
              ) : (
                <View style={styles.footerButtonInner}>
                  <Ionicons
                    name={createSuccess ? "checkmark-circle" : "add-circle-outline"}
                    size={18}
                    color={t.primaryText}
                  />
                  <Text style={[styles.primaryFooterButtonText, { color: t.primaryText }]}>
                    {createSuccess ? "Created" : "Create exercise"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  selectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  inputShell: {
    position: "relative",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  clearButton: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  previewText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  readyStrip: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  readyItem: {
    flex: 1,
    minWidth: 0,
  },
  readyLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  readyValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  readyDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: "rgba(127,127,127,0.35)",
  },
  inlineStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  inlineStatusText: {
    fontSize: 13,
  },
  infoBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  inlineActionButton: {
    minHeight: 36,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  inlineActionButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  inlineGhostButton: {
    minHeight: 36,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderWidth: 1,
  },
  inlineGhostButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  feedbackText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "600",
  },
  helperText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
  },
  helperTextTight: {
    fontSize: 12,
    lineHeight: 16,
  },
  splitScrollContent: {
    gap: 10,
    paddingRight: 4,
  },
  splitChip: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  splitChipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emptyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyAction: {
    paddingHorizontal: 12,
    minHeight: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 2,
  },
  groupBlock: {
    marginTop: 12,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  suggestionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  suggestionChip: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  suggestionChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  recentRow: {
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  recentName: {
    fontSize: 15,
    fontWeight: "600",
  },
  recentMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  stickyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    flexDirection: "row",
    gap: 10,
  },
  secondaryFooterButton: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryFooterButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  primaryFooterButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  footerButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryFooterButtonText: {
    fontSize: 16,
    fontWeight: "800",
  },
});

