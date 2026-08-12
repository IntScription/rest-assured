import type { Split } from "../types";
import { addDays, daysBetween } from "./calendarDates";

export type PlannedSplit = {
  date: string;
  split: Split | null;
  splitId: string | null;
  splitName: string;
  isRestDay: boolean;
};

export function getOrderedSplits(splits: Split[]) {
  return [...splits].sort((a, b) => {
    const orderA = Number(a.order_index ?? 0);
    const orderB = Number(b.order_index ?? 0);

    if (orderA !== orderB) return orderA - orderB;

    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
}

export function isRestSplit(split?: Split | null) {
  if (!split) return false;
  if (split.is_rest_day) return true;

  const raw = `${split.name || ""} ${split.focus || ""} ${
    split.rest_activity_label || ""
  }`.toLowerCase();

  return /\b(rest|recovery|mobility|swim|swimming|cycle|cycling|walk|walking|cardio|active recovery)\b/.test(
    raw
  );
}

export function getSplitForDate({
  date,
  anchorDate,
  splits,
}: {
  date: string;
  anchorDate: string;
  splits: Split[];
}): PlannedSplit {
  const orderedSplits = getOrderedSplits(splits);

  if (!orderedSplits.length) {
    return {
      date,
      split: null,
      splitId: null,
      splitName: "No split",
      isRestDay: true,
    };
  }

  const diff = daysBetween(anchorDate, date);
  const index =
    ((diff % orderedSplits.length) + orderedSplits.length) %
    orderedSplits.length;

  const split = orderedSplits[index];
  const rest = isRestSplit(split);

  return {
    date,
    split,
    splitId: split.id,
    splitName: rest
      ? split.rest_activity_label || split.name || "Rest Day"
      : split.name,
    isRestDay: rest,
  };
}

export function getPlannedSplitsAroundDate({
  selectedDate,
  anchorDate,
  splits,
  daysBefore = 14,
  daysAfter = 14,
}: {
  selectedDate: string;
  anchorDate: string;
  splits: Split[];
  daysBefore?: number;
  daysAfter?: number;
}) {
  const dates: PlannedSplit[] = [];

  for (let offset = -daysBefore; offset <= daysAfter; offset++) {
    const date = addDays(selectedDate, offset);

    dates.push(
      getSplitForDate({
        date,
        anchorDate,
        splits,
      })
    );
  }

  return dates;
}

export function getAnchorDateForShift({
  selectedDate,
  targetSplitId,
  splits,
}: {
  selectedDate: string;
  targetSplitId: string;
  splits: Split[];
}) {
  const orderedSplits = getOrderedSplits(splits);
  const targetIndex = orderedSplits.findIndex(
    (split) => split.id === targetSplitId
  );

  if (targetIndex < 0) return selectedDate;

  return addDays(selectedDate, -targetIndex);
}
