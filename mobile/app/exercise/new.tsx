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
  Animated,
  Easing,
  StatusBar,
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
  "Weighted Pull-Up",
  "Bodyweight Pull-Up",
  "Weighted Dip",
  "Bodyweight Dip",
  "Incline Dumbbell Press",
  "Cable Lateral Raise",
  "Pike Push-Up",
  "Single Arm Cable Fly",
  "Pendlay Row",
  "Face Pull",
  "Australian Pull-Up",
  "Dragon Flag",
  "Pallof Press",
  "Bench Press",
  "Overhead Press",
  "Tricep Pushdown",
  "Lat Pulldown",
  "Barbell Row",
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

const SPECIAL_TITLE_WORDS: Record<string, string> = {
  ab: "AB",
  abs: "Abs",
  bb: "BB",
  bw: "BW",
  db: "DB",
  ez: "EZ",
  kg: "kg",
  lbs: "lbs",
  pr: "PR",
  rm: "RM",
  rom: "ROM",
  tut: "TUT",
};

const LIGHT_SCREEN = {
  base: "#EEF4FF",
  glowPrimary: "rgba(37,99,235,0.16)",
  glowSecondary: "rgba(139,92,246,0.12)",
  glowWarm: "rgba(16,185,129,0.10)",
  footer: "rgba(238,244,255,0.96)",
};

const DARK_SCREEN = {
  base: "#050A14",
  glowPrimary: "rgba(59,130,246,0.24)",
  glowSecondary: "rgba(139,92,246,0.20)",
  glowWarm: "rgba(16,185,129,0.14)",
  footer: "rgba(5,10,20,0.96)",
};

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
    .map((word) => {
      const raw = word.trim();
      const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (SPECIAL_TITLE_WORDS[compact]) return SPECIAL_TITLE_WORDS[compact];

      if (/^\d/.test(raw)) return raw.toUpperCase();
      if (raw.includes("-") || raw.includes("/")) {
        return raw
          .split(/([-/])/)
          .map((part) => {
            if (part === "-" || part === "/") return part;
            const key = part.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (SPECIAL_TITLE_WORDS[key]) return SPECIAL_TITLE_WORDS[key];
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
          })
          .join("");
      }

      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    })
    .join(" ");
}

function generateSlug(value: string) {
  return normalizeExerciseName(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function isDarkColor(color?: string) {
  if (!color?.startsWith("#")) return false;

  const raw = color.replace("#", "");
  const hex = raw.length === 3 ? raw.split("").map((ch) => ch + ch).join("") : raw;
  const value = Number.parseInt(hex.slice(0, 6), 16);
  if (Number.isNaN(value)) return false;

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return 0.299 * r + 0.587 * g + 0.114 * b < 150;
}

function getScreenPalette(t: any) {
  return isDarkColor(t.background) || isDarkColor(t.card) ? DARK_SCREEN : LIGHT_SCREEN;
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
      "Weighted Dip",
      "Bodyweight Dip",
      "Incline Dumbbell Press",
      "Cable Lateral Raise",
      "Pike Push-Up",
      "Single Arm Cable Fly",
      "Overhead Press",
      "Tricep Pushdown",
    ];
  }

  if (lower.includes("pull") || lower.includes("back") || lower.includes("bicep")) {
    return [
      "Weighted Pull-Up",
      "Bodyweight Pull-Up",
      "Pendlay Row",
      "Face Pull",
      "Australian Pull-Up",
      "Lat Pulldown",
      "Barbell Row",
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
      "Sissy Squat",
      "Bulgarian Split Squat",
    ];
  }

  if (lower.includes("core") || lower.includes("abs")) {
    return ["Dragon Flag", "Pallof Press", "Hanging Knee Raise", "Cable Crunch", "Plank", "L-Sit", "Ab Wheel"];
  }

  return SUGGESTED_EXERCISES.slice(0, 10);
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
  const screenPalette = useMemo(() => getScreenPalette(t), [t]);
  const statusBarStyle = screenPalette === DARK_SCREEN ? "light-content" : "dark-content";

  const inputRef = useRef<TextInput>(null);
  const mountedRef = useRef(true);
  const glowTopAnim = useRef(new Animated.Value(0)).current;
  const glowMidAnim = useRef(new Animated.Value(0)).current;
  const glowBottomAnim = useRef(new Animated.Value(0)).current;

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
  const [crossSplitMatches, setCrossSplitMatches] = useState<ExistingExerciseLite[]>([]);
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

  const splitNameById = useMemo(() => {
    const map: Record<string, string> = {};
    splits.forEach((split) => {
      map[split.id] = split.name;
    });
    return map;
  }, [splits]);

  const primaryCrossSplitMatch = crossSplitMatches[0] ?? null;

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
    setDuplicateMatch(null);
    setCrossSplitMatches([]);
    resetFeedback();
    focusInputSoon();
  }, [focusInputSoon, resetFeedback]);

  const handleUseSuggestion = useCallback(
    (value: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowTopAnim, {
            toValue: 1,
            duration: 15500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowTopAnim, {
            toValue: 0,
            duration: 15500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowMidAnim, {
            toValue: 1,
            duration: 18500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowMidAnim, {
            toValue: 0,
            duration: 18500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowBottomAnim, {
            toValue: 1,
            duration: 21000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowBottomAnim, {
            toValue: 0,
            duration: 21000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [glowBottomAnim, glowMidAnim, glowTopAnim]);

  const glowTopMotion = {
    transform: [
      {
        translateX: glowTopAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }),
      },
      {
        translateY: glowTopAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 28] }),
      },
      {
        scale: glowTopAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
      },
    ],
  };

  const glowMidMotion = {
    transform: [
      {
        translateX: glowMidAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 26] }),
      },
      {
        translateY: glowMidAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }),
      },
      {
        scale: glowMidAnim.interpolate({ inputRange: [0, 1], outputRange: [1.03, 0.96] }),
      },
    ],
  };

  const glowBottomMotion = {
    transform: [
      {
        translateX: glowBottomAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }),
      },
      {
        translateY: glowBottomAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }),
      },
      {
        scale: glowBottomAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
      },
    ],
  };

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
      setCrossSplitMatches([]);
      setForceCreateDuplicate(false);
      setDuplicateLoading(false);
      return;
    }

    setDuplicateLoading(true);

    const timeout = setTimeout(() => {
      const normalized = normalizeForDuplicateCheck(normalizedName);
      const sameNameExercises = existingExercises.filter(
        (exercise) => normalizeForDuplicateCheck(exercise.name) === normalized
      );
      const exactMatch = sameNameExercises.find((exercise) => exercise.split_id === selectedSplitId) ?? null;
      const otherSplitMatches = sameNameExercises.filter(
        (exercise) => exercise.split_id && exercise.split_id !== selectedSplitId
      );

      if (!mountedRef.current) return;
      setDuplicateMatch(exactMatch);
      setCrossSplitMatches(otherSplitMatches.slice(0, 3));
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

        setStatusMsg(
          mode === "stay"
            ? `${createdExercise.name} created in ${selectedSplit?.name ?? "this split"}. Add another one.`
            : `${createdExercise.name} created in ${selectedSplit?.name ?? "this split"}.`
        );
        setName("");
        setDuplicateMatch(null);
        setCrossSplitMatches([]);
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
      selectedSplit?.name,
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
      <SafeAreaView style={[styles.center, { backgroundColor: screenPalette.base }]}>
        <StatusBar barStyle={statusBarStyle} backgroundColor={screenPalette.base} />
        <ActivityIndicator color={t.primaryBg} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: screenPalette.base }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={screenPalette.base} />

      <View pointerEvents="none" style={styles.backgroundLayer}>
        <Animated.View
          style={[
            styles.backgroundGlow,
            styles.glowTop,
            { backgroundColor: screenPalette.glowPrimary },
            glowTopMotion,
          ]}
        />
        <Animated.View
          style={[
            styles.backgroundGlow,
            styles.glowMid,
            { backgroundColor: screenPalette.glowSecondary },
            glowMidMotion,
          ]}
        />
        <Animated.View
          style={[
            styles.backgroundGlow,
            styles.glowBottom,
            { backgroundColor: screenPalette.glowWarm },
            glowBottomMotion,
          ]}
        />
      </View>

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
                    onPress={() => {
                      void Haptics.selectionAsync();
                      router.push("/(tabs)/train");
                    }}
                    style={[styles.emptyAction, { backgroundColor: t.primaryBg }]}
                  >
                    <Text style={[styles.emptyActionText, { color: t.primaryText }]}>Go to Train</Text>
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
                        onPress={() => {
                          void Haptics.selectionAsync();
                          setSelectedSplitId(split.id);
                          resetFeedback();
                        }}
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
                        style={[styles.inlineGhostButton, { borderColor: t.border, backgroundColor: screenPalette.base }]}
                      >
                        <Text style={[styles.inlineGhostButtonText, { color: t.text }]}>Rename slightly</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : null}

              {!duplicateMatch && primaryCrossSplitMatch ? (
                <View style={[styles.softInfoBox, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                  <Ionicons name="information-circle-outline" size={18} color={t.link} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoText, { color: t.text }]}>
                      This name already exists in {splitNameById[primaryCrossSplitMatch.split_id ?? ""] ?? "another split"}. You can still add it here if it is part of this split too.
                    </Text>
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

          <View style={[styles.stickyFooter, { backgroundColor: screenPalette.footer, borderTopColor: t.border }]}>
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
    overflow: "hidden",
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFill,
  },
  backgroundGlow: {
    position: "absolute",
    borderRadius: 999,
  },
  glowTop: {
    width: 280,
    height: 280,
    top: -118,
    right: -106,
  },
  glowMid: {
    width: 230,
    height: 230,
    top: 260,
    left: -124,
  },
  glowBottom: {
    width: 310,
    height: 310,
    bottom: -150,
    right: -136,
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
    borderRadius: 22,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
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
  softInfoBox: {
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
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -6 },
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


