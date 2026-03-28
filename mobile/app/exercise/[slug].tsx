import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { format, isToday, isYesterday } from "date-fns";
import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { useIsOnline } from "@/hooks/use-is-online";
import { cacheGetJson, cacheKey, cacheSetJson } from "@/src/lib/offline-cache";
import OnboardingBanner from "@/src/components/OnboardingBanner";
import {
  getOnboardingStep,
  isOnboardingActive,
  setOnboardingStep,
} from "@/src/lib/onboarding";

type ExerciseRow = {
  id: string;
  name: string;
  slug: string | null;
  split_id?: string | null;
};

type SplitRowLite = {
  id: string;
  name: string;
};

type TutPreviewRow = {
  id: string;
  tut_seconds: number;
  performed_on: string;
};

type LogTag = "working" | "warmup" | "topset";
type LogFilter = "all" | "working" | "warmup" | "topset";
type TrendMetric = "volume" | "weight" | "reps";
type TrendView = "graph" | "list";

type LogRow = {
  id: string;
  user_id: string;
  exercise_id: string;
  weight: number | null;
  reps: number;
  sets: number;
  volume: number | null;
  created_at: string | null;
  day?: string | null;
  type?: string | null;
  pending?: boolean;
  local_temp_id?: string;
};

type ExerciseCacheShape = {
  exercise: ExerciseRow | null;
  logs: LogRow[];
  splitName?: string | null;
};

type PendingLogPayload = {
  local_temp_id: string;
  weight: number;
  reps: number;
  sets: number;
  volume: number;
  day: string | null;
  type: LogTag;
  created_at: string;
};

type ExercisePrefs = {
  defaultTag: LogTag;
  restDuration: number;
  trendMetric: TrendMetric;
  trendView: TrendView;
  weightJump: number;
};

type SessionSummary = {
  logs: number;
  volume: number;
  heaviest: number;
  bestSet: string;
};

type PrFlags = {
  heaviest: boolean;
  volume: boolean;
  reps: boolean;
};

type CurrentPrOwners = {
  heaviestId: string | null;
  volumeId: string | null;
  repsId: string | null;
};

type CompareInsightTone = "up" | "same" | "down" | "neutral";

type CompareInsight = {
  tone: CompareInsightTone;
  title: string;
  details: string[];
};

type RecordShortcut = {
  key: string;
  label: string;
  value: string;
  logId: string | null;
  accent: string;
};

type SuggestionAction = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  apply: () => void;
};

type LogMarkers = {
  isCurrentHeaviest: boolean;
  isCurrentVolume: boolean;
  isCurrentRep: boolean;
  isPreviousHeaviest: boolean;
  isPreviousVolume: boolean;
  isPreviousRep: boolean;
  isTodayHeaviest: boolean;
  isTodayVolume: boolean;
  isSessionBest: boolean;
  hasAnyPr: boolean;
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const DASHBOARD_GAP = 10;
const DASHBOARD_CELL_WIDTH = (SCREEN_WIDTH - 32 - 28 - DASHBOARD_GAP) / 2;
const REST_PRESETS = [45, 60, 90, 120, 150, 180, 240, 300];
const APPROX_LOG_CARD_HEIGHT = 170;
const APPROX_MONTH_HEADER_HEIGHT = 30;

const PR_COLORS = {
  heaviest: "#F59E0B",
  volume: "#8B5CF6",
  reps: "#2563EB",
  recent: "#10B981",
};


function formatWeightLabel(weight: number | null | undefined) {
  const value = Number(weight ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "Bodyweight";
  if (Number.isInteger(value)) return `${value} kg`;
  return `${value.toFixed(1)} kg`;
}

function formatCompactWeight(weight: number | null | undefined) {
  const value = Number(weight ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "BW";
  if (Number.isInteger(value)) return `${value} kg`;
  return `${value.toFixed(1)} kg`;
}

function formatLogLine(log: Pick<LogRow, "weight" | "reps" | "sets">) {
  const weightValue = Number(log.weight ?? 0);
  const weightText = weightValue > 0 ? `${formatWeightLabel(weightValue)} × ` : "Bodyweight × ";
  return `${weightText}${log.reps} × ${log.sets} sets`;
}

function formatComparableLine(log: Pick<LogRow, "weight" | "reps" | "sets">) {
  return `${formatCompactWeight(log.weight)} · ${log.reps}×${log.sets}`;
}

function formatLogDate(value: string | null | undefined) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  if (isToday(date)) return `Today · ${format(date, "p")}`;
  if (isYesterday(date)) return `Yesterday · ${format(date, "p")}`;
  return format(date, "MMM d, yyyy · p");
}

function formatDurationLabel(seconds: number | null | undefined) {
  const value = Number(seconds ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 60) return `${value}s`;
  const mins = Math.floor(value / 60);
  const secs = value % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function sanitizeDecimalInput(value: string) {
  const cleaned = value.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function sanitizeIntegerInput(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function calculateVolume(weight: string, reps: string, sets: string) {
  const w = parseFloat(weight) || 0;
  const r = parseInt(reps, 10) || 0;
  const s = parseInt(sets, 10) || 0;
  return Math.max(1, w) * r * s;
}

function getValidationError(weight: string, reps: string, sets: string) {
  const parsedWeight = parseFloat(weight || "0");
  const parsedReps = parseInt(reps || "0", 10);
  const parsedSets = parseInt(sets || "0", 10);

  if (!reps.trim()) return "Reps are required.";
  if (!sets.trim()) return "Sets are required.";
  if (Number.isNaN(parsedWeight) || parsedWeight < 0) return "Weight cannot be negative.";
  if (Number.isNaN(parsedReps) || parsedReps < 1) return "Reps must be at least 1.";
  if (Number.isNaN(parsedSets) || parsedSets < 1) return "Sets must be at least 1.";
  if (parsedReps > 999) return "Reps are too high.";
  if (parsedSets > 999) return "Sets are too high.";
  if (parsedWeight > 9999) return "Weight is too high.";
  return "";
}

function addWeight(current: string, delta: number) {
  const base = parseFloat(current || "0") || 0;
  const next = Math.max(0, base + delta);
  if (Number.isInteger(next)) return String(next);
  return next.toFixed(1);
}

function addInteger(current: string, delta: number) {
  const base = parseInt(current || "0", 10) || 0;
  return String(Math.max(0, base + delta));
}

function getLogTag(log: Pick<LogRow, "type">): LogTag {
  if (log.type === "warmup" || log.type === "topset") return log.type;
  return "working";
}

function getLogTagLabel(tag: LogTag) {
  if (tag === "warmup") return "Warm-up";
  if (tag === "topset") return "Top Set";
  return "Working";
}

function getMonthLabel(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return format(date, "MMMM yyyy");
}

function matchesSearch(log: LogRow, query: string) {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  const tag = getLogTagLabel(getLogTag(log)).toLowerCase();
  const date = formatLogDate(log.created_at).toLowerCase();
  const note = (log.day ?? "").toLowerCase();
  const line = formatLogLine(log).toLowerCase();
  return tag.includes(q) || date.includes(q) || note.includes(q) || line.includes(q);
}

function getComparableLogs(logs: LogRow[], currentTag: LogTag, reps: number) {
  const sameTagLogs = logs.filter((log) => getLogTag(log) === currentTag);
  const closeRepLogs = sameTagLogs.filter((log) => Math.abs(Number(log.reps ?? 0) - reps) <= 1);
  return closeRepLogs.length > 0 ? closeRepLogs : sameTagLogs;
}

function getTrendMetricValue(log: LogRow, metric: TrendMetric) {
  if (metric === "weight") return Number(log.weight ?? 0);
  if (metric === "reps") return Number(log.reps ?? 0);
  return Number(log.volume ?? 0);
}

function formatTrendMetricValue(metric: TrendMetric, value: number) {
  if (metric === "weight") return formatCompactWeight(value);
  if (metric === "reps") return `${value} reps`;
  return `${value}`;
}

function getLogAchievement(
  nextLog: Pick<LogRow, "weight" | "reps" | "sets" | "volume" | "type">,
  previousLogs: LogRow[]
) {
  const tag = getLogTag(nextLog);
  const weight = Number(nextLog.weight ?? 0);
  const reps = Number(nextLog.reps ?? 0);
  const volume = Number(nextLog.volume ?? 0);

  const workingLogs = previousLogs.filter((log) => getLogTag(log) !== "warmup");
  const sameCategoryLogs =
    tag === "warmup" ? previousLogs.filter((log) => getLogTag(log) === "warmup") : workingLogs;

  const heaviest = Math.max(0, ...sameCategoryLogs.map((log) => Number(log.weight ?? 0)));
  const bestVolume = Math.max(0, ...sameCategoryLogs.map((log) => Number(log.volume ?? 0)));
  const bestBodyweightReps = Math.max(
    0,
    ...sameCategoryLogs.filter((log) => Number(log.weight ?? 0) <= 0).map((log) => Number(log.reps ?? 0))
  );

  if (weight > heaviest) return "New heaviest PR";
  if (volume > bestVolume) return "New volume PR";
  if (weight <= 0 && reps > bestBodyweightReps) return "New bodyweight rep PR";
  if (previousLogs.length === 0) return "First log saved";
  if (tag === "topset") return "Top set logged";
  return "Log saved";
}

function getPrFlags(logs: LogRow[]) {
  const flags: Record<string, PrFlags> = {};
  let heaviest = 0;
  let bestVolume = 0;
  let bestBodyweightReps = 0;

  [...logs].reverse().forEach((log) => {
    const weight = Number(log.weight ?? 0);
    const volume = Number(log.volume ?? 0);
    const reps = Number(log.reps ?? 0);

    const current: PrFlags = {
      heaviest: false,
      volume: false,
      reps: false,
    };

    if (weight > heaviest) {
      current.heaviest = true;
      heaviest = weight;
    }
    if (volume > bestVolume) {
      current.volume = true;
      bestVolume = volume;
    }
    if (weight <= 0 && reps > bestBodyweightReps) {
      current.reps = true;
      bestBodyweightReps = reps;
    }

    flags[log.id] = current;
  });

  return flags;
}


function getCurrentPrOwners(logs: LogRow[]): CurrentPrOwners {
  let heaviestId: string | null = null;
  let volumeId: string | null = null;
  let repsId: string | null = null;
  let heaviest = -1;
  let bestVolume = -1;
  let bestBodyweightReps = -1;

  for (const log of logs) {
    const weight = Number(log.weight ?? 0);
    const volume = Number(log.volume ?? 0);
    const reps = Number(log.reps ?? 0);

    if (weight > heaviest) {
      heaviest = weight;
      heaviestId = log.id;
    }
    if (volume > bestVolume) {
      bestVolume = volume;
      volumeId = log.id;
    }
    if (weight <= 0 && reps > bestBodyweightReps) {
      bestBodyweightReps = reps;
      repsId = log.id;
    }
  }

  return { heaviestId, volumeId, repsId };
}

function getTodayLogIds(logs: LogRow[]) {
  return logs.filter((log) => {
    if (!log.created_at) return false;
    const d = new Date(log.created_at);
    return !Number.isNaN(d.getTime()) && isToday(d);
  });
}

function getApproxScrollOffsetForIndex(logs: LogRow[], index: number) {
  if (index <= 0) return 0;
  let monthHeaders = 0;
  for (let i = 0; i <= index; i += 1) {
    const current = getMonthLabel(logs[i]?.created_at);
    const prev = i > 0 ? getMonthLabel(logs[i - 1]?.created_at) : null;
    if (i === 0 || current !== prev) monthHeaders += 1;
  }
  return index * APPROX_LOG_CARD_HEIGHT + monthHeaders * APPROX_MONTH_HEADER_HEIGHT;
}

function getProgressInsight(
  weightText: string,
  repsText: string,
  setsText: string,
  logs: LogRow[],
  currentTag: LogTag
): CompareInsight {
  const currentWeight = parseFloat(weightText) || 0;
  const currentReps = parseInt(repsText, 10) || 0;
  const currentSets = parseInt(setsText, 10) || 0;

  if (!currentReps || !currentSets) {
    return {
      tone: "neutral",
      title: "Fill reps and sets to compare against your history.",
      details: [],
    };
  }

  const comparableLogs = getComparableLogs(logs, currentTag, currentReps);
  if (comparableLogs.length === 0) {
    return {
      tone: "neutral",
      title: "This will become your first comparable log.",
      details: [],
    };
  }

  const latestComparable = comparableLogs[0];
  const bestComparable = [...comparableLogs].sort(
    (a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0)
  )[0];

  const currentVolume = Math.max(1, currentWeight) * currentReps * currentSets;
  const latestVolume = Number(latestComparable.volume ?? 0);
  const bestVolume = Number(bestComparable.volume ?? 0);

  const weightDelta = currentWeight - Number(latestComparable.weight ?? 0);
  const repDelta = currentReps - Number(bestComparable.reps ?? 0);
  const volumeVsLast = currentVolume - latestVolume;

  let tone: CompareInsightTone = "same";
  let title = "This matches your last comparable set.";

  if (currentWeight <= 0 && currentReps > Number(bestComparable.reps ?? 0)) {
    tone = "up";
    title = "This would beat your best comparable bodyweight set.";
  } else if (currentVolume > bestVolume && bestVolume > 0) {
    tone = "up";
    title = `This beats your best comparable set by ${currentVolume - bestVolume} volume.`;
  } else if (currentVolume > latestVolume) {
    tone = "up";
    title = `This is ${currentVolume - latestVolume} volume above your last comparable set.`;
  } else if (currentVolume < latestVolume) {
    tone = "down";
    title = `${latestVolume - currentVolume} volume below your last comparable set.`;
  }

  const details = [
    `${weightDelta === 0 ? "±0" : weightDelta > 0 ? "+" + weightDelta : String(weightDelta)} kg vs last working`,
    `${repDelta === 0 ? "Matches" : repDelta > 0 ? "+" + repDelta : String(repDelta)} reps vs best comparable`,
    `${volumeVsLast === 0 ? "±0" : volumeVsLast > 0 ? "+" + volumeVsLast : String(volumeVsLast)} volume vs last time`,
  ];

  return { tone, title, details };
}

function getTrendCallouts(logs: LogRow[]) {
  if (logs.length === 0) return ["No working logs yet."];
  const latest = logs[0];
  const oldestSlice = [...logs].slice(0, 6).reverse();
  const first = oldestSlice[0];
  const last = oldestSlice[oldestSlice.length - 1];
  const weightDelta = Number(last?.weight ?? 0) - Number(first?.weight ?? 0);
  const volumeSeries = oldestSlice.map((log) => Number(log.volume ?? 0));
  let improvingSessions = 1;
  for (let i = volumeSeries.length - 1; i > 0; i -= 1) {
    if (volumeSeries[i] >= volumeSeries[i - 1]) improvingSessions += 1;
    else break;
  }
  const repDelta = Number(last?.reps ?? 0) - Number(first?.reps ?? 0);
  const daysSinceLast = latest?.created_at
    ? Math.floor((Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return [
    weightDelta > 0
      ? `Weight up ${weightDelta} kg over last ${oldestSlice.length} working logs`
      : weightDelta < 0
        ? `Weight down ${Math.abs(weightDelta)} kg over last ${oldestSlice.length} working logs`
        : "Weight is flat across recent working logs",
    improvingSessions >= 3
      ? `Volume improved ${improvingSessions} logs in a row`
      : repDelta > 0
        ? `Rep performance is trending up`
        : repDelta < 0
          ? `Rep performance dipped recently`
          : "Rep performance is flat",
    daysSinceLast !== null && daysSinceLast >= 1
      ? `No working logs in ${daysSinceLast} day${daysSinceLast === 1 ? "" : "s"}`
      : "You logged this exercise recently",
  ];
}


function getHeaderTitle(name: string | null | undefined) {
  if (!name) return "Exercise";
  return name.length > 24 ? `${name.slice(0, 24).trim()}…` : name;
}

function getPrBoardItems(logs: LogRow[], currentPrOwners: CurrentPrOwners, dashboardMetrics: { bestVolumeLog: LogRow | null; bodyweightRepPR: number }, lastLog: LogRow | null): RecordShortcut[] {
  const bestVolumeLabel = dashboardMetrics.bestVolumeLog
    ? `${formatCompactWeight(dashboardMetrics.bestVolumeLog.weight)} × ${dashboardMetrics.bestVolumeLog.reps} × ${dashboardMetrics.bestVolumeLog.sets}`
    : "—";
  const lastLoggedLabel = lastLog
    ? `${formatCompactWeight(lastLog.weight)} × ${lastLog.reps} × ${lastLog.sets}`
    : "—";

  return [
    {
      key: "heaviest",
      label: "Heaviest PR",
      value:
        currentPrOwners.heaviestId && logs.find((log) => log.id === currentPrOwners.heaviestId)
          ? (() => {
            const found = logs.find((log) => log.id === currentPrOwners.heaviestId)!;
            return `${formatCompactWeight(found.weight)} × ${found.reps}`;
          })()
          : "—",
      logId: currentPrOwners.heaviestId,
      accent: PR_COLORS.heaviest,
    },
    {
      key: "volume",
      label: "Volume PR",
      value: bestVolumeLabel,
      logId: dashboardMetrics.bestVolumeLog?.id ?? null,
      accent: PR_COLORS.volume,
    },
    {
      key: "bw",
      label: "BW Rep PR",
      value: dashboardMetrics.bodyweightRepPR > 0 ? `${dashboardMetrics.bodyweightRepPR} reps` : "—",
      logId: currentPrOwners.repsId,
      accent: PR_COLORS.reps,
    },
    {
      key: "last",
      label: "Last Logged",
      value: lastLoggedLabel,
      logId: lastLog?.id ?? null,
      accent: PR_COLORS.recent,
    },
  ];
}

export default function ExerciseScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const isOnline = useIsOnline();
  const params = useLocalSearchParams<{
    slug?: string;
    quickLog?: string;
    tourStep?: string;
    tutorialProgramId?: string;
    programId?: string;
  }>();
  const slug = params?.slug;
  const quickLog = params?.quickLog === "true";
  const incomingTourStep = params?.tourStep;
  const tutorialProgramId = params?.tutorialProgramId;
  const fallbackProgramId = params?.programId;
  const resolvedTutorialProgramId = tutorialProgramId || fallbackProgramId;

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState<string>("idle");

  const [user, setUser] = useState<any>(null);
  const [exercise, setExercise] = useState<ExerciseRow | null>(null);
  const [splitName, setSplitName] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [newLog, setNewLog] = useState({ weight: "", reps: "", sets: "", note: "" });
  const [logTag, setLogTag] = useState<LogTag>("working");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [restDuration, setRestDuration] = useState(120);
  const [dashboardCollapsed, setDashboardCollapsed] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [sessionLogIds, setSessionLogIds] = useState<string[]>([]);
  const [sessionVolume, setSessionVolume] = useState(0);
  const [finishedSessionSummary, setFinishedSessionSummary] = useState<SessionSummary | null>(null);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");
  const [logSearch, setLogSearch] = useState("");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("volume");
  const [trendView, setTrendView] = useState<TrendView>("graph");
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [latestTut, setLatestTut] = useState<TutPreviewRow | null>(null);
  const [tutPreviewLoading, setTutPreviewLoading] = useState(false);
  const [weightJump, setWeightJump] = useState(2.5);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  const listRef = useRef<FlatList<LogRow> | null>(null);
  const loggerAnchorY = useRef(0);
  const advancedInsightsAnchorY = useRef(0);

  const scrollToLogger = () => {
    const target = Math.max(0, loggerAnchorY.current - 16);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: target, animated: true });
    });
  };

  const scrollToAdvancedInsights = () => {
    const target = Math.max(0, advancedInsightsAnchorY.current - 16);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: target, animated: true });
    });
  };

  const cacheId = user?.id && slug ? cacheKey(["exercise", user.id, slug]) : null;
  const pendingQueueKey = user?.id && exercise?.id ? cacheKey(["exercise-pending", user.id, exercise.id]) : null;
  const prefsKey = user?.id && exercise?.id ? cacheKey(["exercise-prefs", user.id, exercise.id]) : null;

  useFocusEffect(
    useMemo(
      () => () => {
        let mounted = true;

        const loadTour = async () => {
          const active = await isOnboardingActive();
          const step = await getOnboardingStep();
          if (!mounted) return;

          if (!active || step === "done" || step === "idle") {
            setTourActive(false);
            setTourStep("idle");
            return;
          }

          setTourActive(true);
          setTourStep((incomingTourStep as string) || (step as string) || "idle");
        };

        void loadTour();

        return () => {
          mounted = false;
        };
      },
      [incomingTourStep]
    )
  );

  useEffect(() => {
    let mounted = true;

    const getUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const sessionUser = data?.session?.user ?? null;
      if (!sessionUser) {
        router.replace("/(auth)/login");
        return;
      }

      setUser(sessionUser);
    };

    void getUser();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!slug || !user?.id) return;

    let active = true;

    const fetchExercise = async () => {
      try {
        if (cacheId) {
          const cached = await cacheGetJson<ExerciseCacheShape>(cacheId);
          if (!active) return;

          if (cached?.exercise) setExercise(cached.exercise);
          if (cached?.logs) setLogs(cached.logs);
          if (typeof cached?.splitName === "string") setSplitName(cached.splitName);

          if (!isOnline && cached) {
            setLoading(false);
            return;
          }
        }

        const { data, error } = await supabase
          .from("exercises")
          .select("id, name, slug, split_id")
          .eq("slug", slug)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error(error);
          setExercise(null);
        } else {
          setExercise((data as ExerciseRow) ?? null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchExercise();

    return () => {
      active = false;
    };
  }, [slug, user?.id, isOnline, cacheId]);

  useEffect(() => {
    if (!exercise?.split_id || !user?.id) return;

    let active = true;

    const fetchSplit = async () => {
      const { data, error } = await supabase
        .from("splits")
        .select("id, name")
        .eq("id", exercise.split_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;
      if (error) {
        console.warn(error);
        return;
      }
      setSplitName((data as SplitRowLite | null)?.name ?? null);
    };

    void fetchSplit();

    return () => {
      active = false;
    };
  }, [exercise?.split_id, user?.id]);

  useEffect(() => {
    if (!exercise?.id || !user?.id) {
      setLatestTut(null);
      setTutPreviewLoading(false);
      return;
    }

    let active = true;

    const fetchLatestTut = async () => {
      setTutPreviewLoading(true);

      const { data, error } = await supabase
        .from("exercise_tut_logs")
        .select("id, tut_seconds, performed_on")
        .eq("exercise_id", exercise.id)
        .eq("user_id", user.id)
        .order("performed_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.warn("Failed to load TUT preview", error);
        setLatestTut(null);
      } else {
        setLatestTut((data as TutPreviewRow | null) ?? null);
      }

      setTutPreviewLoading(false);
    };

    void fetchLatestTut();

    return () => {
      active = false;
    };
  }, [exercise?.id, user?.id]);

  useEffect(() => {
    if (!prefsKey) return;

    let active = true;

    const loadPrefs = async () => {
      const prefs = await cacheGetJson<ExercisePrefs>(prefsKey);
      if (!active || !prefs) return;
      setLogTag(prefs.defaultTag ?? "working");
      setRestDuration(prefs.restDuration ?? 120);
      setTrendMetric(prefs.trendMetric ?? "volume");
      setTrendView(prefs.trendView ?? "graph");
      setWeightJump(prefs.weightJump ?? 2.5);
    };

    void loadPrefs();

    return () => {
      active = false;
    };
  }, [prefsKey]);

  useEffect(() => {
    if (!prefsKey) return;
    void cacheSetJson(prefsKey, {
      defaultTag: logTag,
      restDuration,
      trendMetric,
      trendView,
      weightJump,
    });
  }, [prefsKey, logTag, restDuration, trendMetric, trendView, weightJump]);

  useEffect(() => {
    if (!exercise?.id || !user?.id || !isOnline) return;

    let active = true;
    const exerciseForCache = exercise;
    const splitNameForCache = splitName;

    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("exercise_id", exerciseForCache.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        console.warn(error);
        return;
      }

      const nextLogs = (data ?? []) as LogRow[];
      setLogs(nextLogs);

      if (cacheId) {
        await cacheSetJson(cacheId, {
          exercise: exerciseForCache,
          logs: nextLogs,
          splitName: splitNameForCache,
        });
      }
    };

    void fetchLogs();

    return () => {
      active = false;
    };
  }, [exercise?.id, user?.id, isOnline, cacheId, splitName]);

  useEffect(() => {
    if (!quickLog || logs.length === 0 || editingId) return;

    const latest = logs[0];
    setNewLog({
      weight: latest.weight && Number(latest.weight) > 0 ? String(latest.weight) : "",
      reps: String(latest.reps ?? ""),
      sets: String(latest.sets ?? ""),
      note: "",
    });
    setStatusMsg("Quick log ready.");
  }, [quickLog, logs, editingId]);

  useEffect(() => {
    if (!cacheId || !exercise) return;
    void cacheSetJson(cacheId, { exercise, logs, splitName });
  }, [cacheId, exercise, logs, splitName]);

  useEffect(() => {
    if (restSecondsLeft <= 0) return;

    const timer = setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev <= 1) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [restSecondsLeft]);

  useEffect(() => {
    if (!pendingQueueKey || !exercise?.id || !user?.id || !isOnline) return;

    let active = true;

    const syncPending = async () => {
      const queue = (await cacheGetJson<PendingLogPayload[]>(pendingQueueKey)) ?? [];
      if (!active || queue.length === 0) return;

      const sortedQueue = [...queue].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const syncedLocalIds: string[] = [];
      const insertedLogs: LogRow[] = [];

      for (const item of sortedQueue) {
        const { data, error } = await supabase
          .from("logs")
          .insert([
            {
              weight: item.weight,
              reps: item.reps,
              sets: item.sets,
              exercise_id: exercise.id,
              user_id: user.id,
              volume: item.volume,
              day: item.day,
              type: item.type,
              created_at: item.created_at,
            },
          ])
          .select()
          .maybeSingle();

        if (error) {
          console.error("Pending sync failed", error);
          continue;
        }

        if (data) {
          syncedLocalIds.push(item.local_temp_id);
          insertedLogs.push(data as LogRow);
        }
      }

      if (syncedLocalIds.length === 0) return;

      const remaining = queue.filter((item) => !syncedLocalIds.includes(item.local_temp_id));
      await cacheSetJson(pendingQueueKey, remaining);

      setLogs((prev) => {
        const withoutPending = prev.filter((log) => !syncedLocalIds.includes(log.local_temp_id ?? ""));
        return [...insertedLogs.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")), ...withoutPending];
      });

      setStatusMsg("Pending logs synced.");
    };

    void syncPending();

    return () => {
      active = false;
    };
  }, [pendingQueueKey, exercise?.id, user?.id, isOnline]);

  const workingLogs = useMemo(() => logs.filter((log) => getLogTag(log) !== "warmup"), [logs]);

  const dashboardMetrics = useMemo(() => {
    return workingLogs.reduce(
      (acc, log) => {
        const weight = Number(log.weight ?? 0);
        const reps = Number(log.reps ?? 0);
        const sets = Number(log.sets ?? 0);
        const volume = Number(log.volume ?? 0);

        acc.totalVolume += volume;
        acc.totalReps += reps * sets;
        acc.totalSets += sets;
        acc.totalSessions = workingLogs.length;
        acc.heaviestWeight = Math.max(acc.heaviestWeight, weight);

        const estOneRepMax = weight > 0 && reps > 0 ? weight * (1 + reps / 30) : 0;
        acc.bestEstimated1RM = Math.max(acc.bestEstimated1RM, estOneRepMax);

        if (!acc.bestVolumeLog || volume > Number(acc.bestVolumeLog.volume ?? 0)) {
          acc.bestVolumeLog = log;
        }

        acc.bodyweightRepPR = Math.max(acc.bodyweightRepPR, weight <= 0 ? reps : 0);
        return acc;
      },
      {
        heaviestWeight: 0,
        totalVolume: 0,
        totalReps: 0,
        totalSets: 0,
        totalSessions: workingLogs.length,
        bestEstimated1RM: 0,
        bestVolumeLog: null as LogRow | null,
        bodyweightRepPR: 0,
      }
    );
  }, [workingLogs]);

  const lastLog = logs[0] ?? null;
  const lastWorkingLog = workingLogs[0] ?? null;
  const bestWorkingLog = useMemo(() => {
    if (workingLogs.length === 0) return null;
    return [...workingLogs].sort((a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0))[0];
  }, [workingLogs]);

  const recentTrendLogs = useMemo(() => [...workingLogs].slice(0, 7).reverse(), [workingLogs]);

  const trendMaxValue = useMemo(() => {
    const max = Math.max(0, ...recentTrendLogs.map((log) => getTrendMetricValue(log, trendMetric)));
    return max || 1;
  }, [recentTrendLogs, trendMetric]);

  const currentComparableInsight = useMemo(
    () => getProgressInsight(newLog.weight, newLog.reps, newLog.sets, workingLogs, logTag),
    [newLog.weight, newLog.reps, newLog.sets, workingLogs, logTag]
  );

  const currentVolume = calculateVolume(newLog.weight, newLog.reps, newLog.sets);

  const sessionSummary = useMemo(
    () => ({
      setsLogged: sessionLogIds.length,
      volume: sessionVolume,
      active: !!sessionStartedAt && sessionLogIds.length > 0,
    }),
    [sessionLogIds.length, sessionStartedAt, sessionVolume]
  );

  const logPrFlags = useMemo(() => getPrFlags(logs), [logs]);
  const currentPrOwners = useMemo(() => getCurrentPrOwners(logs), [logs]);

  const todayLogs = useMemo(() => getTodayLogIds(logs), [logs]);
  const todayHeaviestId = useMemo(() => {
    if (todayLogs.length === 0) return null;
    return [...todayLogs].sort((a, b) => Number(b.weight ?? 0) - Number(a.weight ?? 0))[0]?.id ?? null;
  }, [todayLogs]);
  const todayVolumeId = useMemo(() => {
    if (todayLogs.length === 0) return null;
    return [...todayLogs].sort((a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0))[0]?.id ?? null;
  }, [todayLogs]);
  const sessionBestId = useMemo(() => {
    const sessionLogs = logs.filter((log) => sessionLogIds.includes(log.id));
    if (sessionLogs.length === 0) return null;
    return [...sessionLogs].sort((a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0))[0]?.id ?? null;
  }, [logs, sessionLogIds]);


  const filteredLogs = useMemo(() => {
    const byType = logFilter === "all" ? logs : logs.filter((log) => getLogTag(log) === logFilter);
    const searched = byType.filter((log) => matchesSearch(log, logSearch));

    if (logSearch.trim()) return searched;

    return searched.filter((log, index) => {
      const month = getMonthLabel(log.created_at);
      return !collapsedMonths[month] || index === 0;
    });
  }, [logs, logFilter, logSearch, collapsedMonths]);


  const trendCallouts = useMemo(() => getTrendCallouts(workingLogs), [workingLogs]);


  const scrollToLogCard = useCallback(
    (logId: string | null) => {
      if (!logId) return;
      const index = filteredLogs.findIndex((log) => log.id === logId);
      if (index < 0) return;
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({
          offset: Math.max(0, getApproxScrollOffsetForIndex(filteredLogs, index) - 12),
          animated: true,
        });
      });
    },
    [filteredLogs]
  );

  const prBoardItems = useMemo<RecordShortcut[]>(
    () => getPrBoardItems(logs, currentPrOwners, dashboardMetrics, lastLog),
    [logs, currentPrOwners, dashboardMetrics, lastLog]
  );

  const goalSnapshot = useMemo(
    () => ({
      last: lastWorkingLog ? formatComparableLine(lastWorkingLog) : "—",
      best: bestWorkingLog ? formatComparableLine(bestWorkingLog) : "—",
      goal:
        newLog.reps && newLog.sets
          ? `${formatCompactWeight(parseFloat(newLog.weight) || 0)} · ${newLog.reps}×${newLog.sets}`
          : "Fill logger",
    }),
    [lastWorkingLog, bestWorkingLog, newLog.weight, newLog.reps, newLog.sets]
  );

  const suggestionActions = useMemo<SuggestionAction[]>(() => {
    if (!lastWorkingLog) return [];

    const baseWeight = parseFloat(newLog.weight || "") || Number(lastWorkingLog.weight ?? 0);
    const baseReps = parseInt(newLog.reps || "", 10) || Number(lastWorkingLog.reps ?? 0);
    const baseSets = parseInt(newLog.sets || "", 10) || Number(lastWorkingLog.sets ?? 0);

    return [
      {
        id: "repeat",
        label: "Repeat",
        icon: "refresh-outline",
        apply: () => {
          setNewLog((prev) => ({
            ...prev,
            weight: baseWeight > 0 ? String(baseWeight) : "",
            reps: String(baseReps),
            sets: String(baseSets),
          }));
          setStatusMsg("Repeated last working suggestion.");
        },
      },
      {
        id: "weight",
        label: `+${weightJump} kg`,
        icon: "trending-up-outline",
        apply: () => {
          setNewLog((prev) => ({ ...prev, weight: addWeight(prev.weight || String(baseWeight), weightJump) }));
          setStatusMsg(`Suggested next set: +${weightJump} kg.`);
        },
      },
      {
        id: "rep",
        label: "+1 rep",
        icon: "add-outline",
        apply: () => {
          setNewLog((prev) => ({ ...prev, reps: addInteger(prev.reps || String(baseReps), 1) }));
          setStatusMsg("Suggested next set: +1 rep.");
        },
      },
      {
        id: "backoff",
        label: "Back-off",
        icon: "arrow-down-outline",
        apply: () => {
          const nextWeight = Math.max(0, baseWeight - weightJump);
          setNewLog((prev) => ({
            ...prev,
            weight: nextWeight > 0 ? (Number.isInteger(nextWeight) ? String(nextWeight) : nextWeight.toFixed(1)) : "",
            reps: String(baseReps + 2),
            sets: String(baseSets),
          }));
          setStatusMsg("Back-off set suggestion applied.");
        },
      },
    ];
  }, [lastWorkingLog, newLog.weight, newLog.reps, newLog.sets, weightJump]);

  const resetForm = useCallback(() => {
    setNewLog({ weight: "", reps: "", sets: "", note: "" });
    setLogTag("working");
    setEditingId(null);
    setFormError("");
    setStatusMsg("");
  }, []);

  const repeatLastLog = useCallback(() => {
    if (!lastLog) return;

    setNewLog({
      weight: lastLog.weight && Number(lastLog.weight) > 0 ? String(lastLog.weight) : "",
      reps: String(lastLog.reps),
      sets: String(lastLog.sets),
      note: "",
    });
    setLogTag(getLogTag(lastLog));
    setEditingId(null);
    setFormError("");
    setStatusMsg("Repeated last log.");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [lastLog]);

  const applySameAsLast = useCallback(() => {
    if (!lastLog) return;
    repeatLastLog();
  }, [lastLog, repeatLastLog]);

  const applySameAsLastWorking = useCallback(() => {
    if (!lastWorkingLog) return;

    setNewLog({
      weight: lastWorkingLog.weight && Number(lastWorkingLog.weight) > 0 ? String(lastWorkingLog.weight) : "",
      reps: String(lastWorkingLog.reps),
      sets: String(lastWorkingLog.sets),
      note: "",
    });
    setLogTag(getLogTag(lastWorkingLog));
    setStatusMsg("Copied last working set.");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [lastWorkingLog]);

  const applySameAsBest = useCallback(() => {
    if (!bestWorkingLog) return;

    setNewLog({
      weight: bestWorkingLog.weight && Number(bestWorkingLog.weight) > 0 ? String(bestWorkingLog.weight) : "",
      reps: String(bestWorkingLog.reps),
      sets: String(bestWorkingLog.sets),
      note: "",
    });
    setLogTag(getLogTag(bestWorkingLog));
    setStatusMsg("Copied best working set.");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [bestWorkingLog]);

  const duplicateLog = useCallback((log: LogRow) => {
    setNewLog({
      weight: log.weight && Number(log.weight) > 0 ? String(log.weight) : "",
      reps: String(log.reps),
      sets: String(log.sets),
      note: log.day ?? "",
    });
    setLogTag(getLogTag(log));
    setEditingId(null);
    setStatusMsg("Copied log into quick logger.");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const applyPlusWeight = (delta: number) => {
    setNewLog((prev) => ({ ...prev, weight: addWeight(prev.weight, delta) }));
    setFormError("");
    setStatusMsg(delta > 0 ? `Added ${delta} kg.` : "Updated weight.");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const applyPlusRep = (delta: number) => {
    setNewLog((prev) => ({ ...prev, reps: addInteger(prev.reps, delta) }));
    setFormError("");
    setStatusMsg(delta > 0 ? `Added ${delta} rep.` : "Updated reps.");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const applyPlusSet = (delta: number) => {
    setNewLog((prev) => ({ ...prev, sets: addInteger(prev.sets, delta) }));
    setFormError("");
    setStatusMsg(delta > 0 ? `Added ${delta} set.` : "Updated sets.");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleChange = (field: "weight" | "reps" | "sets" | "note", value: string) => {
    setStatusMsg("");
    setFormError("");

    if (field === "weight") {
      setNewLog((prev) => ({ ...prev, weight: sanitizeDecimalInput(value) }));
      return;
    }
    if (field === "reps" || field === "sets") {
      setNewLog((prev) => ({ ...prev, [field]: sanitizeIntegerInput(value) }));
      return;
    }
    setNewLog((prev) => ({ ...prev, note: value }));
  };

  const handleEdit = useCallback((log: LogRow) => {
    setEditingId(log.id);
    setNewLog({
      weight: log.weight && Number(log.weight) > 0 ? String(log.weight) : "",
      reps: String(log.reps),
      sets: String(log.sets),
      note: log.day ?? "",
    });
    setLogTag(getLogTag(log));
    setFormError("");
    setStatusMsg("Editing selected log.");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const finishSession = () => {
    const sessionLogs = logs.filter((log) => sessionLogIds.includes(log.id));
    const bestSetLog =
      sessionLogs.length > 0
        ? [...sessionLogs].sort((a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0))[0]
        : null;

    const summary: SessionSummary = {
      logs: sessionLogs.length,
      volume: sessionLogs.reduce((sum, log) => sum + Number(log.volume ?? 0), 0),
      heaviest: Math.max(0, ...sessionLogs.map((log) => Number(log.weight ?? 0))),
      bestSet: bestSetLog ? formatComparableLine(bestSetLog) : "—",
    };

    setFinishedSessionSummary(summary);
    setSessionStartedAt(null);
    setSessionLogIds([]);
    setSessionVolume(0);
    setStatusMsg("Session finished.");
  };

  const afterSuccessfulSet = (
    volume: number,
    sessionId: string,
    savedId: string,
    message: string,
    keepInputs = true
  ) => {
    setSessionStartedAt(sessionId);
    setSessionLogIds((prev) => [savedId, ...prev]);
    setSessionVolume((prev) => prev + volume);
    if (logTag !== "warmup") setRestSecondsLeft(restDuration);

    setNewLog((prev) => ({
      weight: keepInputs ? prev.weight : "",
      reps: keepInputs ? prev.reps : "",
      sets: keepInputs ? prev.sets : "",
      note: "",
    }));

    setEditingId(null);
    setFormError("");
    setStatusMsg(message);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSave = async () => {
    if (!exercise || !user?.id) return;

    const validationError = getValidationError(newLog.weight, newLog.reps, newLog.sets);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const w = parseFloat(newLog.weight) || 0;
    const r = parseInt(newLog.reps, 10);
    const s = parseInt(newLog.sets, 10);
    const volume = Math.max(1, w) * r * s;
    const createdAt = new Date().toISOString();
    const note = newLog.note.trim() || null;

    const achievement = getLogAchievement(
      { weight: w, reps: r, sets: s, volume, type: logTag },
      logs.filter((log) => !log.pending)
    );

    const sessionId = sessionStartedAt ?? createdAt;

    if (!isOnline && pendingQueueKey) {
      const localTempId = `pending-${Date.now()}`;

      const pendingLog: LogRow = {
        id: localTempId,
        local_temp_id: localTempId,
        user_id: user.id,
        exercise_id: exercise.id,
        weight: w,
        reps: r,
        sets: s,
        volume,
        created_at: createdAt,
        day: note,
        type: logTag,
        pending: true,
      };

      const existingQueue = (await cacheGetJson<PendingLogPayload[]>(pendingQueueKey)) ?? [];
      await cacheSetJson(pendingQueueKey, [
        {
          local_temp_id: localTempId,
          weight: w,
          reps: r,
          sets: s,
          volume,
          day: note,
          type: logTag,
          created_at: createdAt,
        },
        ...existingQueue,
      ]);

      setLogs((prev) => [pendingLog, ...prev]);
      afterSuccessfulSet(volume, sessionId, localTempId, "Saved offline. Will sync when connected.");
      return;
    }

    const { data, error } = await supabase
      .from("logs")
      .insert([
        {
          weight: w,
          reps: r,
          sets: s,
          exercise_id: exercise.id,
          user_id: user.id,
          volume,
          day: note,
          type: logTag,
        },
      ])
      .select()
      .maybeSingle();

    if (error) {
      console.error(error);
      setFormError("Could not save log.");
      return;
    }

    const nextLog = data as LogRow;
    setLogs((prev) => [nextLog, ...prev]);
    afterSuccessfulSet(volume, sessionId, nextLog.id, achievement);

    if (await isOnboardingActive()) {
      await setOnboardingStep("open_advanced");
      setTourStep("open_advanced");
      setStatusMsg("Great. Next, open Advanced Insights.");
      scrollToAdvancedInsights();
    }
  };

  const handleUpdate = async () => {
    if (!exercise || !editingId || !user?.id) return;

    const validationError = getValidationError(newLog.weight, newLog.reps, newLog.sets);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const w = parseFloat(newLog.weight) || 0;
    const r = parseInt(newLog.reps, 10);
    const s = parseInt(newLog.sets, 10);
    const volume = Math.max(1, w) * r * s;
    const note = newLog.note.trim() || null;

    const { data, error } = await supabase
      .from("logs")
      .update({ weight: w, reps: r, sets: s, volume, day: note, type: logTag })
      .eq("id", editingId)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error(error);
      setFormError("Could not update log.");
      return;
    }

    const updated = data as LogRow;
    setLogs((prev) => prev.map((log) => (log.id === editingId ? updated : log)));
    setEditingId(null);
    setFormError("");
    setStatusMsg("Log updated.");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = useCallback((id: string) => {
    Alert.alert("Delete log?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (id.startsWith("pending-") && pendingQueueKey) {
            const queue = (await cacheGetJson<PendingLogPayload[]>(pendingQueueKey)) ?? [];
            await cacheSetJson(
              pendingQueueKey,
              queue.filter((item) => item.local_temp_id !== id)
            );
            setLogs((prev) => prev.filter((log) => log.id !== id));
            setStatusMsg("Pending log removed.");
            return;
          }

          const { error } = await supabase.from("logs").delete().eq("id", id).eq("user_id", user.id);

          if (error) {
            console.error(error);
            setFormError("Could not delete log.");
            return;
          }

          setLogs((prev) => prev.filter((log) => log.id !== id));
          setStatusMsg("Log deleted.");
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }, [pendingQueueKey, user?.id]);

  const headerBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/");
  };

  const keyExtractor = useCallback((item: LogRow) => item.id, []);


  const renderItem = useCallback(
    ({ item, index }: { item: LogRow; index: number }) => {
      const currentMonth = getMonthLabel(item.created_at);
      const prevMonth = index > 0 ? getMonthLabel(filteredLogs[index - 1]?.created_at) : null;
      const showMonthHeader = index === 0 || currentMonth !== prevMonth;
      const noteExpanded = !!expandedNotes[item.id];
      const prFlags = logPrFlags[item.id] ?? { heaviest: false, volume: false, reps: false };

      const markers: LogMarkers = {
        isCurrentHeaviest: currentPrOwners.heaviestId === item.id,
        isCurrentVolume: currentPrOwners.volumeId === item.id,
        isCurrentRep: currentPrOwners.repsId === item.id,
        isPreviousHeaviest: prFlags.heaviest && currentPrOwners.heaviestId !== item.id,
        isPreviousVolume: prFlags.volume && currentPrOwners.volumeId !== item.id,
        isPreviousRep: prFlags.reps && currentPrOwners.repsId !== item.id,
        isTodayHeaviest: todayHeaviestId === item.id,
        isTodayVolume: todayVolumeId === item.id,
        isSessionBest: sessionBestId === item.id,
        hasAnyPr:
          prFlags.heaviest ||
          prFlags.volume ||
          prFlags.reps ||
          currentPrOwners.heaviestId === item.id ||
          currentPrOwners.volumeId === item.id ||
          currentPrOwners.repsId === item.id,
      };

      const monthIsCollapsed = !!collapsedMonths[currentMonth];
      const isFirstInMonth = showMonthHeader;
      if (monthIsCollapsed && !isFirstInMonth) {
        return null;
      }

      const leftAccentColor = markers.isCurrentHeaviest
        ? PR_COLORS.heaviest
        : markers.isCurrentVolume
          ? PR_COLORS.volume
          : markers.isCurrentRep
            ? PR_COLORS.reps
            : markers.isTodayHeaviest || markers.isTodayVolume || markers.isSessionBest
              ? PR_COLORS.recent
              : "transparent";

      return (
        <>
          {showMonthHeader ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                setCollapsedMonths((prev) => ({ ...prev, [currentMonth]: !prev[currentMonth] }))
              }
              style={styles.monthHeaderWrap}
            >
              <Text style={[styles.monthHeaderText, { color: t.mutedText }]}>
                {currentMonth} {collapsedMonths[currentMonth] ? "· Tap to expand" : "· Tap to collapse"}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.92}
            onLongPress={() => duplicateLog(item)}
            style={[
              styles.logCard,
              {
                backgroundColor: t.card,
                borderColor: markers.hasAnyPr ? leftAccentColor : t.border,
                shadowColor: leftAccentColor,
              },
              markers.hasAnyPr && styles.logCardPr,
            ]}
          >
            <View
              style={[
                styles.logPrRail,
                { backgroundColor: markers.hasAnyPr ? leftAccentColor : "transparent" },
              ]}
            />

            <View style={styles.logLeft}>
              <View style={styles.logTitleRow}>
                {(markers.hasAnyPr || markers.isSessionBest || markers.isTodayHeaviest || markers.isTodayVolume) ? (
                  <Ionicons
                    name={markers.hasAnyPr ? "trophy-outline" : "flash-outline"}
                    size={16}
                    color={markers.hasAnyPr ? leftAccentColor : t.text}
                  />
                ) : null}
                <Text style={[styles.logText, { color: t.text }]}>{formatLogLine(item)}</Text>
              </View>

              <Text style={[styles.logDate, { color: t.mutedText }]}>{formatLogDate(item.created_at)}</Text>
              <View style={styles.logMetaRow}>
                <View style={[styles.logMetaChip, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                  <Text style={[styles.logMetaChipText, { color: t.text }]}>
                    {getLogTagLabel(getLogTag(item))}
                  </Text>
                </View>

                <View style={[styles.logMetaChip, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                  <Text style={[styles.logMetaChipText, { color: t.text }]}>
                    Vol {Number(item.volume ?? 0)}
                  </Text>
                </View>

                <View style={styles.logIndicatorRow}>
                  {markers.isCurrentHeaviest || markers.isPreviousHeaviest ? (
                    <View style={[styles.logIndicatorDot, { backgroundColor: PR_COLORS.heaviest }]} />
                  ) : null}
                  {markers.isCurrentVolume || markers.isPreviousVolume ? (
                    <View style={[styles.logIndicatorDot, { backgroundColor: PR_COLORS.volume }]} />
                  ) : null}
                  {markers.isCurrentRep || markers.isPreviousRep ? (
                    <View style={[styles.logIndicatorDot, { backgroundColor: PR_COLORS.reps }]} />
                  ) : null}
                  {markers.isSessionBest || markers.isTodayHeaviest || markers.isTodayVolume ? (
                    <View style={[styles.logIndicatorDot, { backgroundColor: PR_COLORS.recent }]} />
                  ) : null}
                </View>

                {item.pending ? (
                  <View style={[styles.pendingChip, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                    <Text style={[styles.pendingChipText, { color: t.mutedText }]}>Pending</Text>
                  </View>
                ) : null}
              </View>

              {(markers.hasAnyPr || markers.isSessionBest || markers.isTodayHeaviest || markers.isTodayVolume) ? (
                <Text style={[styles.logIndicatorHint, { color: t.mutedText }]}>
                  {markers.isCurrentHeaviest
                    ? "Current heaviest PR"
                    : markers.isCurrentVolume
                      ? "Current volume PR"
                      : markers.isCurrentRep
                        ? "Current bodyweight rep PR"
                        : markers.isSessionBest
                          ? "Session best"
                          : markers.isTodayHeaviest
                            ? "Today’s heaviest"
                            : markers.isTodayVolume
                              ? "Today’s highest volume"
                              : markers.isPreviousHeaviest || markers.isPreviousVolume || markers.isPreviousRep
                                ? "Previous PR milestone"
                                : ""}
                </Text>
              ) : null}

              {item.day ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      setExpandedNotes((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                    }
                  >
                    <Text style={[styles.noteToggleText, { color: t.link }]}>
                      {noteExpanded ? "Hide note" : "Show note"}
                    </Text>
                  </TouchableOpacity>

                  {noteExpanded ? (
                    <Text style={[styles.noteExpandedText, { color: t.mutedText }]}>{item.day}</Text>
                  ) : null}
                </>
              ) : null}
            </View>

            <View style={styles.logRight}>
              <TouchableOpacity
                onPress={() => duplicateLog(item)}
                activeOpacity={0.85}
                style={[styles.sideActionBtn, { backgroundColor: t.cardAlt, borderColor: t.border }]}
              >
                <Ionicons name="copy-outline" size={16} color={t.text} />
                <Text style={[styles.sideActionText, { color: t.text }]}>Duplicate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleEdit(item)}
                activeOpacity={0.85}
                style={[styles.sideActionBtn, { backgroundColor: t.secondaryBg, borderColor: t.secondaryBg }]}
              >
                <Ionicons name="create-outline" size={16} color={t.secondaryText} />
                <Text style={[styles.sideActionText, { color: t.secondaryText }]}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                activeOpacity={0.85}
                style={[styles.sideActionBtn, { backgroundColor: t.danger, borderColor: t.danger }]}
              >
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={[styles.sideActionText, { color: "#fff" }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </>
      );
    },
    [
      collapsedMonths,
      currentPrOwners.heaviestId,
      currentPrOwners.repsId,
      currentPrOwners.volumeId,
      duplicateLog,
      expandedNotes,
      filteredLogs,
      handleDelete,
      handleEdit,
      logPrFlags,
      sessionBestId,
      t,
      todayHeaviestId,
      todayVolumeId,
    ]
  );


  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.text} />
        <Text style={[styles.loadingText, { color: t.mutedText }]}>Loading exercise…</Text>
      </SafeAreaView>
    );
  }

  if (!exercise) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: "600" }}>Exercise not found</Text>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }

            router.replace("/");
          }}
          style={{ marginTop: 12 }}
        >
          <Text style={{ color: t.link, fontWeight: "700" }}>← Back Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={t.primaryText === "#000000" ? "light-content" : "dark-content"} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={10}
      >
        <View style={styles.header}>
          <Pressable
            onPress={headerBack}
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: t.card, borderColor: t.border },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="chevron-back" size={18} color={t.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: t.text }]} numberOfLines={1}>
              {getHeaderTitle(exercise.name)}
            </Text>
            {splitName ? (
              <Text style={[styles.headerSubtitle, { color: t.mutedText }]} numberOfLines={1}>
                {splitName}
              </Text>
            ) : null}
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          ref={listRef}
          data={filteredLogs}
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          getItemLayout={(_, index) => ({
            length: APPROX_LOG_CARD_HEIGHT,
            offset: APPROX_LOG_CARD_HEIGHT * index,
            index,
          })}
          ListHeaderComponent={
            <>
              {!isOnline ? (
                <View style={[styles.offlineChip, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                  <Ionicons name="cloud-offline-outline" size={14} color={t.mutedText} />
                  <Text style={[styles.offlineText, { color: t.mutedText }]}>Offline mode</Text>
                </View>
              ) : null}

              {tourActive && (tourStep === "open_log" || tourStep === "create_log") ? (
                <OnboardingBanner
                  t={t}
                  title="This is your log page"
                  body="Here you save sets, reps, weight, and volume for each workout. Add your first log now."
                  primaryLabel="Create first log"
                  onPrimary={async () => {
                    await setOnboardingStep("create_log");
                    setTourStep("create_log");
                    setStatusMsg("Fill in your set details below, then tap Add Log.");
                    scrollToLogger();
                  }}
                />
              ) : null}

              {tourActive && tourStep === "open_advanced" ? (
                <OnboardingBanner
                  t={t}
                  title="See deeper insights"
                  body="Open Advanced Insights to view extra metrics like time under tension."
                  primaryLabel="Open Advanced Insights"
                  onPrimary={() => {
                    if (!slug) return;
                    router.push({
                      pathname: "/exercise/[slug]/advanced",
                      params: {
                        slug,
                        tourStep: "open_advanced",
                        tutorialProgramId: resolvedTutorialProgramId,
                        programId: resolvedTutorialProgramId,
                      },
                    });
                  }}
                />
              ) : null}

              {sessionSummary.active ? (
                <View style={[styles.sessionCard, { backgroundColor: t.card, borderColor: t.border }]}>
                  <View style={styles.sessionLeft}>
                    <Text style={[styles.sessionTitle, { color: t.text }]}>Current live session</Text>
                    <Text style={[styles.sessionMeta, { color: t.mutedText }]}>
                      {sessionSummary.setsLogged} logs · {sessionSummary.volume} volume
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={finishSession}
                    activeOpacity={0.85}
                    style={[styles.sessionButton, { backgroundColor: t.cardAlt, borderColor: t.border }]}
                  >
                    <Text style={[styles.sessionButtonText, { color: t.text }]}>Finish</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {finishedSessionSummary ? (
                <View style={[styles.summaryCard, { backgroundColor: t.card, borderColor: t.border }]}>
                  <Text style={[styles.summaryTitle, { color: t.text }]}>Last session summary</Text>
                  <Text style={[styles.summaryText, { color: t.mutedText }]}>
                    {finishedSessionSummary.logs} logs · {finishedSessionSummary.volume} volume ·{" "}
                    {finishedSessionSummary.heaviest > 0
                      ? formatWeightLabel(finishedSessionSummary.heaviest)
                      : "Bodyweight"}{" "}
                    heaviest · Best set {finishedSessionSummary.bestSet}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.prBoardCard, { backgroundColor: t.card, borderColor: t.border }]}>
                <View style={styles.prBoardHeader}>
                  <View>
                    <Text style={[styles.prBoardEyebrow, { color: t.mutedText }]}>PR Board</Text>
                    <Text style={[styles.prBoardTitle, { color: t.text }]}>Current records</Text>
                  </View>
                  <Ionicons name="trophy-outline" size={18} color={t.text} />
                </View>

                <View style={styles.prBoardGrid}>
                  {prBoardItems.map((record) => (
                    <TouchableOpacity
                      key={record.key}
                      onPress={() => scrollToLogCard(record.logId)}
                      activeOpacity={0.88}
                      style={[styles.prBoardItem, { backgroundColor: t.cardAlt, borderColor: t.border }]}
                    >
                      <View style={styles.prBoardItemTop}>
                        <View style={[styles.prBoardDot, { backgroundColor: record.accent }]} />
                        <Text style={[styles.prBoardLabel, { color: t.mutedText }]}>{record.label}</Text>
                      </View>
                      <Text style={[styles.prBoardValue, { color: t.text }]} numberOfLines={2}>
                        {record.value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={[styles.dashboardCard, { backgroundColor: t.card, borderColor: t.border }]}>
                <Pressable
                  onPress={() => setDashboardCollapsed((prev) => !prev)}
                  style={({ pressed }) => [styles.dashboardTopRow, pressed && styles.pressed]}
                >
                  <View style={styles.dashboardTitleWrap}>
                    <Text style={[styles.dashboardEyebrow, { color: t.mutedText }]}>Dashboard</Text>
                    <Text style={[styles.dashboardTitle, { color: t.text }]}>Progress snapshot</Text>
                  </View>

                  <View style={styles.dashboardRightHeader}>
                    <View style={[styles.dashboardPill, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                      <Text style={[styles.dashboardPillText, { color: t.text }]}>
                        {dashboardMetrics.totalSessions} sessions
                      </Text>
                    </View>
                    <Ionicons
                      name={dashboardCollapsed ? "chevron-down" : "chevron-up"}
                      size={18}
                      color={t.mutedText}
                    />
                  </View>
                </Pressable>

                {!dashboardCollapsed ? (
                  <>
                    <View style={[styles.dashboardHero, { borderColor: t.border }]}>
                      <View style={styles.dashboardHeroBlock}>
                        <Text style={[styles.dashboardHeroLabel, { color: t.mutedText }]}>Heaviest</Text>
                        <Text style={[styles.dashboardHeroValue, { color: t.text }]} numberOfLines={1}>
                          {dashboardMetrics.heaviestWeight > 0
                            ? formatWeightLabel(dashboardMetrics.heaviestWeight)
                            : "Bodyweight"}
                        </Text>
                      </View>

                      <View style={[styles.heroDivider, { backgroundColor: t.border }]} />

                      <View style={styles.dashboardHeroBlock}>
                        <Text style={[styles.dashboardHeroLabel, { color: t.mutedText }]}>Latest</Text>
                        <Text style={[styles.dashboardHeroValue, { color: t.text }]} numberOfLines={1}>
                          {lastLog ? `${formatCompactWeight(lastLog.weight)} · ${lastLog.reps}×${lastLog.sets}` : "None"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.dashboardGrid}>
                      <View style={[styles.dashboardStatCell, { borderColor: t.border }]}>
                        <Text style={[styles.dashboardStatLabel, { color: t.mutedText }]}>Total Volume</Text>
                        <Text style={[styles.dashboardStatValue, { color: t.text }]} numberOfLines={1}>
                          {dashboardMetrics.totalVolume}
                        </Text>
                      </View>

                      <View style={[styles.dashboardStatCell, { borderColor: t.border }]}>
                        <Text style={[styles.dashboardStatLabel, { color: t.mutedText }]}>Total Reps</Text>
                        <Text style={[styles.dashboardStatValue, { color: t.text }]} numberOfLines={1}>
                          {dashboardMetrics.totalReps}
                        </Text>
                      </View>

                      <View style={[styles.dashboardStatCell, { borderColor: t.border }]}>
                        <Text style={[styles.dashboardStatLabel, { color: t.mutedText }]}>Best Est. 1RM</Text>
                        <Text style={[styles.dashboardStatValue, { color: t.text }]} numberOfLines={1}>
                          {dashboardMetrics.bestEstimated1RM > 0
                            ? `${dashboardMetrics.bestEstimated1RM.toFixed(1)} kg`
                            : "—"}
                        </Text>
                      </View>

                      <View style={[styles.dashboardStatCell, { borderColor: t.border }]}>
                        <Text style={[styles.dashboardStatLabel, { color: t.mutedText }]}>Best Volume Set</Text>
                        <Text style={[styles.dashboardStatValue, { color: t.text }]} numberOfLines={1}>
                          {dashboardMetrics.bestVolumeLog
                            ? `${Number(dashboardMetrics.bestVolumeLog.volume ?? 0)}`
                            : "—"}
                        </Text>
                      </View>

                      <View style={[styles.dashboardStatCell, { borderColor: t.border }]}>
                        <Text style={[styles.dashboardStatLabel, { color: t.mutedText }]}>Bodyweight Rep PR</Text>
                        <Text style={[styles.dashboardStatValue, { color: t.text }]} numberOfLines={1}>
                          {dashboardMetrics.bodyweightRepPR > 0 ? dashboardMetrics.bodyweightRepPR : "—"}
                        </Text>
                      </View>

                      <View style={[styles.dashboardStatCell, { borderColor: t.border }]}>
                        <Text style={[styles.dashboardStatLabel, { color: t.mutedText }]}>Working Sets</Text>
                        <Text style={[styles.dashboardStatValue, { color: t.text }]} numberOfLines={1}>
                          {dashboardMetrics.totalSets}
                        </Text>
                      </View>
                    </View>



                    <View style={[styles.goalDashboardCard, { borderColor: t.border, backgroundColor: t.cardAlt }]}>
                      <View style={styles.goalDashboardHeader}>
                        <Text style={[styles.goalDashboardTitle, { color: t.text }]}>Last / Best / Goal</Text>
                        <Ionicons name="sparkles-outline" size={16} color={t.mutedText} />
                      </View>

                      <View style={styles.goalDashboardGrid}>
                        <View style={[styles.goalDashboardCell, { borderColor: t.border }]}>
                          <Text style={[styles.goalDashboardLabel, { color: t.mutedText }]}>Last</Text>
                          <Text style={[styles.goalDashboardValue, { color: t.text }]} numberOfLines={2}>{goalSnapshot.last}</Text>
                        </View>
                        <View style={[styles.goalDashboardCell, { borderColor: t.border }]}>
                          <Text style={[styles.goalDashboardLabel, { color: t.mutedText }]}>Best</Text>
                          <Text style={[styles.goalDashboardValue, { color: t.text }]} numberOfLines={2}>{goalSnapshot.best}</Text>
                        </View>
                        <View style={[styles.goalDashboardCell, { borderColor: t.border }]}>
                          <Text style={[styles.goalDashboardLabel, { color: t.mutedText }]}>Goal</Text>
                          <Text style={[styles.goalDashboardValue, { color: t.text }]} numberOfLines={2}>{goalSnapshot.goal}</Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.compareInsightCard,
                          currentComparableInsight.tone === "up"
                            ? styles.compareInsightUp
                            : currentComparableInsight.tone === "same"
                              ? styles.compareInsightSame
                              : currentComparableInsight.tone === "down"
                                ? styles.compareInsightDown
                                : styles.compareInsightNeutral,
                        ]}
                      >
                        <Text style={[styles.compareHintStrong, { color: t.text }]}>
                          {currentComparableInsight.title}
                        </Text>
                        {currentComparableInsight.details.map((detail) => (
                          <Text key={detail} style={[styles.compareHint, { color: t.mutedText }]}>
                            • {detail}
                          </Text>
                        ))}
                      </View>
                    </View>
                    <View style={styles.trendControlRow}>
                      <View style={styles.trendToggleWrap}>
                        {(["volume", "weight", "reps"] as TrendMetric[]).map((metric) => {
                          const active = trendMetric === metric;
                          return (
                            <TouchableOpacity
                              key={metric}
                              onPress={() => setTrendMetric(metric)}
                              activeOpacity={0.85}
                              style={[
                                styles.segmentButton,
                                { backgroundColor: t.cardAlt, borderColor: t.border },
                                active && { backgroundColor: t.primaryBg, borderColor: t.primaryBg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.segmentButtonText,
                                  { color: active ? t.primaryText : t.text },
                                ]}
                              >
                                {metric === "volume" ? "Volume" : metric === "weight" ? "Weight" : "Reps"}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View style={styles.trendToggleWrap}>
                        {(["graph", "list"] as TrendView[]).map((view) => {
                          const active = trendView === view;
                          return (
                            <TouchableOpacity
                              key={view}
                              onPress={() => setTrendView(view)}
                              activeOpacity={0.85}
                              style={[
                                styles.segmentButton,
                                { backgroundColor: t.cardAlt, borderColor: t.border },
                                active && { backgroundColor: t.primaryBg, borderColor: t.primaryBg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.segmentButtonText,
                                  { color: active ? t.primaryText : t.text },
                                ]}
                              >
                                {view === "graph" ? "Graph" : "List"}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {recentTrendLogs.length > 0 ? (
                      <View style={[styles.trendCard, { borderColor: t.border }]}>
                        <View style={styles.trendHeader}>
                          <Text style={[styles.trendTitle, { color: t.text }]}>
                            {trendMetric === "volume"
                              ? "Volume trend"
                              : trendMetric === "weight"
                                ? "Weight trend"
                                : "Rep trend"}
                          </Text>
                          <Text style={[styles.trendSubtitle, { color: t.mutedText }]}>
                            Last {recentTrendLogs.length} working logs
                          </Text>
                        </View>

                        {trendView === "graph" ? (
                          <>
                            <View style={styles.trendLegend}>
                              <View style={styles.trendLegendItem}>
                                <View style={[styles.trendLegendDot, { backgroundColor: "#60A5FA" }]} />
                                <Text style={[styles.trendLegendText, { color: t.mutedText }]}>Normal</Text>
                              </View>
                              <View style={styles.trendLegendItem}>
                                <View style={[styles.trendLegendDot, { backgroundColor: "#A78BFA" }]} />
                                <Text style={[styles.trendLegendText, { color: t.mutedText }]}>Highest</Text>
                              </View>
                              <View style={styles.trendLegendItem}>
                                <View style={[styles.trendLegendDot, { backgroundColor: "#F59E0B" }]} />
                                <Text style={[styles.trendLegendText, { color: t.mutedText }]}>Latest</Text>
                              </View>
                            </View>

                            <View style={styles.trendBars}>
                              {recentTrendLogs.map((log, idx) => {
                                const value = getTrendMetricValue(log, trendMetric);
                                const isHighest = value === trendMaxValue;
                                const isLatest = idx === recentTrendLogs.length - 1;
                                const height = Math.max(12, (value / trendMaxValue) * 78);

                                let barColor = "#60A5FA";
                                if (isHighest) barColor = "#A78BFA";
                                if (isLatest) barColor = "#F59E0B";

                                return (
                                  <View key={log.id} style={styles.trendBarWrap}>
                                    <Text style={[styles.trendTopLabel, { color: t.mutedText }]} numberOfLines={1}>
                                      {value > 0 ? String(value) : "0"}
                                    </Text>
                                    <View
                                      style={[
                                        styles.trendBar,
                                        {
                                          height,
                                          backgroundColor: barColor,
                                          opacity: log.pending ? 0.55 : 1,
                                        },
                                      ]}
                                    />
                                    <Text style={[styles.trendBottomLabel, { color: t.mutedText }]}>
                                      {format(new Date(log.created_at ?? Date.now()), "d")}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          </>
                        ) : (
                          <View style={styles.trendListWrap}>
                            {recentTrendLogs.map((log) => (
                              <View key={log.id} style={[styles.trendListRow, { borderColor: t.border }]}>
                                <Text style={[styles.trendListDate, { color: t.mutedText }]}>
                                  {format(new Date(log.created_at ?? Date.now()), "MMM d")}
                                </Text>
                                <Text style={[styles.trendListValue, { color: t.text }]}>
                                  {formatTrendMetricValue(trendMetric, getTrendMetricValue(log, trendMetric))}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>


              <View style={[styles.calloutCard, { backgroundColor: t.card, borderColor: t.border }]}>
                <Text style={[styles.calloutTitle, { color: t.text }]}>Trend callouts</Text>
                {trendCallouts.map((callout) => (
                  <Text key={callout} style={[styles.calloutText, { color: t.mutedText }]}>
                    • {callout}
                  </Text>
                ))}
              </View>

              <Pressable
                onLayout={(event) => {
                  advancedInsightsAnchorY.current = event.nativeEvent.layout.y;
                }}
                onPress={() => {
                  if (!slug) return;

                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                  router.push({
                    pathname: "/exercise/[slug]/advanced",
                    params: {
                      slug,
                      ...(tourActive && tourStep === "open_advanced" ? { tourStep: "open_advanced" } : {}),
                      tutorialProgramId: resolvedTutorialProgramId,
                      programId: resolvedTutorialProgramId,
                    },
                  });
                }}
                style={({ pressed }) => [
                  styles.advancedCard,
                  { backgroundColor: t.card, borderColor: t.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.advancedCardLeft}>
                  <View
                    style={[styles.advancedIconWrap, { backgroundColor: t.cardAlt, borderColor: t.border }]}
                  >
                    <Ionicons name="analytics-outline" size={18} color={t.text} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.advancedTitle, { color: t.text }]}>Advanced Insights</Text>
                    <Text style={[styles.advancedSubtitle, { color: t.mutedText }]}>
                      Time under tension, control, and deeper progress
                    </Text>
                    <Text style={[styles.advancedPreview, { color: t.mutedText }]}>
                      {tutPreviewLoading
                        ? "Loading TUT preview…"
                        : latestTut
                          ? `Latest TUT · ${formatDurationLabel(latestTut.tut_seconds)}`
                          : "No TUT data yet"}
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color={t.mutedText} />
              </Pressable>

              <View
                onLayout={(event) => {
                  loggerAnchorY.current = event.nativeEvent.layout.y;
                }}
                style={[styles.form, { backgroundColor: t.card, borderColor: t.border }]}
              >
                <View style={styles.formHeader}>
                  <Text style={[styles.formTitle, { color: t.text }]}>
                    {editingId ? "Edit Log" : "Live Logger"}
                  </Text>

                  {lastLog && !editingId ? (
                    <TouchableOpacity
                      onPress={repeatLastLog}
                      activeOpacity={0.85}
                      style={[styles.repeatBtn, { backgroundColor: t.cardAlt, borderColor: t.border }]}
                    >
                      <Ionicons name="refresh-outline" size={14} color={t.text} />
                      <Text style={[styles.repeatText, { color: t.text }]}>Repeat Last</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {lastLog ? (
                  <Text style={[styles.lastHint, { color: t.mutedText }]}>
                    Last: {formatLogLine(lastLog)}
                  </Text>
                ) : (
                  <Text style={[styles.lastHint, { color: t.mutedText }]}>
                    No logs yet. Add your first set below.
                  </Text>
                )}

                <View style={styles.tagRow}>
                  {(["working", "warmup", "topset"] as LogTag[]).map((tag) => {
                    const active = logTag === tag;
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => {
                          setLogTag(tag);
                          setStatusMsg(`${getLogTagLabel(tag)} selected.`);
                          setFormError("");
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.85}
                        style={[
                          styles.tagChip,
                          { backgroundColor: t.cardAlt, borderColor: t.border },
                          active && { backgroundColor: t.success, borderColor: t.success },
                        ]}
                      >
                        <Text style={[styles.tagText, { color: active ? "#fff" : t.text }]}>
                          {getLogTagLabel(tag)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.progressActions}>
                  <TouchableOpacity
                    onPress={applySameAsLast}
                    activeOpacity={0.85}
                    disabled={!lastLog}
                    style={[
                      styles.progressButton,
                      { backgroundColor: t.cardAlt, borderColor: t.border },
                      !lastLog && styles.progressButtonDisabled,
                    ]}
                  >
                    <Ionicons name="copy-outline" size={14} color={t.text} />
                    <Text style={[styles.progressButtonText, { color: t.text }]}>Same last</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={applySameAsLastWorking}
                    activeOpacity={0.85}
                    disabled={!lastWorkingLog}
                    style={[
                      styles.progressButton,
                      { backgroundColor: t.cardAlt, borderColor: t.border },
                      !lastWorkingLog && styles.progressButtonDisabled,
                    ]}
                  >
                    <Ionicons name="layers-outline" size={14} color={t.text} />
                    <Text style={[styles.progressButtonText, { color: t.text }]}>Last working</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={applySameAsBest}
                    activeOpacity={0.85}
                    disabled={!bestWorkingLog}
                    style={[
                      styles.progressButton,
                      { backgroundColor: t.cardAlt, borderColor: t.border },
                      !bestWorkingLog && styles.progressButtonDisabled,
                    ]}
                  >
                    <Ionicons name="trophy-outline" size={14} color={t.text} />
                    <Text style={[styles.progressButtonText, { color: t.text }]}>Best</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => applyPlusWeight(weightJump)}
                    activeOpacity={0.85}
                    style={[styles.progressButton, { backgroundColor: t.cardAlt, borderColor: t.border }]}
                  >
                    <Ionicons name="add-outline" size={14} color={t.text} />
                    <Text style={[styles.progressButtonText, { color: t.text }]}>{`+${weightJump} kg`}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => applyPlusRep(1)}
                    activeOpacity={0.85}
                    style={[styles.progressButton, { backgroundColor: t.cardAlt, borderColor: t.border }]}
                  >
                    <Ionicons name="add-outline" size={14} color={t.text} />
                    <Text style={[styles.progressButtonText, { color: t.text }]}>+1 rep</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => applyPlusSet(1)}
                    activeOpacity={0.85}
                    style={[styles.progressButton, { backgroundColor: t.cardAlt, borderColor: t.border }]}
                  >
                    <Ionicons name="add-outline" size={14} color={t.text} />
                    <Text style={[styles.progressButtonText, { color: t.text }]}>+1 set</Text>
                  </TouchableOpacity>
                </View>


                <View style={styles.quickConfigRow}>
                  <Text style={[styles.quickConfigLabel, { color: t.mutedText }]}>Weight jump</Text>
                  <View style={styles.weightJumpWrap}>
                    {[1.25, 2.5, 5].map((step) => {
                      const active = weightJump === step;
                      return (
                        <TouchableOpacity
                          key={step}
                          onPress={() => {
                            setWeightJump(step);
                            setStatusMsg(`Default jump set to ${step} kg.`);
                          }}
                          activeOpacity={0.85}
                          style={[
                            styles.weightJumpChip,
                            { backgroundColor: t.cardAlt, borderColor: t.border },
                            active && { backgroundColor: t.primaryBg, borderColor: t.primaryBg },
                          ]}
                        >
                          <Text style={[styles.weightJumpChipText, { color: active ? t.primaryText : t.text }]}>
                            {step} kg
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {suggestionActions.length > 0 ? (
                  <View style={styles.suggestionBlock}>
                    <Text style={[styles.quickConfigLabel, { color: t.mutedText }]}>Suggest next set</Text>
                    <View style={styles.suggestionRow}>
                      {suggestionActions.map((action) => (
                        <TouchableOpacity
                          key={action.id}
                          onPress={() => {
                            action.apply();
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                          activeOpacity={0.85}
                          style={[styles.suggestionChip, { backgroundColor: t.cardAlt, borderColor: t.border }]}
                        >
                          <Ionicons name={action.icon} size={14} color={t.text} />
                          <Text style={[styles.suggestionChipText, { color: t.text }]}>{action.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={styles.inputsRow}>
                  <View style={styles.inputBlock}>
                    <Text style={[styles.inputLabel, { color: t.mutedText }]}>Weight</Text>
                    <TextInput
                      placeholder="0"
                      placeholderTextColor={t.mutedText}
                      keyboardType="decimal-pad"
                      value={newLog.weight}
                      onChangeText={(text) => handleChange("weight", text)}
                      style={[
                        styles.input,
                        { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text },
                      ]}
                    />
                  </View>

                  <View style={styles.inputBlock}>
                    <Text style={[styles.inputLabel, { color: t.mutedText }]}>Reps</Text>
                    <TextInput
                      placeholder="8"
                      placeholderTextColor={t.mutedText}
                      keyboardType="number-pad"
                      value={newLog.reps}
                      onChangeText={(text) => handleChange("reps", text)}
                      style={[
                        styles.input,
                        { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text },
                      ]}
                    />
                  </View>

                  <View style={styles.inputBlock}>
                    <Text style={[styles.inputLabel, { color: t.mutedText }]}>Sets</Text>
                    <TextInput
                      placeholder="1"
                      placeholderTextColor={t.mutedText}
                      keyboardType="number-pad"
                      value={newLog.sets}
                      onChangeText={(text) => handleChange("sets", text)}
                      style={[
                        styles.input,
                        { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.noteBlock}>
                  <Text style={[styles.inputLabel, { color: t.mutedText }]}>Note / Tag</Text>
                  <TextInput
                    placeholder="Paused, strict, top set note..."
                    placeholderTextColor={t.mutedText}
                    value={newLog.note}
                    onChangeText={(text) => handleChange("note", text)}
                    style={[
                      styles.input,
                      { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text },
                    ]}
                  />
                </View>

                <View style={styles.formFooter}>
                  <View style={styles.footerMetaWrap}>
                    <Text style={[styles.volumeText, { color: t.mutedText }]}>Volume: {currentVolume}</Text>
                    <View style={styles.restRow}>
                      <Text style={[styles.restText, { color: t.mutedText }]}>
                        Rest: {restSecondsLeft > 0 ? `${restSecondsLeft}s` : "Ready"}
                      </Text>

                      <View style={styles.restPresets}>
                        {REST_PRESETS.map((seconds) => {
                          const active = restDuration === seconds;
                          return (
                            <TouchableOpacity
                              key={seconds}
                              onPress={() => {
                                setRestDuration(seconds);
                                setStatusMsg(`Rest timer set to ${seconds}s.`);
                              }}
                              activeOpacity={0.85}
                              style={[
                                styles.restPreset,
                                { backgroundColor: t.cardAlt, borderColor: t.border },
                                active && { backgroundColor: t.primaryBg, borderColor: t.primaryBg },
                              ]}
                            >
                              <Text style={[styles.restPresetText, { color: active ? t.primaryText : t.text }]}>
                                {seconds}s
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  <View style={styles.formButtons}>
                    {editingId ? (
                      <TouchableOpacity
                        onPress={resetForm}
                        activeOpacity={0.85}
                        style={[styles.cancelBtn, { backgroundColor: t.cardAlt, borderColor: t.border }]}
                      >
                        <Text style={[styles.cancelText, { color: t.text }]}>Cancel</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      onPress={editingId ? handleUpdate : handleSave}
                      activeOpacity={0.9}
                      style={[styles.saveBtn, { backgroundColor: editingId ? t.link : t.success }]}
                    >
                      <Text style={styles.saveText}>{editingId ? "Update Log" : "Add Log"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                {statusMsg ? <Text style={[styles.statusText, { color: t.mutedText }]}>{statusMsg}</Text> : null}
              </View>

              <View style={styles.logsHeader}>
                <Text style={[styles.logsTitle, { color: t.text }]}>Recent Logs</Text>
                <Text style={[styles.logsSubtitle, { color: t.mutedText }]}>{filteredLogs.length} shown</Text>
              </View>

              <View style={styles.historyTools}>
                <View style={styles.filterWrap}>
                  {(["all", "working", "warmup", "topset"] as LogFilter[]).map((filter) => {
                    const active = logFilter === filter;
                    return (
                      <TouchableOpacity
                        key={filter}
                        onPress={() => setLogFilter(filter)}
                        activeOpacity={0.85}
                        style={[
                          styles.filterChip,
                          { backgroundColor: t.cardAlt, borderColor: t.border },
                          active && { backgroundColor: t.primaryBg, borderColor: t.primaryBg },
                        ]}
                      >
                        <Text style={[styles.filterChipText, { color: active ? t.primaryText : t.text }]}>
                          {filter === "all" ? "All" : getLogTagLabel(filter as LogTag)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  placeholder="Search notes, tags, dates..."
                  placeholderTextColor={t.mutedText}
                  value={logSearch}
                  onChangeText={setLogSearch}
                  style={[
                    styles.searchInput,
                    { backgroundColor: t.cardAlt, borderColor: t.border, color: t.text },
                  ]}
                />
              </View>

              {filteredLogs.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: t.card, borderColor: t.border }]}>
                  <Ionicons name="barbell-outline" size={22} color={t.mutedText} />
                  <Text style={[styles.emptyTitle, { color: t.text }]}>
                    {logs.length === 0 ? "No logs yet" : "No matching logs"}
                  </Text>
                  <Text style={[styles.emptyText, { color: t.mutedText }]}>
                    {logs.length === 0
                      ? "Save your first set above to start tracking progress."
                      : "Try a different filter or clear your search."}
                  </Text>
                </View>
              ) : null}
            </>
          }
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 90 }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: "500" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    marginBottom: 10,
    minHeight: 52,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
  },
  headerSpacer: { width: 42, height: 42 },
  backText: { fontWeight: "700", fontSize: 14 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },

  title: {
    fontSize: 30,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.4,
  },

  contextChip: {
    alignSelf: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contextChipText: { fontSize: 12, fontWeight: "600" },
  contextChipStrong: { fontWeight: "700" },

  offlineChip: {
    alignSelf: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  offlineText: { fontSize: 12, fontWeight: "600" },

  sessionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sessionLeft: { flex: 1 },
  sessionTitle: { fontSize: 15, fontWeight: "700" },
  sessionMeta: { marginTop: 4, fontSize: 12, fontWeight: "600" },
  sessionButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sessionButtonText: { fontWeight: "700", fontSize: 13 },

  summaryCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  prBoardCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  prBoardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  prBoardEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 3,
  },
  prBoardTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.25,
  },
  prBoardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  prBoardItem: {
    width: DASHBOARD_CELL_WIDTH,
    minHeight: 94,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    justifyContent: "space-between",
  },
  prBoardItemTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  prBoardDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  prBoardLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  prBoardValue: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },

  dashboardCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  dashboardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  dashboardRightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dashboardTitleWrap: { flex: 1 },
  dashboardEyebrow: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 3,
  },
  dashboardTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  dashboardPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dashboardPillText: {
    fontSize: 12,
    fontWeight: "700",
  },

  dashboardHero: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 108,
  },
  dashboardHeroBlock: { flex: 1, justifyContent: "center" },
  dashboardHeroLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  dashboardHeroValue: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  heroDivider: {
    width: 1,
    alignSelf: "stretch",
    marginHorizontal: 14,
  },

  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    justifyContent: "space-between",
    rowGap: DASHBOARD_GAP,
  },
  dashboardStatCell: {
    width: DASHBOARD_CELL_WIDTH,
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    justifyContent: "space-between",
  },
  dashboardStatLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  dashboardStatValue: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  goalDashboardCard: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
  },
  goalDashboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  goalDashboardTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  goalDashboardGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  goalDashboardCell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    minHeight: 78,
    justifyContent: "space-between",
  },
  goalDashboardLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
  },
  goalDashboardValue: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },

  trendControlRow: {
    marginTop: 12,
    gap: 8,
  },
  trendToggleWrap: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  segmentButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  segmentButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },

  trendCard: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
  },
  trendHeader: {
    marginBottom: 10,
  },
  trendTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  trendSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
  },
  trendLegend: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  trendLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trendLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  trendLegendText: {
    fontSize: 11,
    fontWeight: "700",
  },
  trendBars: {
    height: 110,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  trendBarWrap: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
  },
  trendBar: {
    width: "100%",
    borderRadius: 999,
  },
  trendTopLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  trendBottomLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  trendListWrap: { gap: 8 },
  trendListRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trendListDate: {
    fontSize: 12,
    fontWeight: "600",
  },
  trendListValue: {
    fontSize: 13,
    fontWeight: "700",
  },

  calloutCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  calloutText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    marginBottom: 4,
  },

  advancedCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  advancedCardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  advancedIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  advancedTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  advancedSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  advancedPreview: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  compareCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  compareTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  compareGrid: {
    gap: 10,
  },
  compareCell: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  compareLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  compareValue: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
  compareInsightCard: {
    marginTop: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },
  compareInsightUp: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  compareInsightSame: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  compareInsightDown: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  compareInsightNeutral: {
    backgroundColor: "rgba(148, 163, 184, 0.08)",
    borderColor: "rgba(148, 163, 184, 0.28)",
  },
  compareHintStrong: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
    lineHeight: 18,
  },
  compareHint: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },

  form: {
    borderRadius: 24,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  formTitle: { fontWeight: "700", fontSize: 18 },
  repeatBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  repeatText: { fontSize: 12, fontWeight: "700" },
  lastHint: { marginTop: 8, fontSize: 13, fontWeight: "500" },

  tagRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  tagChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagText: {
    fontSize: 13,
    fontWeight: "700",
  },

  progressActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  progressButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressButtonDisabled: {
    opacity: 0.45,
  },

  quickConfigRow: {
    marginTop: 14,
    gap: 8,
  },
  quickConfigLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  weightJumpWrap: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  weightJumpChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weightJumpChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  suggestionBlock: {
    marginTop: 12,
    gap: 8,
  },
  suggestionRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  suggestionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: "700",
  },

  inputsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  inputBlock: { flex: 1 },
  noteBlock: { marginTop: 12 },
  inputLabel: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    fontWeight: "600",
  },

  formFooter: {
    marginTop: 14,
    gap: 12,
  },
  footerMetaWrap: { gap: 8 },
  volumeText: { fontWeight: "700", fontSize: 13 },

  restRow: { gap: 8 },
  restText: {
    fontSize: 12,
    fontWeight: "600",
  },
  restPresets: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  restPreset: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  restPresetText: {
    fontSize: 12,
    fontWeight: "700",
  },

  formButtons: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "flex-end",
  },
  cancelBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  cancelText: {
    fontWeight: "700",
    fontSize: 14,
  },
  saveBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  saveText: { color: "white", fontWeight: "700", fontSize: 14 },

  errorText: {
    color: "#dc2626",
    marginTop: 10,
    fontWeight: "600",
    fontSize: 12,
  },
  statusText: {
    marginTop: 10,
    fontWeight: "600",
    fontSize: 12,
  },

  logsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  logsTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  logsSubtitle: {
    fontSize: 12,
    fontWeight: "600",
  },

  historyTools: {
    gap: 10,
    marginBottom: 12,
  },
  filterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
  },

  emptyState: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: "center",
    marginBottom: 10,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
  },

  monthHeaderWrap: {
    paddingVertical: 6,
  },
  monthHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  logCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    overflow: "hidden",
  },
  logCardPr: {
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  logPrRail: {
    width: 4,
    borderRadius: 999,
    alignSelf: "stretch",
  },
  logLeft: {
    flex: 1,
    gap: 8,
  },
  logRight: {
    width: 96,
    justifyContent: "flex-start",
    gap: 8,
  },
  logTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logText: { fontSize: 16, fontWeight: "700", flex: 1 },
  logDate: { fontSize: 12, fontWeight: "500" },
  logMetaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  logMetaChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  logMetaChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  logIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 2,
  },
  logIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  logIndicatorHint: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
  },

  prHeroChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  prChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    opacity: 0.86,
  },
  prChipText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  contextFlagChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  contextFlagChipText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  pendingChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  pendingChipText: {
    fontSize: 11,
    fontWeight: "700",
  },

  noteToggleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  noteExpandedText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  sideActionBtn: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
  },
  sideActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
});

