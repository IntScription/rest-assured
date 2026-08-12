import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";

import { supabase } from "@/src/lib/supabase";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Mode = "volume" | "rpe" | "combined";
type RangeSize = 10 | 20;

type Props = {
  visible: boolean;
  onClose: () => void;
  initialMode?: Mode;
  logs: any[];
  exerciseName: string;
  slug?: string;
  t: any;
};

type Stat = {
  label: string;
  value: string | number;
  color?: string;
};

type TutEntry = {
  id: string;
  tut_seconds: number;
  load_kg: number | null;
  sets: number;
  reps: number;
  rpe: number | null;
  rest_seconds: number | null;
  note: string | null;
  performed_on: string;
  created_at?: string | null;
};

type VolumePoint = {
  date: string;
  volume: number;
  logs: any[];
  bestLog: any | null;
  latestLog: any | null;
};

type RpePoint = {
  date: string;
  avgRpe: number;
  highestRpe: number;
  latestRpe: number;
  entries: TutEntry[];
  latestEntry: TutEntry | null;
  bestTut: number;
};

type CombinedPoint = {
  date: string;
  volumePoint?: VolumePoint;
  rpePoint?: RpePoint;
};

const RPE_COLOR = "#F59E0B";
const VOLUME_COLOR = "#22C55E";
const LOAD_COLOR = "#3B82F6";

const n = (v: any) => Number(v ?? 0);

const volumeOf = (log: any) => {
  const explicitVolume = Number(log?.volume ?? 0);
  if (Number.isFinite(explicitVolume) && explicitVolume > 0) {
    return explicitVolume;
  }

  return Math.max(1, n(log?.weight)) * n(log?.reps) * n(log?.sets);
};

const formatVol = (v: number) =>
  v > 9999 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;

const normalizeDateForDisplay = (date?: string | null) => {
  if (!date) return "";

  return String(date).slice(0, 10);
};

const trainingDateOfLog = (log: any) => {
  return (
    normalizeDateForDisplay(log?.log_date) ||
    normalizeDateForDisplay(log?.created_at)
  );
};

const trainingDateOfRpe = (entry: TutEntry) => {
  return (
    normalizeDateForDisplay(entry?.performed_on) ||
    normalizeDateForDisplay(entry?.created_at)
  );
};

const formatChartDate = (date?: string | null) => {
  const normalized = normalizeDateForDisplay(date);
  if (!normalized) return "—";

  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const formatFullDate = (date?: string | null) => {
  const normalized = normalizeDateForDisplay(date);
  if (!normalized) return "—";

  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const modeLabel = (mode: Mode) => {
  if (mode === "combined") return "Compare";
  if (mode === "rpe") return "RPE";
  return "Volume";
};

const loadLabel = (weight: any) => {
  const value = n(weight);
  if (!Number.isFinite(value) || value <= 0) return "BW";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}kg`;
};

const tutLoadLabel = (entry: TutEntry) => {
  const value = n(entry.load_kg);
  if (!Number.isFinite(value) || value <= 0) return "BW";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}kg`;
};

const getRpeTone = (value: number, t: any) => {
  if (value >= 8.5) return t.danger;
  if (value >= 7) return RPE_COLOR;
  return t.success ?? VOLUME_COLOR;
};

function sortLogsByTrainingDateDesc(logs: any[]) {
  return [...logs].sort((a, b) => {
    const dateCompare = String(trainingDateOfLog(b)).localeCompare(
      String(trainingDateOfLog(a))
    );

    if (dateCompare !== 0) return dateCompare;

    return String(b?.created_at ?? "").localeCompare(String(a?.created_at ?? ""));
  });
}

function sortRpeEntriesByTrainingDateDesc(entries: TutEntry[]) {
  return [...entries].sort((a, b) => {
    const dateCompare = String(trainingDateOfRpe(b)).localeCompare(
      String(trainingDateOfRpe(a))
    );

    if (dateCompare !== 0) return dateCompare;

    return String(b?.created_at ?? "").localeCompare(String(a?.created_at ?? ""));
  });
}

function buildVolumePoints(logs: any[]): VolumePoint[] {
  const buckets = new Map<string, any[]>();

  for (const log of logs) {
    const date = trainingDateOfLog(log);
    if (!date) continue;

    const next = buckets.get(date) ?? [];
    next.push(log);
    buckets.set(date, next);
  }

  return Array.from(buckets.entries())
    .map(([date, bucketLogs]) => {
      const sortedBucketLogs = sortLogsByTrainingDateDesc(bucketLogs);
      const bestLog = [...bucketLogs].sort(
        (a, b) => volumeOf(b) - volumeOf(a)
      )[0] ?? null;

      return {
        date,
        logs: sortedBucketLogs,
        volume: bucketLogs.reduce((sum, log) => sum + volumeOf(log), 0),
        bestLog,
        latestLog: sortedBucketLogs[0] ?? null,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function buildRpePoints(entries: TutEntry[]): RpePoint[] {
  const buckets = new Map<string, TutEntry[]>();

  for (const entry of entries) {
    const date = trainingDateOfRpe(entry);
    if (!date || entry.rpe == null) continue;

    const next = buckets.get(date) ?? [];
    next.push(entry);
    buckets.set(date, next);
  }

  return Array.from(buckets.entries())
    .map(([date, bucketEntries]) => {
      const sortedEntries = sortRpeEntriesByTrainingDateDesc(bucketEntries);
      const rpeValues = bucketEntries
        .map((entry) => n(entry.rpe))
        .filter((value) => Number.isFinite(value) && value > 0);

      const avgRpe = rpeValues.length
        ? rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length
        : 0;

      return {
        date,
        avgRpe,
        highestRpe: Math.max(0, ...rpeValues),
        latestRpe: sortedEntries[0]?.rpe == null ? 0 : n(sortedEntries[0].rpe),
        entries: sortedEntries,
        latestEntry: sortedEntries[0] ?? null,
        bestTut: Math.max(0, ...bucketEntries.map((entry) => n(entry.tut_seconds))),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function buildCombinedPoints({
  volumePoints,
  rpePoints,
  rangeSize,
}: {
  volumePoints: VolumePoint[];
  rpePoints: RpePoint[];
  rangeSize: RangeSize;
}): CombinedPoint[] {
  const byVolumeDate = new Map(volumePoints.map((point) => [point.date, point]));
  const byRpeDate = new Map(rpePoints.map((point) => [point.date, point]));

  const dates = Array.from(
    new Set([...byVolumeDate.keys(), ...byRpeDate.keys()])
  )
    .sort((a, b) => b.localeCompare(a))
    .slice(0, rangeSize)
    .reverse();

  return dates.map((date) => ({
    date,
    volumePoint: byVolumeDate.get(date),
    rpePoint: byRpeDate.get(date),
  }));
}

export function ExerciseInsightSheet({
  visible,
  onClose,
  initialMode = "volume",
  logs = [],
  exerciseName,
  slug,
  t,
}: Props) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [rangeSize, setRangeSize] = useState<RangeSize>(10);
  const [activeLogIndex, setActiveLogIndex] = useState<number | null>(null);
  const [freshLogs, setFreshLogs] = useState<any[]>([]);
  const [rpeEntries, setRpeEntries] = useState<TutEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [rpeLoading, setRpeLoading] = useState(false);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const graphAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      graphAnim.setValue(0);
      return;
    }

    setMode(initialMode);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }),
      Animated.timing(graphAnim, {
        toValue: 1,
        duration: 420,
        delay: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, initialMode, translateY, graphAnim]);

  useEffect(() => {
    setActiveLogIndex(null);
  }, [mode, rangeSize]);

  useEffect(() => {
    if (!visible || !slug) return;

    let active = true;

    async function loadFreshExerciseData() {
      setDataLoading(true);
      setRpeLoading(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active || !user) return;

        const { data: exerciseData, error: exerciseError } = await supabase
          .from("exercises")
          .select("id")
          .eq("slug", slug)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!active) return;

        if (exerciseError || !exerciseData?.id) {
          setFreshLogs([]);
          setRpeEntries([]);
          return;
        }

        const [logResponse, rpeResponse] = await Promise.all([
          supabase
            .from("logs")
            .select("id, exercise_id, weight, reps, sets, volume, created_at, log_date, type, day")
            .eq("exercise_id", exerciseData.id)
            .eq("user_id", user.id)
            .order("log_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(240),
          supabase
            .from("exercise_tut_logs")
            .select(
              "id, tut_seconds, load_kg, sets, reps, rpe, rest_seconds, note, performed_on, created_at"
            )
            .eq("exercise_id", exerciseData.id)
            .eq("user_id", user.id)
            .not("rpe", "is", null)
            .order("performed_on", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(120),
        ]);

        if (!active) return;

        if (logResponse.error) {
          console.warn("Failed to load fresh volume logs", logResponse.error);
          setFreshLogs([]);
        } else {
          setFreshLogs((logResponse.data ?? []) as any[]);
        }

        if (rpeResponse.error) {
          console.warn("Failed to load advanced RPE entries", rpeResponse.error);
          setRpeEntries([]);
        } else {
          setRpeEntries(((rpeResponse.data ?? []) as TutEntry[]).filter((entry) => entry.rpe != null));
        }
      } finally {
        if (active) {
          setDataLoading(false);
          setRpeLoading(false);
        }
      }
    }

    void loadFreshExerciseData();

    return () => {
      active = false;
    };
  }, [visible, slug]);

  const closeSheet = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 240,
      useNativeDriver: true,
    }).start(onClose);
  }, [onClose, translateY]);

  const effectiveLogs = useMemo(() => {
    return freshLogs.length > 0 ? freshLogs : logs;
  }, [freshLogs, logs]);

  const sortedLogs = useMemo(
    () => sortLogsByTrainingDateDesc(effectiveLogs),
    [effectiveLogs]
  );

  const sortedRpeEntries = useMemo(
    () => sortRpeEntriesByTrainingDateDesc(rpeEntries),
    [rpeEntries]
  );

  const volumePoints = useMemo(
    () => buildVolumePoints(sortedLogs),
    [sortedLogs]
  );

  const rpePoints = useMemo(
    () => buildRpePoints(sortedRpeEntries),
    [sortedRpeEntries]
  );

  const chartVolumePoints = useMemo(
    () => volumePoints.slice(0, rangeSize).reverse(),
    [rangeSize, volumePoints]
  );

  const chartRpePoints = useMemo(
    () => rpePoints.slice(0, rangeSize).reverse(),
    [rangeSize, rpePoints]
  );

  const combinedPoints = useMemo(
    () => buildCombinedPoints({ volumePoints, rpePoints, rangeSize }),
    [rangeSize, rpePoints, volumePoints]
  );

  const volumeData = useMemo(
    () => chartVolumePoints.map((point) => point.volume),
    [chartVolumePoints]
  );

  const rpeData = useMemo(
    () => chartRpePoints.map((point) => point.avgRpe),
    [chartRpePoints]
  );

  const selectedCombinedPoint =
    mode === "combined" && activeLogIndex !== null
      ? combinedPoints[activeLogIndex] ?? null
      : null;

  const selectedVolumePoint =
    activeLogIndex !== null
      ? mode === "combined"
        ? selectedCombinedPoint?.volumePoint ?? null
        : mode !== "rpe"
          ? chartVolumePoints[activeLogIndex] ?? null
          : null
      : null;

  const selectedRpePoint =
    activeLogIndex !== null
      ? mode === "combined"
        ? selectedCombinedPoint?.rpePoint ?? null
        : mode === "rpe"
          ? chartRpePoints[activeLogIndex] ?? null
          : null
      : null;

  const selectedVolumeLog = selectedVolumePoint?.bestLog ?? null;
  const selectedRpeEntry = selectedRpePoint?.latestEntry ?? null;

  const hasVolumeData = volumePoints.length > 0;
  const hasRpeData = rpePoints.some((point) => point.avgRpe > 0);
  const hasAnyData = hasVolumeData || hasRpeData;

  const summary = useMemo(() => {
    const totalVolume = volumePoints.reduce((sum, point) => sum + point.volume, 0);
    const bestVolume = Math.max(0, ...volumePoints.map((point) => point.volume));
    const avgVolume = volumePoints.length
      ? Math.round(totalVolume / volumePoints.length)
      : 0;

    const allRpeValues = rpePoints
      .flatMap((point) => point.entries.map((entry) => n(entry.rpe)))
      .filter((rpe) => rpe > 0);

    const avgRpe = allRpeValues.length
      ? allRpeValues.reduce((sum, rpe) => sum + rpe, 0) / allRpeValues.length
      : null;

    const recentVolumes = volumePoints.slice(0, 2).map((point) => point.volume);
    const trendPct =
      recentVolumes.length >= 2 && recentVolumes[1] > 0
        ? Math.round(((recentVolumes[0] - recentVolumes[1]) / recentVolumes[1]) * 100)
        : null;

    const bestLoad = Math.max(0, ...sortedLogs.map((log) => n(log.weight)));
    const est1RM = Math.max(
      0,
      ...sortedLogs.map((log) => n(log.weight) * (1 + n(log.reps) / 30))
    );
    const highestRpe = Math.max(0, ...allRpeValues);
    const latestRpe = rpePoints[0]?.latestRpe ?? 0;
    const bestTut = Math.max(0, ...rpePoints.map((point) => point.bestTut));

    return {
      totalVolume,
      bestVolume,
      avgVolume,
      avgRpe,
      trendPct,
      bestLoad,
      est1RM,
      highestRpe,
      latestRpe,
      bestTut,
    };
  }, [rpePoints, sortedLogs, volumePoints]);

  const fatigueState = useMemo(() => {
    if (summary.avgRpe == null) return "—";
    if (summary.avgRpe >= 8.5) return "High";
    if (summary.avgRpe >= 7) return "Moderate";
    return "Optimal";
  }, [summary.avgRpe]);

  const recoveryWarning = useMemo(() => {
    if (mode !== "rpe" && mode !== "combined") return null;
    if (summary.avgRpe == null) return null;

    if (summary.avgRpe >= 8.5 && summary.trendPct != null && summary.trendPct < 0) {
      return "High effort + lower output — recovery may be limiting performance.";
    }

    if (summary.avgRpe >= 8.5) {
      return "High average RPE — consider watching fatigue before pushing load.";
    }

    return null;
  }, [mode, summary.avgRpe, summary.trendPct]);

  const insightSentence = useMemo(() => {
    if (dataLoading) return "Refreshing calendar-based logs and graph dates...";

    if (mode === "rpe") {
      if (!hasRpeData) return "Add an advanced entry to unlock effort and fatigue trends.";
      if (summary.avgRpe == null) return "RPE data is building up.";
      if (summary.avgRpe >= 8.5) return "Effort is running high across recent advanced logs.";
      if (summary.avgRpe >= 7) return "Effort looks moderate — good for controlled progress.";
      return "Effort looks manageable across your advanced logs.";
    }

    if (mode === "combined") {
      if (!hasVolumeData && !hasRpeData) return "Log volume or advanced RPE data to compare output and effort.";
      if (!hasRpeData) return "Volume is available. Add advanced RPE entries to compare effort.";
      if (!hasVolumeData) return "RPE is available. Add normal logs to compare output.";
      return "Volume and RPE are aligned by actual training date.";
    }

    if (!hasVolumeData) return "Add normal workout logs to unlock volume insights.";
    if (summary.trendPct == null) return "Volume trend will appear after more training dates.";
    if (summary.trendPct > 0) return `Volume is up ${summary.trendPct}% versus your previous training date.`;
    if (summary.trendPct < 0) return `Volume is down ${Math.abs(summary.trendPct)}% versus your previous training date.`;
    return "Volume is steady versus your previous training date.";
  }, [
    dataLoading,
    hasRpeData,
    hasVolumeData,
    mode,
    summary.avgRpe,
    summary.trendPct,
  ]);

  const stats = useMemo<Stat[]>(() => {
    if (mode === "combined" && selectedCombinedPoint) {
      return [
        {
          label: `Date • ${formatFullDate(selectedCombinedPoint.date)}`,
          value: selectedCombinedPoint.rpePoint && selectedCombinedPoint.volumePoint
            ? "Volume + RPE"
            : selectedCombinedPoint.volumePoint
              ? "Volume only"
              : "RPE only",
          color: t.text,
        },
        {
          label: "Volume",
          value: selectedCombinedPoint.volumePoint
            ? formatVol(selectedCombinedPoint.volumePoint.volume)
            : "—",
          color: VOLUME_COLOR,
        },
        {
          label: "Avg RPE",
          value: selectedCombinedPoint.rpePoint
            ? selectedCombinedPoint.rpePoint.avgRpe.toFixed(1)
            : "—",
          color: selectedCombinedPoint.rpePoint
            ? getRpeTone(selectedCombinedPoint.rpePoint.avgRpe, t)
            : t.text,
        },
        {
          label: "Entries",
          value:
            (selectedCombinedPoint.volumePoint?.logs.length ?? 0) +
            (selectedCombinedPoint.rpePoint?.entries.length ?? 0),
        },
      ];
    }

    if (selectedRpePoint && mode === "rpe") {
      return [
        {
          label: `RPE • ${formatFullDate(selectedRpePoint.date)}`,
          value: selectedRpePoint.avgRpe.toFixed(1),
          color: getRpeTone(selectedRpePoint.avgRpe, t),
        },
        {
          label: "Load",
          value: selectedRpeEntry ? tutLoadLabel(selectedRpeEntry) : "—",
          color: LOAD_COLOR,
        },
        { label: "Best TUT", value: `${selectedRpePoint.bestTut}s` },
        { label: "Entries", value: selectedRpePoint.entries.length },
      ];
    }

    if (selectedVolumePoint) {
      const bestLog = selectedVolumePoint.bestLog;
      const load = loadLabel(bestLog?.weight);

      return [
        {
          label: `Volume • ${formatFullDate(selectedVolumePoint.date)}`,
          value: formatVol(selectedVolumePoint.volume),
          color: VOLUME_COLOR,
        },
        {
          label: "Best Log",
          value: bestLog
            ? `${load} × ${bestLog.reps ?? 0} × ${bestLog.sets ?? 0}`
            : "—",
        },
        { label: "Logs", value: selectedVolumePoint.logs.length },
        {
          label: "Load",
          value: bestLog ? load : "—",
          color: LOAD_COLOR,
        },
      ];
    }

    if (mode === "volume") {
      return [
        { label: "Best Date", value: summary.bestVolume ? formatVol(summary.bestVolume) : "—", color: VOLUME_COLOR },
        { label: "Avg Date", value: summary.avgVolume ? formatVol(summary.avgVolume) : "—" },
        { label: "Total", value: summary.totalVolume ? formatVol(summary.totalVolume) : "—" },
        {
          label: "Trend",
          value: summary.trendPct == null ? "—" : summary.trendPct > 0 ? `+${summary.trendPct}%` : `${summary.trendPct}%`,
          color: summary.trendPct == null ? t.text : summary.trendPct >= 0 ? t.success : t.danger,
        },
      ];
    }

    if (mode === "rpe") {
      return [
        { label: "Latest RPE", value: summary.latestRpe || "—", color: n(summary.latestRpe) >= 8.5 ? t.danger : t.success },
        { label: "Highest RPE", value: summary.highestRpe || "—", color: summary.highestRpe >= 8.5 ? t.danger : t.text },
        { label: "Avg RPE", value: summary.avgRpe == null ? "—" : summary.avgRpe.toFixed(1) },
        {
          label: "Fatigue",
          value: fatigueState,
          color: fatigueState === "High" ? t.danger : fatigueState === "Moderate" ? RPE_COLOR : fatigueState === "Optimal" ? t.success : t.text,
        },
      ];
    }

    return [
      { label: "Best Load", value: summary.bestLoad > 0 ? `${summary.bestLoad}kg` : "—", color: LOAD_COLOR },
      { label: "Est. 1RM", value: summary.est1RM > 0 ? `${summary.est1RM.toFixed(1)}kg` : "—" },
      { label: "Avg RPE", value: summary.avgRpe == null ? "—" : summary.avgRpe.toFixed(1), color: summary.avgRpe == null ? t.text : getRpeTone(summary.avgRpe, t) },
      {
        label: "Vol Trend",
        value: summary.trendPct == null ? "—" : summary.trendPct > 0 ? `+${summary.trendPct}%` : `${summary.trendPct}%`,
        color: summary.trendPct == null ? t.text : summary.trendPct >= 0 ? t.success : t.danger,
      },
    ];
  }, [
    fatigueState,
    mode,
    selectedCombinedPoint,
    selectedRpeEntry,
    selectedRpePoint,
    selectedVolumePoint,
    summary,
    t,
  ]);

  const handleNav = useCallback(
    (path: "logs" | "advanced") => {
      closeSheet();
      if (!slug) return;
      router.push(path === "logs" ? (`/exercise/${slug}` as any) : (`/exercise/${slug}/advanced` as any));
    },
    [closeSheet, router, slug]
  );

  const selectBar = useCallback((index: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveLogIndex((prev) => (prev === index ? null : index));
  }, []);

  const switchMode = useCallback((nextMode: Mode) => {
    void Haptics.selectionAsync();
    setMode(nextMode);
  }, []);

  const switchRange = useCallback((nextRange: RangeSize) => {
    void Haptics.selectionAsync();
    setRangeSize(nextRange);
  }, []);

  const renderEmptyState = (kind: "volume" | "rpe" | "combined", color: string) => {
    const isRpe = kind === "rpe";
    const title = isRpe
      ? "No RPE data yet"
      : kind === "combined"
        ? "Not enough data to compare"
        : "No volume logs yet";
    const body = isRpe
      ? "RPE lives inside Advanced Insights with TUT, rest, and tempo notes."
      : kind === "combined"
        ? "Add normal logs and advanced RPE entries to compare output with effort by date."
        : "Add workout logs from this exercise to unlock date-based volume insights.";

    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyDash, { color: t.mutedText }]}>- - - - -</Text>
        <Text style={[styles.emptyTitle, { color: t.text }]}>{title}</Text>
        <Text style={[styles.emptyText, { color: t.mutedText }]}>{body}</Text>

        <TouchableOpacity
          onPress={() => handleNav(isRpe || kind === "combined" ? "advanced" : "logs")}
          style={[styles.logBtn, { backgroundColor: color }]}
          activeOpacity={0.85}
        >
          <Ionicons name={isRpe || kind === "combined" ? "analytics-outline" : "add"} size={14} color="#FFF" />
          <Text style={styles.logBtnText}>
            {isRpe || kind === "combined" ? "Open Advanced" : "Log Volume"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSingleBars = ({
    data,
    points,
    color,
    maxValue,
    isRpe = false,
  }: {
    data: number[];
    points: (VolumePoint | RpePoint)[];
    color: string;
    maxValue: number;
    isRpe?: boolean;
  }) => {
    const max = Math.max(maxValue, 1);
    const bestValue = Math.max(0, ...data);
    const latestIndex = data.length - 1;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScroll}
      >
        {data.map((value, index) => {
          const point = points[index];
          const heightPct = Math.max(8, (value / max) * 100);
          const focused = activeLogIndex === index;
          const faded = activeLogIndex !== null && !focused;
          const isLatest = index === latestIndex;
          const isBest = value === bestValue && bestValue > 0;
          const barColor = isBest && !isRpe ? VOLUME_COLOR : color;

          return (
            <TouchableOpacity
              key={`${mode}-${point?.date ?? index}`}
              activeOpacity={0.9}
              onPress={() => selectBar(index)}
              style={styles.barWrap}
            >
              <View style={styles.barTopDotWrap}>
                {isLatest || isBest ? (
                  <View
                    style={[
                      styles.barTopDot,
                      { backgroundColor: isBest ? VOLUME_COLOR : color },
                    ]}
                  />
                ) : null}
              </View>

              <View
                style={[
                  styles.bar,
                  {
                    height: `${heightPct}%`,
                    backgroundColor: barColor,
                    opacity: faded ? 0.25 : isLatest || isBest || focused ? 1 : 0.58,
                  },
                ]}
              />

              <Text
                numberOfLines={1}
                style={[
                  styles.barDateLabel,
                  { color: t.mutedText, opacity: focused ? 1 : 0.68 },
                ]}
              >
                {formatChartDate(point?.date)}
              </Text>

              <Text
                numberOfLines={1}
                style={[
                  styles.barValueLabel,
                  { color: t.mutedText, opacity: focused ? 1 : 0.55 },
                ]}
              >
                {isRpe
                  ? value > 0
                    ? value.toFixed(value % 1 === 0 ? 0 : 1)
                    : "—"
                  : formatVol(value)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderCompareBars = () => {
    const maxVol = Math.max(
      ...combinedPoints.map((point) => point.volumePoint?.volume ?? 0),
      1
    ) * 1.2;

    if (!combinedPoints.length || (!hasVolumeData && !hasRpeData)) {
      return renderEmptyState("combined", RPE_COLOR);
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScroll}
      >
        {combinedPoints.map((point, index) => {
          const volume = point.volumePoint?.volume ?? 0;
          const rpe = point.rpePoint?.avgRpe ?? 0;
          const focused = activeLogIndex === index;
          const faded = activeLogIndex !== null && !focused;

          return (
            <TouchableOpacity
              key={`compare-${point.date}`}
              activeOpacity={0.9}
              onPress={() => selectBar(index)}
              style={styles.comboWrap}
            >
              <View style={styles.comboBars}>
                <View
                  style={[
                    styles.comboBar,
                    {
                      height: `${Math.max(8, (volume / maxVol) * 100)}%`,
                      backgroundColor: VOLUME_COLOR,
                      opacity: volume > 0 ? (faded ? 0.25 : 0.85) : 0.14,
                    },
                  ]}
                />

                <View
                  style={[
                    styles.comboBar,
                    {
                      height: `${Math.max(8, (rpe / 10) * 100)}%`,
                      backgroundColor: RPE_COLOR,
                      opacity: rpe > 0 ? (faded ? 0.25 : 0.85) : 0.14,
                    },
                  ]}
                />
              </View>

              <Text
                numberOfLines={1}
                style={[
                  styles.comboLabel,
                  { color: t.mutedText, opacity: focused ? 1 : 0.65 },
                ]}
              >
                {formatChartDate(point.date)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const selectedTitle = useMemo(() => {
    if (selectedCombinedPoint) {
      return `Selected ${formatFullDate(selectedCombinedPoint.date)}`;
    }
    if (mode === "rpe" && selectedRpePoint) {
      return `Selected ${formatFullDate(selectedRpePoint.date)}`;
    }
    if (selectedVolumePoint) {
      return `Selected ${formatFullDate(selectedVolumePoint.date)}`;
    }
    return null;
  }, [mode, selectedCombinedPoint, selectedRpePoint, selectedVolumePoint]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.overlayWrapper}>
        <Pressable style={styles.overlayBg} onPress={closeSheet} />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: t.background,
              transform: [{ translateY }],
            },
          ]}
        >
          <BlurView intensity={75} tint={t.dark ? "dark" : "light"} style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
                {exerciseName} Progress
              </Text>

              <Text style={[styles.subtitle, { color: t.mutedText }]}>
                {hasAnyData ? "Date-based volume, effort, and trend" : "Add logs to unlock insights"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={closeSheet}
              activeOpacity={0.75}
              style={[styles.closeBtn, { backgroundColor: t.cardAlt }]}
            >
              <Ionicons name="close" size={20} color={t.text} />
            </TouchableOpacity>
          </BlurView>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <View style={[styles.graphCard, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={styles.graphTopRow}>
                {mode === "combined" ? (
                  <View style={styles.legendRow}>
                    <Legend color={VOLUME_COLOR} label="Volume" t={t} />
                    <Legend color={RPE_COLOR} label="RPE" t={t} />
                  </View>
                ) : (
                  <Text style={[styles.graphTitle, { color: t.text }]}>{modeLabel(mode)}</Text>
                )}

                <View style={[styles.rangeToggle, { borderColor: t.border, backgroundColor: t.cardAlt }]}>
                  {([10, 20] as RangeSize[]).map((item) => {
                    const active = rangeSize === item;

                    return (
                      <Pressable
                        key={item}
                        onPress={() => switchRange(item)}
                        style={[styles.rangeBtn, active && { backgroundColor: t.primaryBg }]}
                      >
                        <Text style={[styles.rangeText, { color: active ? t.primaryText : t.mutedText }]}>
                          {item}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {selectedTitle ? (
                <View style={[styles.selectedPill, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                  <Ionicons name="calendar-outline" size={12} color={t.mutedText} />
                  <Text style={[styles.selectedText, { color: t.mutedText }]}>{selectedTitle}</Text>
                </View>
              ) : null}

              <View style={[styles.insightPill, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                <Ionicons
                  name={mode === "rpe" ? "speedometer-outline" : mode === "combined" ? "git-compare-outline" : "analytics-outline"}
                  size={14}
                  color={mode === "rpe" ? RPE_COLOR : VOLUME_COLOR}
                />
                <Text style={[styles.insightText, { color: t.text }]}>{insightSentence}</Text>
              </View>

              <Animated.View
                style={[
                  styles.graphStage,
                  {
                    opacity: graphAnim,
                    transform: [
                      {
                        translateY: graphAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {mode === "volume" &&
                  (dataLoading ? (
                    <LoadingGraph t={t} />
                  ) : !hasVolumeData ? (
                    renderEmptyState("volume", VOLUME_COLOR)
                  ) : (
                    renderSingleBars({
                      data: volumeData,
                      points: chartVolumePoints,
                      color: VOLUME_COLOR,
                      maxValue: Math.max(...volumeData, 1) * 1.2,
                    })
                  ))}

                {mode === "rpe" &&
                  (rpeLoading ? (
                    <LoadingGraph t={t} />
                  ) : !hasRpeData ? (
                    renderEmptyState("rpe", RPE_COLOR)
                  ) : (
                    renderSingleBars({
                      data: rpeData,
                      points: chartRpePoints,
                      color: RPE_COLOR,
                      maxValue: 10,
                      isRpe: true,
                    })
                  ))}

                {mode === "combined" && (dataLoading || rpeLoading ? <LoadingGraph t={t} /> : renderCompareBars())}
              </Animated.View>
            </View>

            {recoveryWarning ? (
              <View
                style={[
                  styles.warningCard,
                  {
                    backgroundColor: `${t.danger}12`,
                    borderColor: `${t.danger}30`,
                  },
                ]}
              >
                <Ionicons name="warning-outline" size={16} color={t.danger} />
                <Text style={[styles.warningText, { color: t.danger }]}>{recoveryWarning}</Text>
              </View>
            ) : null}

            <Text style={[styles.sectionTitle, { color: t.text }]}>Stats</Text>

            <View style={styles.statsGrid}>
              {stats.map((stat) => (
                <StatCell
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  color={stat.color ?? t.text}
                  t={t}
                />
              ))}

              {!!selectedVolumeLog?.day ? (
                <View style={[styles.statCellFull, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                  <Text style={[styles.statLabel, { color: t.mutedText }]}>NOTES / TAGS</Text>
                  <Text style={[styles.noteText, { color: t.text }]} numberOfLines={3}>
                    {selectedVolumeLog.day}
                  </Text>
                </View>
              ) : null}

              {!!selectedRpeEntry?.note ? (
                <View style={[styles.statCellFull, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                  <Text style={[styles.statLabel, { color: t.mutedText }]}>ADVANCED NOTE</Text>
                  <Text style={[styles.noteText, { color: t.text }]} numberOfLines={3}>
                    {selectedRpeEntry.note}
                  </Text>
                </View>
              ) : null}

              {activeLogIndex !== null ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setActiveLogIndex(null)}
                  style={[
                    styles.statCellFull,
                    {
                      backgroundColor: `${t.danger}12`,
                      borderColor: `${t.danger}30`,
                      flexDirection: "row",
                      gap: 6,
                    },
                  ]}
                >
                  <Ionicons name="close-circle-outline" size={18} color={t.danger} />
                  <Text style={[styles.clearText, { color: t.danger }]}>CLEAR SELECTION</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => handleNav("advanced")}
              style={[styles.advancedCta, { backgroundColor: t.card, borderColor: t.border }]}
            >
              <View style={[styles.advancedIconWrap, { backgroundColor: t.cardAlt }]}>
                <Ionicons name="analytics-outline" size={18} color={t.text} />
              </View>
              <View style={styles.advancedCtaTextWrap}>
                <Text style={[styles.advancedCtaTitle, { color: t.text }]}>Open Advanced TUT</Text>
                <Text style={[styles.advancedCtaBody, { color: t.mutedText }]}>Track tempo, holds, RPE, rest, and control notes.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.mutedText} />
            </TouchableOpacity>

            <View style={[styles.toggleRow, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
              {(["volume", "rpe", "combined"] as Mode[]).map((item) => {
                const active = mode === item;

                return (
                  <Pressable
                    key={item}
                    onPress={() => switchMode(item)}
                    style={[styles.toggleBtn, active && { backgroundColor: t.primaryBg }]}
                  >
                    <Text style={[styles.toggleText, { color: active ? t.primaryText : t.text }]}>
                      {modeLabel(item)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function LoadingGraph({ t }: { t: any }) {
  return (
    <View style={styles.loadingGraph}>
      <ActivityIndicator color={t.text} />
      <Text style={[styles.loadingGraphText, { color: t.mutedText }]}>Loading date-based graph data…</Text>
    </View>
  );
}

function Legend({ color, label, t }: { color: string; label: string; t: any }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: t.text }]}>{label}</Text>
    </View>
  );
}

function StatCell({
  label,
  value,
  color,
  t,
}: {
  label: string;
  value: string | number;
  color: string;
  t: any;
}) {
  return (
    <View style={[styles.statCell, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
      <Text style={[styles.statLabel, { color: t.mutedText }]} numberOfLines={1}>
        {label}
      </Text>

      <Text style={[styles.statValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },

  overlayBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.65)",
  },

  sheet: {
    maxHeight: SCREEN_HEIGHT * 0.9,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
    overflow: "hidden",
  },

  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  headerText: {
    flex: 1,
    paddingRight: 12,
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  body: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 48,
  },

  graphCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },

  graphTopRow: {
    minHeight: 28,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  graphTitle: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  rangeToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
  },

  rangeBtn: {
    minWidth: 34,
    paddingVertical: 5,
    borderRadius: 999,
    alignItems: "center",
  },

  rangeText: {
    fontSize: 11,
    fontWeight: "900",
  },

  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  legendText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  selectedPill: {
    alignSelf: "flex-start",
    minHeight: 24,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  selectedText: {
    fontSize: 11,
    fontWeight: "800",
  },

  insightPill: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  insightText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },

  graphStage: {
    height: 170,
    width: "100%",
  },

  chartScroll: {
    flexGrow: 1,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 2,
  },

  barWrap: {
    width: 42,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  barTopDotWrap: {
    height: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },

  barTopDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },

  bar: {
    width: 18,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    marginBottom: 6,
  },

  barDateLabel: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900",
    maxWidth: 42,
    textAlign: "center",
  },

  barValueLabel: {
    marginTop: 1,
    fontSize: 8.5,
    lineHeight: 10,
    fontWeight: "800",
    maxWidth: 42,
    textAlign: "center",
  },

  comboWrap: {
    width: 44,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  comboBars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 3,
  },

  comboBar: {
    width: 10,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },

  comboLabel: {
    marginTop: 5,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900",
    maxWidth: 44,
    textAlign: "center",
  },

  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
  },

  emptyDash: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 4,
    opacity: 0.2,
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyText: {
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.72,
    lineHeight: 17,
    textAlign: "center",
  },

  logBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  logBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 13,
  },

  loadingGraph: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  loadingGraphText: {
    fontSize: 12,
    fontWeight: "700",
  },

  warningCard: {
    marginBottom: 18,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
    marginLeft: 4,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },

  statCell: {
    width: "48%",
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  statCellFull: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  statValue: {
    fontSize: 18,
    fontWeight: "800",
  },

  noteText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  clearText: {
    fontSize: 13,
    fontWeight: "800",
  },

  advancedCta: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  advancedIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  advancedCtaTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  advancedCtaTitle: {
    fontSize: 14,
    fontWeight: "900",
  },

  advancedCtaBody: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },

  toggleRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 16,
    padding: 4,
  },

  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  toggleText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
