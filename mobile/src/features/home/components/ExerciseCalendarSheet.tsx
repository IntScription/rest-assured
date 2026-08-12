import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { Calendar } from "react-native-calendars";
import type { DateData } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { supabase } from "@/src/lib/supabase";

type ExerciseLite = {
  id: string;
  name: string;
  slug: string | null;
  split_id?: string | null;
};

type LogRow = {
  id: string;
  exercise_id: string;
  weight: number | null;
  reps: number;
  sets: number;
  volume?: number | null;
  created_at: string | null;
  log_date?: string | null;
  type: string | null;
  day: string | null;
};

type Props = {
  visible: boolean;
  item: ExerciseLite;
  uid: string;
  t: any;
  accent?: string;
  onClose: () => void;
  onLogForDate?: (date: string) => void;
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

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function monthStart(dateString: string) {
  const [year, month] = dateString.split("-").map(Number);
  return `${year}-${`${month}`.padStart(2, "0")}-01`;
}

function isFutureDate(dateString: string) {
  return dateString.localeCompare(todayString()) > 0;
}

function getLogDate(log: LogRow) {
  if (log.log_date) return log.log_date;
  if (log.created_at) return log.created_at.slice(0, 10);
  return todayString();
}

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calcVolume(log?: Partial<LogRow> | null) {
  if (!log) return 0;
  return Math.max(1, n(log.weight)) * n(log.reps) * n(log.sets);
}

function formatCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }

  return `${Math.round(value)}`;
}

function formatDisplayDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function getPalette({ t, accent }: { t: any; accent: string }) {
  const isDark = isDarkTheme(t);

  return {
    isDark,
    overlay: isDark ? "rgba(0,0,0,0.38)" : "rgba(15,23,42,0.16)",
    card: isDark ? "rgba(8,13,24,0.94)" : "rgba(255,255,255,0.94)",
    cardAlt: isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.045)",
    border: isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)",
    strongBorder: isDark ? `${accent}66` : `${accent}38`,
    glow: isDark ? `${accent}28` : `${accent}18`,
    mutedGlow: isDark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.72)",
    text: t.text,
    muted: t.mutedText,
    accent,
  };
}

export function ExerciseCalendarSheet({
  visible,
  item,
  uid,
  t,
  accent,
  onClose,
  onLogForDate,
}: Props) {
  const resolvedAccent = accent || t.link || "#3B82F6";
  const palette = useMemo(
    () => getPalette({ t, accent: resolvedAccent }),
    [resolvedAccent, t]
  );

  const today = todayString();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(monthStart(today));

  const selectedDateIsFuture = isFutureDate(selectedDate);

  useEffect(() => {
    if (!visible) return;

    const nextToday = todayString();
    setSelectedDate(nextToday);
    setVisibleMonth(monthStart(nextToday));
  }, [visible]);

  useEffect(() => {
    if (!visible || !uid || !item.id) return;

    let mounted = true;

    const load = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("logs")
        .select(
          "id, exercise_id, weight, reps, sets, volume, created_at, log_date, type, day"
        )
        .eq("user_id", uid)
        .eq("exercise_id", item.id)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(240);

      if (!mounted) return;

      if (!error && data) {
        setLogs(data as LogRow[]);
      }

      setLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [item.id, uid, visible]);

  const stats = useMemo(() => {
    const uniqueDates = new Set(logs.map(getLogDate));

    const totalVolume = logs.reduce((sum, log) => {
      return sum + Number(log.volume ?? calcVolume(log));
    }, 0);

    const bestLog = logs.reduce<LogRow | null>((best, log) => {
      if (!best) return log;

      const bestVolume = Number(best.volume ?? calcVolume(best));
      const logVolume = Number(log.volume ?? calcVolume(log));

      return logVolume > bestVolume ? log : best;
    }, null);

    return {
      sessions: uniqueDates.size,
      sets: logs.reduce((sum, log) => sum + n(log.sets), 0),
      totalVolume,
      bestLog,
    };
  }, [logs]);

  const selectedLogs = useMemo(() => {
    return logs.filter((log) => getLogDate(log) === selectedDate);
  }, [logs, selectedDate]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    logs.forEach((log) => {
      const date = getLogDate(log);

      marks[date] = {
        ...(marks[date] || {}),
        marked: true,
        dotColor: resolvedAccent,
      };
    });

    marks[today] = {
      ...(marks[today] || {}),
      marked: true,
      dotColor: marks[today]?.dotColor ?? resolvedAccent,
    };

    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: selectedDateIsFuture ? palette.muted : resolvedAccent,
      selectedTextColor: "#fff",
      dotColor: marks[selectedDate]?.dotColor ?? "#fff",
    };

    return marks;
  }, [logs, palette.muted, resolvedAccent, selectedDate, selectedDateIsFuture, today]);

  function handleDayPress(day: DateData) {
    if (isFutureDate(day.dateString)) return;

    setSelectedDate(day.dateString);
    setVisibleMonth(monthStart(day.dateString));
    void Haptics.selectionAsync();
  }

  function handleMonthChange(day: DateData) {
    setVisibleMonth(monthStart(day.dateString));
  }

  function jumpToToday() {
    const nextToday = todayString();
    setSelectedDate(nextToday);
    setVisibleMonth(monthStart(nextToday));
    void Haptics.selectionAsync();
  }

  function handleLogForSelectedDate() {
    if (selectedDateIsFuture || !onLogForDate) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLogForDate(selectedDate);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={viewStyles.root}>
        <BlurView
          intensity={palette.isDark ? 42 : 34}
          tint={palette.isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />

        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.overlay }]}
          onPress={onClose}
        />

        <View style={viewStyles.centerWrap} pointerEvents="box-none">
          <View
            style={[
              viewStyles.sheet,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
                shadowColor: palette.isDark ? "#000" : "#64748B",
              },
            ]}
          >
            <View pointerEvents="none" style={viewStyles.decorLayer}>
              <View
                style={[
                  viewStyles.glowOrb,
                  viewStyles.glowTop,
                  { backgroundColor: palette.glow },
                ]}
              />

              <View
                style={[
                  viewStyles.glowOrb,
                  viewStyles.glowBottom,
                  {
                    backgroundColor: palette.isDark
                      ? "rgba(139,92,246,0.14)"
                      : "rgba(139,92,246,0.10)",
                  },
                ]}
              />
            </View>

            <View style={viewStyles.header}>
              <View
                style={[
                  viewStyles.iconShell,
                  {
                    backgroundColor: palette.glow,
                    borderColor: palette.strongBorder,
                  },
                ]}
              >
                <Ionicons name="calendar-outline" size={24} color={resolvedAccent} />
              </View>

              <View style={viewStyles.headerText}>
                <Text style={[textStyles.kicker, { color: palette.muted }]}>Exercise calendar</Text>

                <Text style={[textStyles.title, { color: palette.text }]} numberOfLines={1}>
                  {item.name}
                </Text>

                <Text style={[textStyles.subtitle, { color: palette.muted }]}>
                  Pick any past date to log missed work.
                </Text>
              </View>

              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.85}
                style={[
                  viewStyles.closeButton,
                  {
                    backgroundColor: palette.cardAlt,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Ionicons name="close" size={19} color={palette.text} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={viewStyles.loadingWrap}>
                <ActivityIndicator color={resolvedAccent} />

                <Text style={[textStyles.loadingText, { color: palette.muted }]}>Loading exercise history...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={viewStyles.scrollContent}>
                <View style={viewStyles.statsGrid}>
                  <StatCard label="Sessions" value={String(stats.sessions)} icon="calendar-number-outline" palette={palette} />

                  <StatCard label="Sets" value={String(stats.sets)} icon="layers-outline" palette={palette} />

                  <StatCard label="Volume" value={formatCompact(stats.totalVolume)} icon="barbell-outline" palette={palette} />

                  <StatCard
                    label="Best"
                    value={
                      stats.bestLog
                        ? formatCompact(Number(stats.bestLog.volume ?? calcVolume(stats.bestLog)))
                        : "-"
                    }
                    icon="trophy-outline"
                    palette={palette}
                  />
                </View>

                <View
                  style={[
                    viewStyles.calendarShell,
                    {
                      backgroundColor: palette.mutedGlow,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Calendar
                    current={visibleMonth}
                    maxDate={today}
                    markedDates={markedDates}
                    onDayPress={handleDayPress}
                    onMonthChange={handleMonthChange}
                    enableSwipeMonths
                    firstDay={1}
                    theme={{
                      calendarBackground: "transparent",
                      dayTextColor: palette.text,
                      monthTextColor: palette.text,
                      textSectionTitleColor: palette.muted,
                      selectedDayBackgroundColor: resolvedAccent,
                      selectedDayTextColor: "#fff",
                      todayTextColor: resolvedAccent,
                      arrowColor: resolvedAccent,
                      textDisabledColor: palette.isDark
                        ? "rgba(255,255,255,0.20)"
                        : "rgba(15,23,42,0.22)",
                    }}
                  />
                </View>

                <View
                  style={[
                    viewStyles.selectedCard,
                    {
                      backgroundColor: palette.cardAlt,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <View style={viewStyles.selectedTopRow}>
                    <View style={viewStyles.selectedTextWrap}>
                      <Text style={[textStyles.selectedKicker, { color: palette.muted }]}>Selected day</Text>

                      <Text style={[textStyles.selectedDate, { color: palette.text }]}>
                        {formatDisplayDate(selectedDate)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={jumpToToday}
                      activeOpacity={0.86}
                      style={[
                        viewStyles.todayButton,
                        {
                          backgroundColor: selectedDate === today ? palette.glow : palette.card,
                          borderColor: selectedDate === today ? palette.strongBorder : palette.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name="locate-outline"
                        size={14}
                        color={selectedDate === today ? resolvedAccent : palette.muted}
                      />
                      <Text
                        style={[
                          textStyles.todayButtonText,
                          { color: selectedDate === today ? resolvedAccent : palette.text },
                        ]}
                      >
                        Today
                      </Text>
                    </TouchableOpacity>

                    <View
                      style={[
                        viewStyles.countPill,
                        {
                          backgroundColor: selectedDateIsFuture ? "rgba(148,163,184,0.12)" : palette.glow,
                          borderColor: selectedDateIsFuture ? palette.border : palette.strongBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          textStyles.countPillText,
                          {
                            color: selectedDateIsFuture ? palette.muted : resolvedAccent,
                          },
                        ]}
                      >
                        {selectedDateIsFuture ? "Future" : `${selectedLogs.length} logs`}
                      </Text>
                    </View>
                  </View>

                  {selectedLogs.length === 0 ? (
                    <View style={viewStyles.emptyState}>
                      <Ionicons
                        name={selectedDateIsFuture ? "lock-closed-outline" : "calendar-clear-outline"}
                        size={22}
                        color={palette.muted}
                      />

                      <Text style={[textStyles.emptyTitle, { color: palette.text }]}> 
                        {selectedDateIsFuture ? "Future date" : `No logs on ${formatShortDate(selectedDate)}`}
                      </Text>

                      <Text style={[textStyles.emptyText, { color: palette.muted }]}> 
                        {selectedDateIsFuture
                          ? "You can view future dates, but you cannot log workouts ahead of time."
                          : "Use the button below to log this exercise for the selected date."}
                      </Text>
                    </View>
                  ) : (
                    <View style={viewStyles.logStack}>
                      {selectedLogs.map((log) => {
                        const volume = Number(log.volume ?? calcVolume(log));

                        return (
                          <View
                            key={log.id}
                            style={[
                              viewStyles.logRow,
                              {
                                backgroundColor: palette.card,
                                borderColor: palette.border,
                              },
                            ]}
                          >
                            <View>
                              <Text style={[textStyles.logMain, { color: palette.text }]}> 
                                {n(log.weight)}kg × {log.reps} × {log.sets}
                              </Text>

                              <Text style={[textStyles.logSub, { color: palette.muted }]}>Volume {formatCompact(volume)}</Text>
                            </View>

                            <Ionicons name="chevron-forward" size={16} color={palette.muted} />
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <TouchableOpacity
                    disabled={selectedDateIsFuture || !onLogForDate}
                    onPress={handleLogForSelectedDate}
                    activeOpacity={0.86}
                    style={[
                      viewStyles.logDateButton,
                      {
                        backgroundColor: selectedDateIsFuture ? "rgba(148,163,184,0.12)" : resolvedAccent,
                        borderColor: selectedDateIsFuture ? palette.border : resolvedAccent,
                        opacity: selectedDateIsFuture ? 0.72 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={selectedDateIsFuture ? "lock-closed-outline" : "add-circle-outline"}
                      size={17}
                      color={selectedDateIsFuture ? palette.muted : "#FFFFFF"}
                    />

                    <Text
                      style={[
                        textStyles.logDateButtonText,
                        {
                          color: selectedDateIsFuture ? palette.muted : "#FFFFFF",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedDateIsFuture ? "Future dates cannot be logged" : "Log for this date"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StatCard({
  label,
  value,
  icon,
  palette,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  palette: ReturnType<typeof getPalette>;
}) {
  return (
    <View
      style={[
        viewStyles.statCard,
        {
          backgroundColor: palette.cardAlt,
          borderColor: palette.border,
        },
      ]}
    >
      <View
        style={[
          viewStyles.statIcon,
          {
            backgroundColor: palette.glow,
            borderColor: palette.strongBorder,
          },
        ]}
      >
        <Ionicons name={icon} size={15} color={palette.accent} />
      </View>

      <Text style={[textStyles.statValue, { color: palette.text }]} numberOfLines={1}>
        {value}
      </Text>

      <Text style={[textStyles.statLabel, { color: palette.muted }]}>{label}</Text>
    </View>
  );
}

const viewStyles = StyleSheet.create<Record<string, ViewStyle>>({
  root: { flex: 1 },
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 34,
  },
  sheet: {
    maxHeight: "92%",
    borderWidth: 1,
    borderRadius: 30,
    padding: 16,
    overflow: "hidden",
    shadowOpacity: 0.18,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8,
  },
  decorLayer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  glowOrb: { position: "absolute", borderRadius: 999 },
  glowTop: { width: 210, height: 210, top: -118, right: -86 },
  glowBottom: { width: 190, height: 190, bottom: -120, left: -90 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  iconShell: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, minWidth: 0 },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingWrap: {
    minHeight: 360,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: { paddingBottom: 4 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 98,
    borderWidth: 1,
    borderRadius: 20,
    padding: 13,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  calendarShell: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 12,
  },
  selectedCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
  },
  selectedTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  selectedTextWrap: { flex: 1, minWidth: 0 },
  todayButton: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  countPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  emptyState: { alignItems: "center", paddingVertical: 20 },
  logStack: { gap: 8 },
  logRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logDateButton: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});

const textStyles = StyleSheet.create<Record<string, TextStyle>>({
  kicker: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 3,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
  },
  statValue: {
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  selectedKicker: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  selectedDate: {
    marginTop: 3,
    fontSize: 17,
    fontWeight: "900",
  },
  todayButtonText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
  },
  countPillText: { fontSize: 11.5, fontWeight: "900" },
  emptyTitle: { marginTop: 8, fontSize: 15, fontWeight: "900" },
  emptyText: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
  },
  logMain: { fontSize: 15, fontWeight: "900" },
  logSub: { marginTop: 2, fontSize: 12, fontWeight: "700" },
  logDateButtonText: {
    fontSize: 13.5,
    fontWeight: "900",
    letterSpacing: 0.1,
  },
});
