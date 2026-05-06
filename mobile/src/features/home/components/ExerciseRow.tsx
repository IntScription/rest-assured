import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  Alert,
  Animated as A,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { supabase } from "@/src/lib/supabase";

import { ExerciseInsightSheet } from "./ExerciseInsightSheet";
import { publishLatestLog } from "../store/home-log-events";
import { setExerciseRoutePreview } from "../utils/exerciseRouteCache";
import { formatLatestLog } from "../utils/formatLatestLog";
import {
  getRepeatLogInsertPayload,
  getSmartRepeatSuggestion,
} from "../utils/smartRepeatLog";

import type { ExerciseProgressInfo } from "../utils/exerciseProgress";
import type { LatestLogLite } from "../types";

type ExerciseLite = {
  id: string;
  name: string;
  slug: string | null;
  split_id?: string | null;
};

type SplitLite = {
  id: string;
  name?: string | null;
};

type LogLite = {
  id: string;
  exercise_id: string;
  weight: number | null;
  reps: number;
  sets: number;
  created_at: string | null;
  type: string | null;
  day: string | null;
  volume?: number | null;
};

type MetricInfo = {
  text: string;
  color: string;
};

type Props = {
  item: ExerciseLite;
  index: number;
  stackSize: number;
  latestLog?: LatestLogLite | LogLite | null;
  progressInfo?: ExerciseProgressInfo;
  logHistory?: LogLite[];
  currentSplit?: SplitLite | null;
  uid: string;
  t: any;
  router: any;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  editValue: string;
  setEditValue: (value: string) => void;
  setExercisesBySplit: Dispatch<SetStateAction<Record<string, ExerciseLite[]>>>;
};

const MENU_MS = 2600;
const EMPTY_METRIC = "- - -";
const LOG_SELECT = "id, exercise_id, weight, reps, sets, created_at, type, day";
const latestRpeCache = new Map<string, number | null>();

const METRIC_COLORS = {
  light: {
    good: "#15803D",
    bad: "#DC2626",
    warning: "#B45309",
    neutral: "#2563EB",
    empty: "#64748B",
  },
  dark: {
    good: "#22C55E",
    bad: "#F87171",
    warning: "#F59E0B",
    neutral: "#60A5FA",
    empty: "#94A3B8",
  },
};

function isDarkTheme(t: any) {
  const value = String(t?.background ?? "").replace("#", "");
  if (value.length !== 6) return !!t?.dark;

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  return luminance < 0.5;
}

function metricColor(t: any, tone: keyof typeof METRIC_COLORS.light) {
  const palette = isDarkTheme(t) ? METRIC_COLORS.dark : METRIC_COLORS.light;
  return palette[tone];
}

/**
 * One shared metric animation is cheaper than 2 loops per row.
 * It keeps VOLUME/RPE label-value swapping synchronized and avoids
 * extra animation work when many ExerciseRows are mounted.
 */
const SHARED_METRIC_SWAP = new A.Value(0);
let sharedMetricLoop: A.CompositeAnimation | null = null;
let sharedMetricUsers = 0;
let sharedMetricStopTimer: ReturnType<typeof setTimeout> | null = null;

function retainSharedMetricLoop() {
  sharedMetricUsers += 1;

  if (sharedMetricStopTimer) {
    clearTimeout(sharedMetricStopTimer);
    sharedMetricStopTimer = null;
  }

  if (!sharedMetricLoop) {
    sharedMetricLoop = A.loop(
      A.sequence([
        A.delay(1050),
        A.timing(SHARED_METRIC_SWAP, {
          toValue: 1,
          duration: 190,
          useNativeDriver: true,
        }),
        A.delay(950),
        A.timing(SHARED_METRIC_SWAP, {
          toValue: 0,
          duration: 190,
          useNativeDriver: true,
        }),
        A.delay(320),
      ]),
    );

    sharedMetricLoop.start();
  }

  return () => {
    sharedMetricUsers = Math.max(0, sharedMetricUsers - 1);

    if (sharedMetricUsers > 0 || sharedMetricStopTimer) return;

    sharedMetricStopTimer = setTimeout(() => {
      if (sharedMetricUsers > 0) return;

      sharedMetricLoop?.stop();
      sharedMetricLoop = null;
      SHARED_METRIC_SWAP.setValue(0);
      sharedMetricStopTimer = null;
    }, 2500);
  };
}

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calcVolume(log?: Partial<LogLite> | null) {
  if (!log) return 0;
  return Math.max(1, n(log.weight)) * n(log.reps) * n(log.sets);
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value) || value <= 0) return EMPTY_METRIC;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000)
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `${Math.round(value)}`;
}

function formatRpe(value: number | null) {
  if (value == null || !Number.isFinite(value) || value <= 0) return EMPTY_METRIC;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatLast(value: string | null | undefined) {
  if (!value) return "never";

  const date = new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return "unknown";

  const diffMs = Date.now() - time;
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toneColor(t: any, tone?: ExerciseProgressInfo["tone"]) {
  if (tone === "up") return t.success ?? "#22C55E";
  if (tone === "down") return t.danger ?? "#EF4444";
  if (tone === "same" || tone === "new" || tone === "pending")
    return t.link ?? "#3B82F6";
  return t.primaryBg ?? t.link ?? "#3B82F6";
}

function volumeToneColor(
  t: any,
  latestVolume: number,
  previousVolume: number,
) {
  if (!Number.isFinite(latestVolume) || latestVolume <= 0) {
    return metricColor(t, "empty");
  }

  if (!Number.isFinite(previousVolume) || previousVolume <= 0) {
    return metricColor(t, "good");
  }

  if (latestVolume > previousVolume) return metricColor(t, "good");
  if (latestVolume < previousVolume) return metricColor(t, "bad");

  return metricColor(t, "neutral");
}

function rpeToneColor(t: any, rpe: number | null) {
  if (rpe == null || !Number.isFinite(rpe) || rpe <= 0) {
    return metricColor(t, "empty");
  }

  // For RPE, lower/manageable is good, very high is bad/fatigue.
  if (rpe >= 8.5) return metricColor(t, "bad");
  if (rpe >= 7.5) return metricColor(t, "warning");
  return metricColor(t, "good");
}

function mergeLog(history: LogLite[], log: LogLite) {
  const withoutDuplicate = history.filter((item) => item.id !== log.id);
  return [log, ...withoutDuplicate]
    .sort((a, b) =>
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
    )
    .slice(0, 20);
}

function normalizeLog(log?: LatestLogLite | LogLite | null): LogLite | null {
  if (!log?.id || !log.exercise_id) return null;

  const volume =
    (log as { volume?: number | null }).volume ??
    calcVolume(log as Partial<LogLite>);

  return {
    id: log.id,
    exercise_id: log.exercise_id,
    weight: log.weight ?? null,
    reps: Number(log.reps ?? 0),
    sets: Number(log.sets ?? 0),
    created_at: log.created_at ?? null,
    type: log.type ?? null,
    day: log.day ?? null,
    volume,
  };
}

function sameLog(
  a?: LatestLogLite | LogLite | null,
  b?: LatestLogLite | LogLite | null,
) {
  return (
    a?.id === b?.id &&
    a?.exercise_id === b?.exercise_id &&
    a?.weight === b?.weight &&
    a?.reps === b?.reps &&
    a?.sets === b?.sets &&
    a?.created_at === b?.created_at &&
    a?.type === b?.type &&
    a?.day === b?.day
  );
}

function useMetrics(
  history: LogLite[],
  latestLog: LogLite | LatestLogLite | null,
  latestAdvancedRpe: number | null,
  t: any,
): { last: string; volume: MetricInfo; rpe: MetricInfo } {
  return useMemo(() => {
    const latest = (latestLog as LogLite | null) ?? history[0] ?? null;
    const previous = history.find((log) => log.id !== latest?.id) ?? null;

    const latestVolume = calcVolume(latest);
    const previousVolume = calcVolume(previous);

    return {
      last: formatLast(latest?.created_at),
      volume: {
        text: formatCompactNumber(latestVolume),
        color: volumeToneColor(t, latestVolume, previousVolume),
      },
      rpe: {
        text: formatRpe(latestAdvancedRpe),
        color: rpeToneColor(t, latestAdvancedRpe),
      },
    };
  }, [history, latestLog, latestAdvancedRpe, t]);
}

type MetricPillProps = {
  label: string;
  value: string;
  color: string;
  t: any;
  onPress: () => void;
};

const MetricPill = memo(function MetricPill({
  label,
  value,
  color,
  t,
  onPress,
}: MetricPillProps) {
  useEffect(() => retainSharedMetricLoop(), []);

  const labelOpacity = SHARED_METRIC_SWAP.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const valueOpacity = SHARED_METRIC_SWAP.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const labelY = SHARED_METRIC_SWAP.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const valueY = SHARED_METRIC_SWAP.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  const displayValue = value?.trim() ? value : EMPTY_METRIC;
  const hasValue = displayValue !== EMPTY_METRIC;
  const valueColor = hasValue ? color : metricColor(t, "empty");
  const shellTint = isDarkTheme(t) ? "18" : "14";
  const borderTint = isDarkTheme(t) ? "70" : "66";

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[
        styles.pill,
        {
          borderColor: `${valueColor}${hasValue ? borderTint : "44"}`,
          backgroundColor: `${valueColor}${hasValue ? shellTint : "0D"}`,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.pillFill,
          {
            borderColor: `${valueColor}22`,
            backgroundColor: `${valueColor}${isDarkTheme(t) ? "08" : "06"}`,
          },
        ]}
      />

      <View style={styles.pillStage}>
        <A.Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[
            styles.pillText,
            styles.pillTextAbs,
            {
              color: t.mutedText,
              opacity: labelOpacity,
              transform: [{ translateY: labelY }],
            },
          ]}
        >
          {label}
        </A.Text>

        <A.Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[
            styles.pillText,
            styles.pillTextAbs,
            {
              color: valueColor,
              opacity: valueOpacity,
              transform: [{ translateY: valueY }],
            },
          ]}
        >
          {displayValue}
        </A.Text>
      </View>
    </TouchableOpacity>
  );
});

export const ExerciseRow = memo(
  function ExerciseRow({
    item,
    index,
    stackSize,
    latestLog,
    progressInfo,
    logHistory = [],
    currentSplit,
    uid,
    t,
    router,
    editingId,
    setEditingId,
    editValue,
    setEditValue,
    setExercisesBySplit,
  }: Props) {
    const isEditing = editingId === item.id;
    const [localHistory, setLocalHistory] = useState<LogLite[]>([]);
    const [latestAdvancedRpe, setLatestAdvancedRpe] = useState<number | null>(
      () => latestRpeCache.get(item.id) ?? null,
    );
    const [repeatBusy, setRepeatBusy] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [sheetMode, setSheetMode] = useState<"volume" | "rpe">("volume");

    const scale = useRef(new A.Value(1)).current;
    const flash = useRef(new A.Value(0)).current;
    const menuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const normalizedLatestLog = useMemo(
      () => normalizeLog(latestLog),
      [latestLog],
    );

    const normalizedLogHistory = useMemo(
      () =>
        logHistory
          .map((log) => normalizeLog(log))
          .filter((log): log is LogLite => !!log),
      [logHistory],
    );

    const history = normalizedLogHistory.length
      ? normalizedLogHistory
      : localHistory;
    const metrics = useMetrics(
      history,
      normalizedLatestLog,
      latestAdvancedRpe,
      t,
    );
    const repeatSuggestion = useMemo(
      () =>
        getSmartRepeatSuggestion(
          normalizedLatestLog as LatestLogLite | null,
          history as LatestLogLite[],
        ),
      [normalizedLatestLog, history],
    );
    const accent = toneColor(t, progressInfo?.tone);

    useEffect(() => {
      if (logHistory.length) return;
      if (!uid || !item.id) return;

      let mounted = true;

      supabase
        .from("logs")
        .select(LOG_SELECT)
        .eq("exercise_id", item.id)
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(10)
        .then(({ data }) => {
          if (mounted && data) {
            setLocalHistory(
              (data as LogLite[])
                .map((log) => normalizeLog(log))
                .filter((log): log is LogLite => !!log),
            );
          }
        });

      return () => {
        mounted = false;
      };
    }, [item.id, logHistory.length, uid]);

    useEffect(() => {
      if (!uid || !item.id) {
        setLatestAdvancedRpe(null);
        latestRpeCache.set(item.id, null);
        return;
      }

      if (latestRpeCache.has(item.id)) {
        setLatestAdvancedRpe(latestRpeCache.get(item.id) ?? null);
      }

      let mounted = true;

      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          if (!mounted) return;

          supabase
            .from("exercise_tut_logs")
            .select("rpe")
            .eq("exercise_id", item.id)
            .eq("user_id", uid)
            .not("rpe", "is", null)
            .order("performed_on", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => {
              if (!mounted) return;

              const rpe = data?.rpe == null ? null : Number(data.rpe);
              const nextRpe = Number.isFinite(rpe ?? NaN) ? rpe : null;

              latestRpeCache.set(item.id, nextRpe);
              setLatestAdvancedRpe(nextRpe);
            });
        });
      }, 160);

      return () => {
        mounted = false;
        clearTimeout(timer);
      };
    }, [item.id, uid]);

    useEffect(() => {
      if (!logHistory.length && normalizedLatestLog?.id) {
        setLocalHistory((prev) => mergeLog(prev, normalizedLatestLog));
      }
    }, [logHistory.length, normalizedLatestLog]);

    useEffect(() => {
      return () => {
        if (menuTimer.current) clearTimeout(menuTimer.current);
      };
    }, []);

    const animateScale = useCallback(
      (toValue: number) =>
        A.spring(scale, {
          toValue,
          useNativeDriver: true,
          damping: 18,
          stiffness: 260,
          mass: 0.7,
        }).start(),
      [scale],
    );

    const flashCard = useCallback(() => {
      flash.setValue(0);

      A.sequence([
        A.timing(flash, { toValue: 1, duration: 130, useNativeDriver: true }),
        A.timing(flash, { toValue: 0, duration: 360, useNativeDriver: true }),
      ]).start();
    }, [flash]);

    const closeMenu = useCallback(() => {
      if (menuTimer.current) clearTimeout(menuTimer.current);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMenuOpen(false);
    }, []);

    const openMenu = useCallback(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMenuOpen(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (menuTimer.current) clearTimeout(menuTimer.current);

      menuTimer.current = setTimeout(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setMenuOpen(false);
      }, MENU_MS);
    }, []);

    const openSheet = useCallback((mode: "volume" | "rpe") => {
      setSheetMode(mode);
      setSheetVisible(true);
    }, []);

    const openExercise = useCallback(() => {
      if (!item.slug || isEditing) return;

      setExerciseRoutePreview({
        exercise: item,
        latestLog: normalizedLatestLog as LatestLogLite | null,
        progressInfo,
      });

      router.push({
        pathname: `/exercise/${item.slug}` as any,
        params: {
          exerciseId: item.id,
          exerciseName: item.name,
          latestLogId: normalizedLatestLog?.id ?? "",
        },
      });
    }, [item, normalizedLatestLog, progressInfo, router, isEditing]);

    const cancelEdit = useCallback(() => {
      setEditingId(null);
      setEditValue("");
    }, [setEditingId, setEditValue]);

    const startEdit = useCallback(() => {
      closeMenu();
      setEditingId(item.id);
      setEditValue(item.name);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [closeMenu, item.id, item.name, setEditingId, setEditValue]);

    const rename = useCallback(async () => {
      if (!currentSplit?.id || !uid) return;

      const name = editValue.trim();
      if (!name)
        return Alert.alert("Name required", "Exercise name cannot be empty.");
      if (name === item.name) return cancelEdit();

      const { error } = await supabase
        .from("exercises")
        .update({ name })
        .eq("id", item.id)
        .eq("user_id", uid);

      if (error) return Alert.alert("Rename failed", error.message);

      setExercisesBySplit((prev) => ({
        ...prev,
        [currentSplit.id]: (prev[currentSplit.id] ?? []).map((x) =>
          x.id === item.id ? { ...x, name } : x,
        ),
      }));

      cancelEdit();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, [
      currentSplit?.id,
      uid,
      editValue,
      item.id,
      item.name,
      setExercisesBySplit,
      cancelEdit,
    ]);

    const deleteExercise = useCallback(() => {
      Alert.alert("Delete Exercise?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel", onPress: closeMenu },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!currentSplit?.id || !uid) return;

            const { error } = await supabase
              .from("exercises")
              .delete()
              .eq("id", item.id)
              .eq("user_id", uid);

            if (error) return Alert.alert("Delete failed", error.message);

            setExercisesBySplit((prev) => ({
              ...prev,
              [currentSplit.id]: (prev[currentSplit.id] ?? []).filter(
                (x) => x.id !== item.id,
              ),
            }));

            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]);
    }, [closeMenu, currentSplit?.id, uid, item.id, setExercisesBySplit]);

    const repeatLog = useCallback(async () => {
      if (
        !uid ||
        !item.slug ||
        !normalizedLatestLog ||
        !repeatSuggestion ||
        repeatBusy ||
        isEditing
      )
        return;

      setRepeatBusy(true);
      closeMenu();
      flashCard();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        const payload = getRepeatLogInsertPayload({
          userId: uid,
          exerciseId: item.id,
          suggestion: repeatSuggestion,
        });

        const { data, error } = await supabase
          .from("logs")
          .insert(payload as any)
          .select(LOG_SELECT)
          .single();

        if (error) return Alert.alert("Repeat log failed", error.message);

        const newLog = normalizeLog(data as LogLite | null);
        if (newLog) {
          publishLatestLog(newLog as LatestLogLite);
          setLocalHistory((prev) => mergeLog(prev, newLog));
        }

        setExerciseRoutePreview({
          exercise: item,
          latestLog:
            (newLog as LatestLogLite | null) ??
            (normalizedLatestLog as LatestLogLite | null),
          progressInfo,
        });

        router.push({
          pathname: `/exercise/${item.slug}` as any,
          params: {
            exerciseId: item.id,
            exerciseName: item.name,
            repeatedLog: "true",
            repeatNote: repeatSuggestion.note,
            latestLogId: newLog?.id ?? normalizedLatestLog.id,
          },
        });
      } finally {
        setRepeatBusy(false);
      }
    }, [
      uid,
      item,
      normalizedLatestLog,
      repeatSuggestion,
      repeatBusy,
      isEditing,
      closeMenu,
      flashCard,
      progressInfo,
      router,
    ]);

    return (
      <A.View
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[
          styles.card,
          {
            transform: [{ translateY: index * 3 }, { scale }],
            zIndex: stackSize - index,
            borderColor: progressInfo?.isPr ? accent : t.border,
            backgroundColor: t.cardAlt,
          },
        ]}
      >
        <A.View
          pointerEvents="none"
          style={[
            styles.flash,
            {
              backgroundColor: accent,
              opacity: flash.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.12],
              }),
            },
          ]}
        />

        {progressInfo?.isPr && (
          <View
            pointerEvents="none"
            style={[
              styles.prGlow,
              { borderColor: accent, backgroundColor: `${accent}08` },
            ]}
          />
        )}

        <View style={styles.row}>
          {isEditing ? (
            <View style={styles.editWrap}>
              <TextInput
                value={editValue}
                onChangeText={setEditValue}
                onSubmitEditing={rename}
                autoFocus
                returnKeyType="done"
                selectTextOnFocus
                placeholder="Exercise name"
                placeholderTextColor={t.mutedText}
                style={[
                  styles.input,
                  {
                    color: t.text,
                    borderColor: t.inputBorder ?? t.border,
                    backgroundColor: t.card,
                  },
                ]}
              />

              <TouchableOpacity
                onPress={rename}
                activeOpacity={0.85}
                style={[styles.editBtn, { backgroundColor: t.primaryBg }]}
              >
                <Ionicons name="checkmark" size={18} color={t.primaryText} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={cancelEdit}
                activeOpacity={0.85}
                style={[
                  styles.editBtn,
                  { backgroundColor: `${t.mutedText}18` },
                ]}
              >
                <Ionicons name="close" size={18} color={t.mutedText} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Pressable
                style={styles.content}
                onPress={openExercise}
                onPressIn={() => animateScale(0.985)}
                onPressOut={() => animateScale(1)}
              >
                <View style={styles.titleRow}>
                  <Text
                    numberOfLines={1}
                    style={[styles.title, { color: t.text }]}
                  >
                    {item.name}
                  </Text>

                  {progressInfo?.isPr && (
                    <View style={[styles.prBadge, { backgroundColor: accent }]}>
                      <Ionicons name="flame" size={11} color={t.primaryText} />
                      <Text style={[styles.prText, { color: t.primaryText }]}>
                        {progressInfo.prLabel ?? "PR"}
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  numberOfLines={1}
                  style={[styles.subtitle, { color: t.mutedText }]}
                >
                  {formatLatestLog(normalizedLatestLog as LatestLogLite | null)}
                </Text>

                <View style={styles.lastRow}>
                  <Ionicons name="time-outline" size={10} color={t.mutedText} />
                  <Text
                    numberOfLines={1}
                    style={[styles.lastText, { color: t.mutedText }]}
                  >
                    Last {metrics.last}
                  </Text>
                </View>

                <View style={styles.metrics}>
                  <MetricPill
                    label="VOLUME"
                    value={metrics.volume.text}
                    color={metrics.volume.color}
                    t={t}
                    onPress={() => openSheet("volume")}
                  />
                  <MetricPill
                    label="RPE"
                    value={metrics.rpe.text}
                    color={metrics.rpe.color}
                    t={t}
                    onPress={() => openSheet("rpe")}
                  />
                </View>
              </Pressable>

              <View style={styles.actions}>
                {menuOpen ? (
                  <View style={styles.iconRow}>
                    {!!normalizedLatestLog && (
                      <TouchableOpacity
                        disabled={repeatBusy}
                        onPress={repeatLog}
                        hitSlop={10}
                        activeOpacity={0.85}
                        style={[
                          styles.iconBtn,
                          {
                            borderColor: t.border,
                            opacity: repeatBusy ? 0.65 : 1,
                          },
                        ]}
                      >
                        <Ionicons
                          name="repeat-outline"
                          size={15}
                          color={t.text}
                        />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={startEdit}
                      hitSlop={10}
                      activeOpacity={0.85}
                      style={[styles.iconBtn, { borderColor: t.border }]}
                    >
                      <Ionicons
                        name="create-outline"
                        size={15}
                        color={t.text}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={deleteExercise}
                      hitSlop={10}
                      activeOpacity={0.85}
                      style={[styles.iconBtn, { borderColor: t.danger }]}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color={t.danger}
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={openMenu}
                    hitSlop={15}
                    activeOpacity={0.7}
                    style={[styles.dotsBtn, { borderColor: t.border }]}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={16}
                      color={t.text}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>

        {sheetVisible && (
          <ExerciseInsightSheet
            visible={sheetVisible}
            onClose={() => setSheetVisible(false)}
            initialMode={sheetMode}
            logs={history}
            exerciseName={item.name}
            slug={item.slug ?? undefined}
            t={t}
          />
        )}
      </A.View>
    );
  },
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item.name === next.item.name &&
    prev.item.slug === next.item.slug &&
    prev.index === next.index &&
    prev.stackSize === next.stackSize &&
    prev.currentSplit?.id === next.currentSplit?.id &&
    sameLog(prev.latestLog, next.latestLog) &&
    prev.logHistory?.length === next.logHistory?.length &&
    sameLog(prev.logHistory?.[0], next.logHistory?.[0]) &&
    prev.editingId === next.editingId &&
    prev.editValue === next.editValue &&
    prev.uid === next.uid &&
    prev.t === next.t &&
    prev.progressInfo?.tone === next.progressInfo?.tone &&
    prev.progressInfo?.isPr === next.progressInfo?.isPr &&
    prev.progressInfo?.prLabel === next.progressInfo?.prLabel,
);

const styles = StyleSheet.create({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1.4,
    width: "100%",
    overflow: "hidden",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  flash: { ...StyleSheet.absoluteFillObject },
  prGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderRadius: 20,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  content: { flex: 1, justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { flex: 1, fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
  subtitle: { marginTop: 3, fontSize: 13, fontWeight: "600" },
  lastRow: {
    marginTop: 7,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
  },
  lastText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.1,
    includeFontPadding: false,
  },
  metrics: { marginTop: 9, flexDirection: "row", alignItems: "center", gap: 7 },
  pill: {
    width: 88,
    height: 28,
    borderRadius: 10,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  pillFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 1.2,
  },
  pillStage: {
    width: "100%",
    height: 15,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pillText: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 0,
    includeFontPadding: false,
  },
  pillTextAbs: { position: "absolute", left: 2, right: 2, textAlign: "center" },
  prBadge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  prText: { fontSize: 9, fontWeight: "900" },
  actions: {
    minWidth: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  iconRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  dotsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  editWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "800",
  },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});

