import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
  Easing,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { useIsOnline } from "@/hooks/use-is-online";
import { cacheGetJson, cacheKey, cacheSetJson } from "@/src/lib/offline-cache";
import { enqueueAction, removePendingAction } from "@/src/lib/offline/queue";
import { logError, logWarn } from "@/src/lib/logger";
import { flushPendingActions } from "@/src/lib/offline/sync";
import type { CachedLog } from "@/src/lib/offline/types";
import OnboardingBanner from "@/src/components/OnboardingBanner";
import { useLatestCallback } from "@/src/hooks/useLatestCallback";
import {
  getOnboardingStep,
  isOnboardingActive,
  setOnboardingStep,
} from "@/src/lib/onboarding";

import ExerciseBackground from "@/src/features/exercise/components/ExerciseBackground";
import ExerciseHeader from "@/src/features/exercise/components/ExerciseHeader";
import ProgressGraphCard from "@/src/features/exercise/components/ProgressGraphCard";
import { ExerciseInsightSheet } from "@/src/features/home/components/ExerciseInsightSheet";
import { getExerciseRoutePreview } from "@/src/features/home/utils/exerciseRouteCache";
import {
  getExercisePrefsPreview,
  setExercisePrefsPreview,
} from "@/src/features/exercise/utils/exercisePrefsCache";
import TrainingSummaryDeck from "@/src/features/exercise/components/TrainingSummaryDeck";
import { useRestTimer } from "@/src/features/exercise/hooks/useRestTimer";
import QuickLoggerCard from "@/src/features/exercise/components/QuickLoggerCard";
import {
  APPROX_LOG_CARD_HEIGHT,
  DASHBOARD_CELL_WIDTH,
  DASHBOARD_GAP,
  EXERCISE_BACKGROUND,
  EXERCISE_BUBBLES,
  PR_COLORS,
} from "@/src/features/exercise/constants";
import type {
  ExerciseCacheShape,
  ExercisePrefs,
  ExerciseRow,
  LogFilter,
  LogMarkers,
  LogRow,
  LogTag,
  RecordShortcut,
  SessionSummary,
  SplitRowLite,
  SuggestionAction,
  TrendMetric,
  TrendView,
  TutPreviewRow,
} from "@/src/features/exercise/types";
import {
  addInteger,
  addWeight,
  calculateVolume,
  formatCompactWeight,
  formatComparableLine,
  formatDurationLabel,
  formatLogDate,
  formatLogLine,
  formatWeightLabel,
  getApproxScrollOffsetForIndex,
  getLogTag,
  getLogTagLabel,
  getMonthLabel,
  getValidationError,
  isDarkColor,
  matchesSearch,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
} from "@/src/features/exercise/utils/formatters";
import { getCoachNextSetInsight } from "@/src/features/exercise/utils/coachNextSetInsight";
import { detectPlateau } from "@/src/features/exercise/utils/plateauDetection";
import {
  getCurrentPrOwners,
  getLogAchievement,
  getPrBoardItems,
  getPrFlags,
} from "@/src/features/exercise/utils/prLogic";
import {
  getProgressInsight,
  getTrendCallouts,
} from "@/src/features/exercise/utils/trendLogic";
import { getExerciseDueSoonMessage } from "@/src/features/training-intelligence/dueSoon";

type LogListCardProps = {
  item: LogRow;
  showMonthHeader: boolean;
  currentMonth: string;
  monthCollapsed: boolean;
  noteExpanded: boolean;
  markers: LogMarkers;
  leftAccentColor: string;
  t: ReturnType<typeof useAppTheme>;
  onToggleMonth: (month: string) => void;
  onDuplicate: (log: LogRow) => void;
  onEdit: (log: LogRow) => void;
  onDelete: (id: string) => void;
  onToggleNote: (id: string) => void;
};

function sameMarkers(a: LogMarkers, b: LogMarkers) {
  return (
    a.isCurrentHeaviest === b.isCurrentHeaviest &&
    a.isCurrentVolume === b.isCurrentVolume &&
    a.isCurrentRep === b.isCurrentRep &&
    a.isPreviousHeaviest === b.isPreviousHeaviest &&
    a.isPreviousVolume === b.isPreviousVolume &&
    a.isPreviousRep === b.isPreviousRep &&
    a.isTodayHeaviest === b.isTodayHeaviest &&
    a.isTodayVolume === b.isTodayVolume &&
    a.isSessionBest === b.isSessionBest &&
    a.hasAnyPr === b.hasAnyPr
  );
}

function sameTheme(a: ReturnType<typeof useAppTheme>, b: ReturnType<typeof useAppTheme>) {
  return (
    a.card === b.card &&
    a.cardAlt === b.cardAlt &&
    a.border === b.border &&
    a.text === b.text &&
    a.mutedText === b.mutedText &&
    a.link === b.link &&
    a.secondaryBg === b.secondaryBg &&
    a.secondaryText === b.secondaryText &&
    a.danger === b.danger
  );
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeRouteDate(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  return getTodayDateString();
}

function isFutureDateString(dateString: string) {
  return dateString.localeCompare(getTodayDateString()) > 0;
}

function getDatePart(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function getTrainingDate(log?: Partial<LogRow> & { log_date?: string | null } | null) {
  if (!log) return getTodayDateString();

  const logDate = getDatePart(log.log_date);
  const createdDate = getDatePart(log.created_at);
  const today = getTodayDateString();

  /**
   * Safety guard for old rows after the log_date migration:
   * some existing March/April logs can accidentally have log_date = today
   * because the new column defaulted to current_date.
   * If created_at is older than today, trust created_at for those legacy rows.
   */
  if (logDate === today && createdDate && createdDate < today) {
    return createdDate;
  }

  if (logDate) return logDate;
  if (createdDate) return createdDate;
  return today;
}

function sortLogsByTrainingDateDesc<T extends Partial<LogRow> & { log_date?: string | null }>(items: T[]) {
  return [...items].sort((a, b) => {
    const dateCompare = getTrainingDate(b).localeCompare(getTrainingDate(a));
    if (dateCompare !== 0) return dateCompare;

    return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
  });
}

const LogListCard = memo(function LogListCard({
  item,
  showMonthHeader,
  currentMonth,
  monthCollapsed,
  noteExpanded,
  markers,
  leftAccentColor,
  t,
  onToggleMonth,
  onDuplicate,
  onEdit,
  onDelete,
  onToggleNote,
}: LogListCardProps) {
  return (
    <>
      {showMonthHeader ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onToggleMonth(currentMonth)}
          style={styles.monthHeaderWrap}
        >
          <Text style={[styles.monthHeaderText, { color: t.mutedText }]}>
            {currentMonth} {monthCollapsed ? "· Tap to expand" : "· Tap to collapse"}
          </Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.92}
        onLongPress={() => onDuplicate(item)}
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

          <Text style={[styles.logDate, { color: t.mutedText }]}>{formatLogDate(getTrainingDate(item))}</Text>
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

            {item.rpe ? (
              <View style={[styles.logMetaChip, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                <Text style={[styles.logMetaChipText, { color: t.text }]}>
                  RPE {item.rpe}
                </Text>
              </View>
            ) : null}

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
                    ? "Current rep PR"
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
                onPress={() => onToggleNote(item.id)}
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
            onPress={() => onDuplicate(item)}
            activeOpacity={0.85}
            accessibilityLabel="Duplicate log"
            style={[styles.sideActionBtn, { backgroundColor: t.cardAlt, borderColor: t.border }]}
          >
            <Ionicons name="copy-outline" size={17} color={t.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onEdit(item)}
            activeOpacity={0.85}
            accessibilityLabel="Edit log"
            style={[styles.sideActionBtn, { backgroundColor: t.secondaryBg, borderColor: t.secondaryBg }]}
          >
            <Ionicons name="create-outline" size={17} color={t.secondaryText} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onDelete(item.id)}
            activeOpacity={0.85}
            accessibilityLabel="Delete log"
            style={[styles.sideActionBtn, { backgroundColor: t.danger, borderColor: t.danger }]}
          >
            <Ionicons name="trash-outline" size={17} color="#fff" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </>
  );
}, (prev, next) => {
  return (
    prev.item === next.item &&
    prev.showMonthHeader === next.showMonthHeader &&
    prev.currentMonth === next.currentMonth &&
    prev.monthCollapsed === next.monthCollapsed &&
    prev.noteExpanded === next.noteExpanded &&
    prev.leftAccentColor === next.leftAccentColor &&
    sameMarkers(prev.markers, next.markers) &&
    sameTheme(prev.t, next.t)
  );
});

export default function ExerciseScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const isOnline = useIsOnline();
  const isDarkTheme = useMemo(
    () => isDarkColor(t.background) || isDarkColor(t.card),
    [t.background, t.card]
  );
  const pageBackground = isDarkTheme
    ? EXERCISE_BACKGROUND.dark
    : EXERCISE_BACKGROUND.light;
  const bubbleColors = isDarkTheme ? EXERCISE_BUBBLES.dark : EXERCISE_BUBBLES.light;
  const params = useLocalSearchParams<{
    slug?: string;
    quickLog?: string;
    tourStep?: string;
    tutorialProgramId?: string;
    programId?: string;
    selectedDate?: string | string[];
    logDate?: string | string[];
    openLog?: string | string[];
  }>();
  const slug = params?.slug;
  const quickLog = params?.quickLog === "true";
  const openLogFromCalendar = Array.isArray(params?.openLog)
    ? params.openLog[0] === "true"
    : params?.openLog === "true";
  const shouldAutoFocusLogger = quickLog || openLogFromCalendar;
  const selectedLogDate = useMemo(
    () => normalizeRouteDate(params?.logDate ?? params?.selectedDate),
    [params?.logDate, params?.selectedDate]
  );
  const incomingTourStep = params?.tourStep;
  const tutorialProgramId = params?.tutorialProgramId;
  const fallbackProgramId = params?.programId;
  const resolvedTutorialProgramId = tutorialProgramId || fallbackProgramId;

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState<string>("idle");

  const previewExercise = getExerciseRoutePreview(slug)?.exercise ?? null;
  const previewPrefs = getExercisePrefsPreview(previewExercise?.id);

  const [user, setUser] = useState<any>(null);
  const [exercise, setExercise] = useState<ExerciseRow | null>(() => previewExercise);
  const [splitName, setSplitName] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [newLog, setNewLog] = useState(() => {
    const previewLatest = quickLog ? getExerciseRoutePreview(slug)?.latestLog : null;
    if (!previewLatest) return { weight: "", reps: "", sets: "", note: "", rpe: "" };

    return {
      weight: previewLatest.weight && Number(previewLatest.weight) > 0 ? String(previewLatest.weight) : "",
      reps: String(previewLatest.reps ?? ""),
      sets: String(previewLatest.sets ?? ""),
      note: "",
      rpe: "",
    };
  });
  const [logTag, setLogTag] = useState<LogTag>(() => previewPrefs?.defaultTag ?? "working");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !getExerciseRoutePreview(slug));
  const [formError, setFormError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { restDuration, setRestDuration, restSecondsLeft, startRest } = useRestTimer(
    previewPrefs?.restDuration ?? 120
  );
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [sessionLogIds, setSessionLogIds] = useState<string[]>([]);
  const [sessionVolume, setSessionVolume] = useState(0);
  const [finishedSessionSummary, setFinishedSessionSummary] = useState<SessionSummary | null>(null);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");
  const [logSearch, setLogSearch] = useState("");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>(() => previewPrefs?.trendMetric ?? "volume");
  const [trendView, setTrendView] = useState<TrendView>(() => previewPrefs?.trendView ?? "graph");
  const [insightSheetVisible, setInsightSheetVisible] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [latestTut, setLatestTut] = useState<TutPreviewRow | null>(null);
  const [tutPreviewLoading, setTutPreviewLoading] = useState(false);
  const [weightJump, setWeightJump] = useState(() => previewPrefs?.weightJump ?? 2.5);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  const listRef = useRef<FlatList<LogRow> | null>(null);
  const loggerAnchorY = useRef(0);
  const advancedInsightsAnchorY = useRef(0);
  const bubbleOneAnim = useRef(new Animated.Value(0)).current;
  const bubbleTwoAnim = useRef(new Animated.Value(0)).current;
  const bubbleThreeAnim = useRef(new Animated.Value(0)).current;

  const scrollToLogger = useCallback(() => {
    const target = Math.max(0, loggerAnchorY.current - 16);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: target, animated: true });
    });
  }, []);

  const scrollToAdvancedInsights = useCallback(() => {
    const target = Math.max(0, advancedInsightsAnchorY.current - 16);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: target, animated: true });
    });
  }, []);

  useEffect(() => {
    if (!openLogFromCalendar) return;

    setStatusMsg(`Logging for ${formatLogDate(selectedLogDate)}.`);
    const timer = setTimeout(scrollToLogger, 220);

    return () => clearTimeout(timer);
  }, [openLogFromCalendar, selectedLogDate, scrollToLogger]);

  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(bubbleOneAnim, {
            toValue: 1,
            duration: 16000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bubbleOneAnim, {
            toValue: 0,
            duration: 16000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(bubbleTwoAnim, {
            toValue: 1,
            duration: 19000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bubbleTwoAnim, {
            toValue: 0,
            duration: 19000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(bubbleThreeAnim, {
            toValue: 1,
            duration: 22000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bubbleThreeAnim, {
            toValue: 0,
            duration: 22000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [bubbleOneAnim, bubbleThreeAnim, bubbleTwoAnim]);

  const bubbleOneTranslateX = bubbleOneAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 28],
  });
  const bubbleOneTranslateY = bubbleOneAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 36],
  });
  const bubbleOneScale = bubbleOneAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const bubbleTwoTranslateX = bubbleTwoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, -32],
  });
  const bubbleTwoTranslateY = bubbleTwoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, -22],
  });
  const bubbleTwoScale = bubbleTwoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.04, 0.96],
  });

  const bubbleThreeTranslateX = bubbleThreeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 34],
  });
  const bubbleThreeTranslateY = bubbleThreeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [26, -18],
  });
  const bubbleThreeScale = bubbleThreeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.08],
  });

  const cacheId = user?.id && slug ? cacheKey(["exercise", user.id, slug]) : null;
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

          // Cached data (from disk, or from the instant in-memory preview
          // set on tap) is enough to render — stop blocking on it here and
          // let the network fetch below refresh silently in the background.
          if (cached?.exercise) setLoading(false);

          if (!isOnline && cached) {
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
          logError("exercise.fetch", error);
          setExercise(null);
        } else {
          setExercise((data as ExerciseRow) ?? null);
        }
      } catch (err) {
        logError("exercise.fetch", err);
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
        logWarn("exercise.fetchSplit", error.message, { splitId: exercise.split_id });
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
        logWarn("exercise.fetchTutPreview", error.message);
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
      if (exercise?.id) setExercisePrefsPreview(exercise.id, prefs);
    };

    void loadPrefs();

    return () => {
      active = false;
    };
  }, [prefsKey, setRestDuration]);

  useEffect(() => {
    if (!prefsKey) return;
    const prefs: ExercisePrefs = {
      defaultTag: logTag,
      restDuration,
      trendMetric,
      trendView,
      weightJump,
    };
    void cacheSetJson(prefsKey, prefs);
    if (exercise?.id) setExercisePrefsPreview(exercise.id, prefs);
  }, [prefsKey, logTag, restDuration, trendMetric, trendView, weightJump, exercise?.id]);

  useEffect(() => {
    if (!exercise?.id || !user?.id || !isOnline) return;

    let active = true;
    const exerciseForCache = exercise;
    const splitNameForCache = splitName;

    const fetchLogs = async () => {
      // Flush any queued offline writes before reading — otherwise this fetch
      // can race a pending log.create and show a stale list.
      await flushPendingActions();
      if (!active) return;

      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("exercise_id", exerciseForCache.id)
        .eq("user_id", user.id)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        logWarn("exercise.fetchLogs", error.message, { exerciseId: exerciseForCache.id });
        return;
      }

      const nextLogs = sortLogsByTrainingDateDesc((data ?? []) as LogRow[]);
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
  }, [exercise, user?.id, isOnline, cacheId, splitName]);

  useEffect(() => {
    if (!quickLog || logs.length === 0 || editingId) return;

    const latest = logs[0];
    setNewLog({
      weight: latest.weight && Number(latest.weight) > 0 ? String(latest.weight) : "",
      reps: String(latest.reps ?? ""),
      sets: String(latest.sets ?? ""),
      note: "",
      rpe: "",
    });
    setStatusMsg("Quick log ready.");
  }, [quickLog, logs, editingId]);

  useEffect(() => {
    if (!cacheId || !exercise) return;
    void cacheSetJson(cacheId, { exercise, logs, splitName });
  }, [cacheId, exercise, logs, splitName]);

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

        acc.bestReps = Math.max(acc.bestReps, reps);
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
        bestReps: 0,
      }
    );
  }, [workingLogs]);

  const lastLog = logs[0] ?? null;
  const lastWorkingLog = workingLogs[0] ?? null;
  const bestWorkingLog = useMemo(() => {
    if (workingLogs.length === 0) return null;
    return [...workingLogs].sort((a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0))[0];
  }, [workingLogs]);

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

  const todayLogs = useMemo(() => {
    const today = getTodayDateString();
    return logs.filter((log) => getTrainingDate(log) === today);
  }, [logs]);
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
      const month = getMonthLabel(getTrainingDate(log));
      return !collapsedMonths[month] || index === 0;
    });
  }, [logs, logFilter, logSearch, collapsedMonths]);


  const plateauResult = useMemo(() => detectPlateau(workingLogs, logPrFlags), [workingLogs, logPrFlags]);

  const trendCallouts = useMemo(() => {
    const callouts = getTrendCallouts(workingLogs);
    const withPlateau = plateauResult.isPlateaued
      ? [plateauResult.message, ...callouts]
      : callouts;

    if (workingLogs.length === 0) return withPlateau;

    const dueSoonMessage = getExerciseDueSoonMessage(workingLogs);
    const isActionable =
      dueSoonMessage.startsWith("Overdue") || dueSoonMessage.startsWith("Due soon");

    return isActionable ? [...withPlateau, dueSoonMessage] : withPlateau;
  }, [workingLogs, plateauResult]);


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
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      },
      {
        id: "weight",
        label: `+${weightJump} kg`,
        icon: "trending-up-outline",
        apply: () => {
          setNewLog((prev) => ({ ...prev, weight: addWeight(prev.weight || String(baseWeight), weightJump) }));
          setStatusMsg(`Suggested next set: +${weightJump} kg.`);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      },
      {
        id: "rep",
        label: "1 rep",
        icon: "add-outline",
        apply: () => {
          setNewLog((prev) => ({ ...prev, reps: addInteger(prev.reps || String(baseReps), 1) }));
          setStatusMsg("Suggested next set: +1 rep.");
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      },
      {
        id: "set",
        label: "1 set",
        icon: "add-outline",
        apply: () => {
          setNewLog((prev) => ({ ...prev, sets: addInteger(prev.sets || String(baseSets), 1) }));
          setStatusMsg("Suggested next set: +1 set.");
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      },
    ];
  }, [lastWorkingLog, newLog.weight, newLog.reps, newLog.sets, weightJump]);

  const coachNextSetInsight = useMemo(() => {
    const lastCreatedAt = lastWorkingLog?.created_at ? new Date(lastWorkingLog.created_at).getTime() : NaN;
    const daysSinceLastWorkingLog = Number.isFinite(lastCreatedAt)
      ? Math.floor((Date.now() - lastCreatedAt) / (1000 * 60 * 60 * 24))
      : null;

    return getCoachNextSetInsight({
      currentWeight: parseFloat(newLog.weight) || 0,
      currentReps: parseInt(newLog.reps, 10) || 0,
      currentSets: parseInt(newLog.sets, 10) || 0,
      lastWeight: Number(lastWorkingLog?.weight ?? 0),
      lastReps: Number(lastWorkingLog?.reps ?? 0),
      lastSets: Number(lastWorkingLog?.sets ?? 0),
      bestWeight: Number(bestWorkingLog?.weight ?? 0),
      bestReps: Number(bestWorkingLog?.reps ?? 0),
      bestSets: Number(bestWorkingLog?.sets ?? 0),
      lastVolume: Number(lastWorkingLog?.volume ?? 0),
      bestVolume: Number(bestWorkingLog?.volume ?? 0),
      currentVolume,
      restSecondsLeft,
      recentWorkingLogCount: workingLogs.length,
      daysSinceLastWorkingLog,
      lastRpe: lastWorkingLog?.rpe ?? null,
    });
  }, [bestWorkingLog, currentVolume, lastWorkingLog, newLog.reps, newLog.sets, newLog.weight, restSecondsLeft, workingLogs.length]);

  const resetForm = useCallback(() => {
    setNewLog({ weight: "", reps: "", sets: "", note: "", rpe: "" });
    setLogTag("working");
    setEditingId(null);
    setFormError("");
    setStatusMsg("");
  }, []);

  const duplicateLog = useCallback((log: LogRow) => {
    setNewLog({
      weight: log.weight && Number(log.weight) > 0 ? String(log.weight) : "",
      reps: String(log.reps),
      sets: String(log.sets),
      note: log.day ?? "",
      rpe: log.rpe ? String(log.rpe) : "",
    });
    setLogTag(getLogTag(log));
    setEditingId(null);
    setStatusMsg("Copied log into quick logger.");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleChange = useLatestCallback((field: "weight" | "reps" | "sets" | "note" | "rpe", value: string) => {
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
    if (field === "rpe") {
      setNewLog((prev) => ({ ...prev, rpe: value }));
      return;
    }
    setNewLog((prev) => ({ ...prev, note: value }));
  });

  const handleTagChange = useCallback((tag: LogTag) => {
    setLogTag(tag);
    setStatusMsg(`${getLogTagLabel(tag)} selected.`);
    setFormError("");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleRestDurationChange = useCallback((seconds: number) => {
    setRestDuration(seconds);
    setStatusMsg(`Rest timer set to ${formatDurationLabel(seconds)}.`);
  }, [setRestDuration]);

  const handleWeightJumpChange = useCallback((step: number) => {
    setWeightJump(step);
    setStatusMsg(`Default jump set to ${step} kg.`);
  }, []);

  const handleEdit = useCallback((log: LogRow) => {
    setEditingId(log.id);
    setNewLog({
      weight: log.weight && Number(log.weight) > 0 ? String(log.weight) : "",
      reps: String(log.reps),
      sets: String(log.sets),
      note: log.day ?? "",
      rpe: log.rpe ? String(log.rpe) : "",
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
    if (logTag !== "warmup") startRest();

    setNewLog((prev) => ({
      weight: keepInputs ? prev.weight : "",
      reps: keepInputs ? prev.reps : "",
      sets: keepInputs ? prev.sets : "",
      note: "",
      rpe: "",
    }));

    setEditingId(null);
    setFormError("");
    setStatusMsg(message);
    Keyboard.dismiss();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSave = useLatestCallback(async () => {
    if (isSaving) return;
    if (!exercise || !user?.id) return;

    const validationError = getValidationError(newLog.weight, newLog.reps, newLog.sets);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (isFutureDateString(selectedLogDate)) {
      setFormError("You can only log workouts for today or past dates.");
      Alert.alert(
        "Future date blocked",
        "You can only log workouts for today or past dates."
      );
      return;
    }

    setIsSaving(true);
    try {
      const w = parseFloat(newLog.weight) || 0;
      const r = parseInt(newLog.reps, 10);
      const s = parseInt(newLog.sets, 10);
      const volume = Math.max(1, w) * r * s;
      const createdAt = new Date().toISOString();
      const note = newLog.note.trim() || null;
      const rpe = newLog.rpe ? parseFloat(newLog.rpe) : null;

      const achievement = getLogAchievement(
        { weight: w, reps: r, sets: s, volume, type: logTag },
        logs.filter((log) => !log.pending)
      );

      const sessionId = sessionStartedAt ?? createdAt;

      if (!isOnline) {
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
          log_date: selectedLogDate,
          day: note,
          type: logTag,
          rpe,
          pending: true,
        } as LogRow & { log_date: string };

        const payload: CachedLog = {
          id: localTempId,
          user_id: user.id,
          exercise_id: exercise.id,
          weight: w,
          reps: r,
          sets: s,
          volume,
          day: note,
          type: logTag,
          rpe,
          created_at: createdAt,
          log_date: selectedLogDate,
        };

        await enqueueAction({
          id: localTempId,
          type: "log.create",
          createdAt,
          retries: 0,
          status: "pending",
          payload,
        });

        setLogs((prev) => sortLogsByTrainingDateDesc([pendingLog, ...prev]));
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
            rpe,
            log_date: selectedLogDate,
          },
        ])
        .select()
        .maybeSingle();

      if (error) {
        logError("exercise.saveLog", error);
        setFormError("Could not save log.");
        return;
      }

      const nextLog = data as LogRow;
      setLogs((prev) => sortLogsByTrainingDateDesc([nextLog, ...prev]));
      afterSuccessfulSet(volume, sessionId, nextLog.id, achievement);

      if (await isOnboardingActive()) {
        await setOnboardingStep("open_advanced");
        setTourStep("open_advanced");
        setStatusMsg("Great. Next, open Advanced Insights.");
        scrollToAdvancedInsights();
      }
    } finally {
      setIsSaving(false);
    }
  });

  const handleUpdate = useLatestCallback(async () => {
    if (isSaving) return;
    if (!exercise || !editingId || !user?.id) return;

    const validationError = getValidationError(newLog.weight, newLog.reps, newLog.sets);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const w = parseFloat(newLog.weight) || 0;
      const r = parseInt(newLog.reps, 10);
      const s = parseInt(newLog.sets, 10);
      const volume = Math.max(1, w) * r * s;
      const note = newLog.note.trim() || null;
      const rpe = newLog.rpe ? parseFloat(newLog.rpe) : null;

      const { data, error } = await supabase
        .from("logs")
        .update({ weight: w, reps: r, sets: s, volume, day: note, type: logTag, rpe })
        .eq("id", editingId)
        .eq("user_id", user.id)
        .select()
        .maybeSingle();

      if (error) {
        logError("exercise.updateLog", error);
        setFormError("Could not update log.");
        return;
      }

      const updated = data as LogRow;
      setLogs((prev) => sortLogsByTrainingDateDesc(prev.map((log) => (log.id === editingId ? updated : log))));
      setEditingId(null);
      setFormError("");
      setStatusMsg("Log updated.");
      Keyboard.dismiss();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsSaving(false);
    }
  });

  const handleDelete = useCallback((id: string) => {
    Alert.alert("Delete log?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (id.startsWith("pending-")) {
            await removePendingAction(id);
            setLogs((prev) => prev.filter((log) => log.id !== id));
            setStatusMsg("Pending log removed.");
            return;
          }

          const { error } = await supabase.from("logs").delete().eq("id", id).eq("user_id", user.id);

          if (error) {
            logError("exercise.deleteLog", error);
            setFormError("Could not delete log.");
            return;
          }

          setLogs((prev) => prev.filter((log) => log.id !== id));
          setStatusMsg("Log deleted.");
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }, [user?.id]);

  const headerBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/");
  }, [router]);

  const keyExtractor = useCallback((item: LogRow) => item.id, []);

  const toggleMonthCollapsed = useCallback((month: string) => {
    setCollapsedMonths((prev) => ({ ...prev, [month]: !prev[month] }));
  }, []);

  const toggleNoteExpanded = useCallback((id: string) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);


  const renderItem = useCallback(
    ({ item, index }: { item: LogRow; index: number }) => {
      const currentMonth = getMonthLabel(getTrainingDate(item));
      const prevMonth = index > 0 ? getMonthLabel(getTrainingDate(filteredLogs[index - 1])) : null;
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
        <LogListCard
          item={item}
          showMonthHeader={showMonthHeader}
          currentMonth={currentMonth}
          monthCollapsed={monthIsCollapsed}
          noteExpanded={noteExpanded}
          markers={markers}
          leftAccentColor={leftAccentColor}
          t={t}
          onToggleMonth={toggleMonthCollapsed}
          onDuplicate={duplicateLog}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleNote={toggleNoteExpanded}
        />
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
      toggleMonthCollapsed,
      toggleNoteExpanded,
    ]
  );

  const headerStatusLabel = restSecondsLeft > 0
    ? `Rest ${formatDurationLabel(restSecondsLeft)}`
    : `${logs.length} log${logs.length === 1 ? "" : "s"}`;

  const headerStatusIcon: keyof typeof Ionicons.glyphMap = !isOnline
    ? "cloud-offline-outline"
    : restSecondsLeft > 0
      ? "timer-outline"
      : "bar-chart-outline";


  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: pageBackground }]}>
        <ActivityIndicator size="large" color={t.text} />
        <Text style={[styles.loadingText, { color: t.mutedText }]}>Loading exercise…</Text>
      </SafeAreaView>
    );
  }

  if (!exercise) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: pageBackground }]}>
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
    <SafeAreaView style={[styles.container, { backgroundColor: pageBackground }]}>
      <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} />

      <ExerciseBackground
        colors={bubbleColors}
        bubbleOneStyle={{
          transform: [
            { translateX: bubbleOneTranslateX },
            { translateY: bubbleOneTranslateY },
            { scale: bubbleOneScale },
          ],
        }}
        bubbleTwoStyle={{
          transform: [
            { translateX: bubbleTwoTranslateX },
            { translateY: bubbleTwoTranslateY },
            { scale: bubbleTwoScale },
          ],
        }}
        bubbleThreeStyle={{
          transform: [
            { translateX: bubbleThreeTranslateX },
            { translateY: bubbleThreeTranslateY },
            { scale: bubbleThreeScale },
          ],
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={10}
      >
        <ExerciseHeader
          t={t}
          exerciseName={exercise.name}
          splitName={splitName}
          restSecondsLeft={restSecondsLeft}
          statusIcon={headerStatusIcon}
          statusLabel={headerStatusLabel}
          onBack={headerBack}
        />

        <FlatList
          ref={listRef}
          data={filteredLogs}
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={Platform.OS === "android"}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          windowSize={7}
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
              <TrainingSummaryDeck
                t={t}
                prItems={prBoardItems}
                onPressRecord={scrollToLogCard}
                sessionsLabel={String(dashboardMetrics.totalSessions)}
                heaviestLabel={dashboardMetrics.heaviestWeight > 0 ? formatWeightLabel(dashboardMetrics.heaviestWeight) : "Bodyweight"}
                latestLabel={lastLog ? `${formatCompactWeight(lastLog.weight)} · ${lastLog.reps}×${lastLog.sets}` : "None"}
                totalVolumeLabel={String(dashboardMetrics.totalVolume)}
                totalRepsLabel={String(dashboardMetrics.totalReps)}
                bestEstimated1RMLabel={dashboardMetrics.bestEstimated1RM > 0 ? `${dashboardMetrics.bestEstimated1RM.toFixed(1)} kg` : "—"}
                bestVolumeLabel={dashboardMetrics.bestVolumeLog ? String(Number(dashboardMetrics.bestVolumeLog.volume ?? 0)) : "—"}
                repPRLabel={dashboardMetrics.bestReps > 0 ? `${dashboardMetrics.bestReps}` : "—"}
                workingSetsLabel={String(dashboardMetrics.totalSets)}
                goalSnapshot={goalSnapshot}
                compareInsight={currentComparableInsight}
                trendCallouts={trendCallouts}
              />

              <ProgressGraphCard
                t={t}
                logs={workingLogs}
                metric={trendMetric}
                onMetricChange={setTrendMetric}
                view={trendView}
                onViewChange={setTrendView}
                onOpenFullInsights={() => setInsightSheetVisible(true)}
              />

              {insightSheetVisible ? (
                <ExerciseInsightSheet
                  visible={insightSheetVisible}
                  onClose={() => setInsightSheetVisible(false)}
                  logs={logs}
                  exerciseName={exercise?.name ?? "Exercise"}
                  slug={slug}
                  t={t}
                />
              ) : null}

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
              >
                <QuickLoggerCard
                  t={t}
                  editingId={editingId}
                  logTag={logTag}
                  onTagChange={handleTagChange}
                  lastHint={lastLog ? `Last: ${formatLogLine(lastLog)}` : "No logs yet. Add your first set below."}
                  value={newLog}
                  onChange={handleChange}
                  currentVolume={currentVolume}
                  restDuration={restDuration}
                  onRestDurationChange={handleRestDurationChange}
                  weightJump={weightJump}
                  onWeightJumpChange={handleWeightJumpChange}
                  coachInsight={coachNextSetInsight}
                  suggestionActions={suggestionActions}
                  lastLabel={lastWorkingLog ? formatComparableLine(lastWorkingLog) : "—"}
                  bestLabel={bestWorkingLog ? formatComparableLine(bestWorkingLog) : "—"}
                  formError={formError}
                  statusMsg={statusMsg}
                  onSave={editingId ? handleUpdate : handleSave}
                  onCancelEdit={resetForm}
                  saving={isSaving}
                  autoFocusWeight={shouldAutoFocusLogger}
                  onFocusWeight={scrollToLogger}
                />
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
                  returnKeyType="search"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  style={[
                    styles.searchInput,
                    { backgroundColor: t.cardAlt, borderColor: t.border, color: t.text },
                  ]}
                />
              </View>

              {filteredLogs.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: t.card, borderColor: t.border }]}>
                  <View style={[styles.emptyIconWrap, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                    <Ionicons name="barbell-outline" size={22} color={t.text} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: t.text }]}>
                    {logs.length === 0 ? "No logs yet" : "No matching logs"}
                  </Text>
                  <Text style={[styles.emptyText, { color: t.mutedText }]}>
                    {logs.length === 0
                      ? "Start with a simple working set. You can edit it anytime."
                      : "Try a different filter or clear your search."}
                  </Text>

                  {logs.length === 0 ? (
                    <View style={styles.emptyActionRow}>
                      <TouchableOpacity
                        activeOpacity={0.86}
                        onPress={() => {
                          setNewLog({ weight: "", reps: "8", sets: "3", note: "", rpe: "" });
                          setLogTag("working");
                          setStatusMsg("Bodyweight starter set ready.");
                          scrollToLogger();
                        }}
                        style={[styles.emptyActionButton, { backgroundColor: t.cardAlt, borderColor: t.border }]}
                      >
                        <Text style={[styles.emptyActionText, { color: t.text }]}>Use Bodyweight</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.86}
                        onPress={() => {
                          setNewLog({ weight: "10", reps: "5", sets: "3", note: "", rpe: "" });
                          setLogTag("working");
                          setStatusMsg("Weighted starter set ready.");
                          scrollToLogger();
                        }}
                        style={[styles.emptyActionButton, { backgroundColor: t.link, borderColor: t.link }]}
                      >
                        <Text style={[styles.emptyActionText, { color: "#fff" }]}>Start Weighted</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </>
          }
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  listContent: {
    paddingBottom: 104,
  },
  backgroundBubbleLarge: {
    position: "absolute",
    width: 310,
    height: 310,
    borderRadius: 155,
    top: -96,
    left: -122,
  },
  backgroundBubbleMedium: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    top: 230,
    right: -140,
  },
  backgroundBubbleSmall: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: 120,
    left: -120,
  },
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
  headerStatusChip: {
    minWidth: 74,
    maxWidth: 96,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 9,
  },
  headerStatusText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
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
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  formEditing: {
    shadowOpacity: 0.14,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  formTitle: { fontWeight: "900", fontSize: 19, letterSpacing: -0.2 },
  formSubtitle: { marginTop: 3, fontSize: 12, fontWeight: "600" },
  editingPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  editingPillText: { fontSize: 12, fontWeight: "800" },
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
    width: "100%",
  },
  cancelBtn: {
    flex: 0.42,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontWeight: "700",
    fontSize: 14,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  saveText: { color: "white", fontWeight: "900", fontSize: 15 },

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
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: "center",
    marginBottom: 10,
  },
  emptyIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
  emptyActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    width: "100%",
  },
  emptyActionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: "800",
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
    width: 40,
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
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sideActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
});


