import { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Calendar } from "react-native-calendars";
import type { DateData } from "react-native-calendars";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import type { Program, Split, ThemeType } from "../../types";
import { formatDisplayDate, getTodayDateString } from "../../lib/calendarDates";
import { getSplitForDate } from "../../lib/splitSchedule";

type Props = {
  visible: boolean;
  t: ThemeType;
  selectedDate: string;
  activeProgram: Program | null;
  splits: Split[];
  completedDates?: string[];
  loggedDates?: string[];
  onClose: () => void;
  onSelectDate: (date: string) => void;
};

const SPLIT_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
];

const REST_COLOR = "#38BDF8";
const COMPLETED_COLOR = "#16A34A";

function isDarkTheme(t: ThemeType) {
  const value = String(t?.background ?? "").replace("#", "");
  if (value.length !== 6) return false;

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  return luminance < 0.5;
}

function addDays(dateString: string, amount: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);

  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function monthLabel(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function getAnchorDate({
  activeProgram,
  today,
}: {
  activeProgram: Program | null;
  today: string;
}) {
  return (
    activeProgram?.schedule_anchor_date ||
    activeProgram?.created_at?.slice(0, 10) ||
    today
  );
}

function hexWithAlpha(hex: string, alpha: string) {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  return `${hex}${alpha}`;
}

function getSplitColor({
  date,
  splitId,
  splitName,
  splits,
}: {
  date: string;
  splitId?: string | null;
  splitName?: string | null;
  splits: Split[];
}) {
  if (!splits.length) return "#94A3B8";

  const foundIndex = splits.findIndex((split: any) => {
    if (splitId && split.id === splitId) return true;
    if (splitName && split.name === splitName) return true;
    return false;
  });

  if (foundIndex >= 0) {
    return SPLIT_COLORS[foundIndex % SPLIT_COLORS.length];
  }

  let hash = 0;
  for (let index = 0; index < date.length; index++) {
    hash += date.charCodeAt(index);
  }

  return SPLIT_COLORS[hash % SPLIT_COLORS.length];
}

export function WorkoutCalendarModal({
  visible,
  t,
  selectedDate,
  activeProgram,
  splits,
  completedDates = [],
  loggedDates = [],
  onClose,
  onSelectDate,
}: Props) {
  const today = getTodayDateString();
  const isDark = isDarkTheme(t);
  const anchorDate = getAnchorDate({ activeProgram, today });

  const completedSet = useMemo(() => new Set(completedDates), [completedDates]);
  const loggedSet = useMemo(() => new Set(loggedDates), [loggedDates]);

  const selectedPlan = useMemo(() => {
    return getSplitForDate({
      date: selectedDate,
      anchorDate,
      splits,
    });
  }, [anchorDate, selectedDate, splits]);

  const selectedPlanColor = useMemo(() => {
    if (selectedPlan.isRestDay) return REST_COLOR;

    return getSplitColor({
      date: selectedDate,
      splitId: (selectedPlan as any).splitId,
      splitName: selectedPlan.splitName,
      splits,
    });
  }, [selectedDate, selectedPlan, splits]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    for (let offset = -365; offset <= 365; offset++) {
      const date = addDays(today, offset);

      const plan = getSplitForDate({
        date,
        anchorDate,
        splits,
      });

      const isCompleted = completedSet.has(date);
      const isLogged = loggedSet.has(date);

      const baseColor = plan.isRestDay
        ? REST_COLOR
        : getSplitColor({
          date,
          splitId: (plan as any).splitId,
          splitName: plan.splitName,
          splits,
        });

      marks[date] = {
        marked: true,
        dotColor: isCompleted
          ? baseColor
          : isLogged
            ? t.link
            : hexWithAlpha(baseColor, isDark ? "88" : "55"),
      };
    }

    marks[today] = {
      ...(marks[today] || {}),
      marked: true,
      dotColor: marks[today]?.dotColor ?? t.link,
      customStyles: {
        text: {
          fontWeight: "900",
        },
      },
    };

    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: selectedPlanColor,
      selectedTextColor: "#FFFFFF",
      dotColor: "#FFFFFF",
    };

    return marks;
  }, [
    anchorDate,
    completedSet,
    isDark,
    loggedSet,
    selectedDate,
    selectedPlanColor,
    splits,
    t.link,
    today,
  ]);

  const legendItems = useMemo(() => {
    const splitItems = splits
      .slice(0, SPLIT_COLORS.length)
      .map((split: any, index) => ({
        id: `split-${split.id ?? index}`,
        label: split.name ?? `Split ${index + 1}`,
        color: SPLIT_COLORS[index % SPLIT_COLORS.length],
      }));

    const hasRestSplit = splitItems.some(
      (item) => item.label.trim().toLowerCase() === "rest"
    );

    return [
      ...splitItems,
      ...(hasRestSplit
        ? []
        : [{ id: "rest-day", label: "Rest", color: REST_COLOR }]),
      {
        id: "completed-solid",
        label: "Completed = solid",
        color: t.success ?? COMPLETED_COLOR,
      },
    ];
  }, [splits, t.success]);

  function selectDate(date: string) {
    void Haptics.selectionAsync();
    onSelectDate(date);
    onClose();
  }

  function jumpToToday() {
    void Haptics.selectionAsync();
    onSelectDate(today);
    onClose();
  }

  function handleDayPress(day: DateData) {
    selectDate(day.dateString);
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
          intensity={isDark ? 44 : 36}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />

        <Pressable
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark
                ? "rgba(0,0,0,0.42)"
                : "rgba(15,23,42,0.16)",
            },
          ]}
          onPress={onClose}
        />

        <View style={viewStyles.centerWrap} pointerEvents="box-none">
          <View
            style={[
              viewStyles.sheet,
              {
                backgroundColor: t.card,
                borderColor: t.border,
                shadowColor: isDark ? "#000000" : "#64748B",
              },
            ]}
          >
            <View pointerEvents="none" style={viewStyles.decorLayer}>
              <View
                style={[
                  viewStyles.glowOrb,
                  viewStyles.glowTop,
                  { backgroundColor: `${selectedPlanColor}24` },
                ]}
              />

              <View
                style={[
                  viewStyles.glowOrb,
                  viewStyles.glowBottom,
                  {
                    backgroundColor: isDark
                      ? "rgba(16,185,129,0.13)"
                      : "rgba(16,185,129,0.10)",
                  },
                ]}
              />
            </View>

            <View style={viewStyles.header}>
              <View
                style={[
                  viewStyles.iconShell,
                  {
                    backgroundColor: `${selectedPlanColor}18`,
                    borderColor: `${selectedPlanColor}38`,
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={23}
                  color={selectedPlanColor}
                />
              </View>

              <View style={viewStyles.headerText}>
                <Text style={[textStyles.kicker, { color: t.mutedText }]}>
                  Split calendar
                </Text>

                <Text
                  style={[textStyles.title, { color: t.text }]}
                  numberOfLines={1}
                >
                  {monthLabel(selectedDate)}
                </Text>

                <Text style={[textStyles.subtitle, { color: t.mutedText }]}>
                  Light = planned • Solid = completed
                </Text>
              </View>

              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.85}
                style={[
                  viewStyles.closeButton,
                  {
                    backgroundColor: t.cardAlt,
                    borderColor: t.border,
                  },
                ]}
              >
                <Ionicons name="close" size={19} color={t.text} />
              </TouchableOpacity>
            </View>

            <View
              style={[
                viewStyles.selectedCard,
                {
                  backgroundColor: t.cardAlt,
                  borderColor: t.border,
                },
              ]}
            >
              <View style={viewStyles.selectedTopRow}>
                <View style={viewStyles.selectedTextWrap}>
                  <Text
                    style={[textStyles.selectedLabel, { color: t.mutedText }]}
                  >
                    Selected date
                  </Text>

                  <Text
                    style={[textStyles.selectedDate, { color: t.text }]}
                    numberOfLines={1}
                  >
                    {formatDisplayDate(selectedDate)}
                  </Text>

                  <View style={viewStyles.planRow}>
                    <Ionicons
                      name={
                        selectedPlan.isRestDay
                          ? "moon-outline"
                          : "barbell-outline"
                      }
                      size={13}
                      color={
                        selectedPlan.isRestDay ? REST_COLOR : selectedPlanColor
                      }
                    />

                    <Text
                      style={[
                        textStyles.planText,
                        {
                          color: selectedPlan.isRestDay
                            ? REST_COLOR
                            : selectedPlanColor,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedPlan.splitName}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={jumpToToday}
                  activeOpacity={0.86}
                  style={[
                    viewStyles.todayButton,
                    {
                      backgroundColor:
                        selectedDate === today ? `${t.link}24` : t.card,
                      borderColor:
                        selectedDate === today ? `${t.link}55` : t.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="locate-outline"
                    size={14}
                    color={selectedDate === today ? t.link : t.mutedText}
                  />

                  <Text
                    style={[
                      textStyles.todayButtonText,
                      {
                        color: selectedDate === today ? t.link : t.text,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    Today
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={[
                viewStyles.calendarShell,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.045)"
                    : "rgba(255,255,255,0.74)",
                  borderColor: t.border,
                },
              ]}
            >
              <Calendar
                current={selectedDate}
                markedDates={markedDates}
                onDayPress={handleDayPress}
                enableSwipeMonths
                firstDay={1}
                theme={{
                  calendarBackground: "transparent",
                  dayTextColor: t.text,
                  monthTextColor: t.text,
                  textMonthFontWeight: "900",
                  textSectionTitleColor: t.mutedText,
                  selectedDayBackgroundColor: selectedPlanColor,
                  selectedDayTextColor: "#FFFFFF",
                  todayTextColor: t.link,
                  arrowColor: t.link,
                  textDisabledColor: isDark
                    ? "rgba(255,255,255,0.20)"
                    : "rgba(15,23,42,0.24)",
                }}
              />
            </View>

            <View style={viewStyles.legendGrid}>
              {legendItems.map((item, index) => (
                <View
                  key={`${item.id}-${item.label}-${index}`}
                  style={[
                    viewStyles.legendItem,
                    {
                      backgroundColor: t.cardAlt,
                      borderColor: t.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      viewStyles.legendDot,
                      { backgroundColor: item.color },
                    ]}
                  />

                  <Text
                    style={[textStyles.legendText, { color: t.mutedText }]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const viewStyles = StyleSheet.create<Record<string, ViewStyle>>({
  root: {
    flex: 1,
  },

  centerWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 34,
  },

  sheet: {
    maxHeight: "91%",
    borderWidth: 1,
    borderRadius: 30,
    padding: 16,
    overflow: "hidden",
    shadowOpacity: 0.2,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 9,
  },

  decorLayer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },

  glowOrb: {
    position: "absolute",
    borderRadius: 999,
  },

  glowTop: {
    width: 220,
    height: 220,
    top: -132,
    right: -92,
  },

  glowBottom: {
    width: 190,
    height: 190,
    bottom: -125,
    left: -95,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },

  iconShell: {
    width: 50,
    height: 50,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  headerText: {
    flex: 1,
    minWidth: 0,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  selectedCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 13,
    marginBottom: 12,
  },

  selectedTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  selectedTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  planRow: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },

  todayButton: {
    minHeight: 38,
    maxWidth: 104,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    flexShrink: 0,
  },

  calendarShell: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 12,
  },

  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  legendItem: {
    maxWidth: "48%",
    minHeight: 31,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
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
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  subtitle: {
    marginTop: 2,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "700",
  },

  selectedLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  selectedDate: {
    marginTop: 3,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  planText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: "900",
  },

  todayButtonText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
  },

  legendText: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
});
