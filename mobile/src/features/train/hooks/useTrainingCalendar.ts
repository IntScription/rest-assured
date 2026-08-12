import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import { supabase } from "@/src/lib/supabase";
import { setTrainingDate } from "@/src/store/training-date";
import type { Program, Split } from "../types";
import {
  getTodayDateString,
  hasDatePassedByHours,
  isPastDate,
} from "../lib/calendarDates";
import {
  getAnchorDateForShift,
  getPlannedSplitsAroundDate,
  getSplitForDate,
} from "../lib/splitSchedule";

type UseTrainingCalendarArgs = {
  userId: string | null;
  activeProgram: Program | null;
  splits: Split[];
};

type SessionRow = {
  workout_date: string;
  status?: string | null;
  session_type?: string | null;
};

export function useTrainingCalendar({
  userId,
  activeProgram,
  splits,
}: UseTrainingCalendarArgs) {
  const [selectedDate, setSelectedDateState] = useState(getTodayDateString());
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  const [loggedDates, setLoggedDates] = useState<string[]>([]);
  const [skippedDates, setSkippedDates] = useState<string[]>([]);
  const [missedDates, setMissedDates] = useState<string[]>([]);
  const [calendarBusy, setCalendarBusy] = useState(false);

  const today = getTodayDateString();

  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
    setTrainingDate(date);
  }, []);

  const anchorDate = useMemo(() => {
    return (
      activeProgram?.schedule_anchor_date ||
      activeProgram?.created_at?.slice(0, 10) ||
      today
    );
  }, [activeProgram?.created_at, activeProgram?.schedule_anchor_date, today]);

  const selectedPlannedSplit = useMemo(() => {
    return getSplitForDate({
      date: selectedDate,
      anchorDate,
      splits,
    });
  }, [anchorDate, selectedDate, splits]);

  const fetchCalendarDates = useCallback(async () => {
    if (!userId) return;

    const [sessionsRes, logsRes] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select("workout_date, status, session_type")
        .eq("user_id", userId),

      supabase.from("logs").select("log_date").eq("user_id", userId),
    ]);

    if (!sessionsRes.error) {
      const sessions = (sessionsRes.data ?? []) as SessionRow[];

      setCompletedDates(
        Array.from(
          new Set(
            sessions
              .filter((row) =>
                ["completed", "auto_completed_rest"].includes(
                  String(row.status ?? "completed")
                )
              )
              .map((row) => row.workout_date)
              .filter(Boolean)
          )
        )
      );

      setSkippedDates(
        Array.from(
          new Set(
            sessions
              .filter((row) => row.status === "skipped")
              .map((row) => row.workout_date)
              .filter(Boolean)
          )
        )
      );

      setMissedDates(
        Array.from(
          new Set(
            sessions
              .filter((row) => row.status === "missed")
              .map((row) => row.workout_date)
              .filter(Boolean)
          )
        )
      );
    }

    if (!logsRes.error) {
      setLoggedDates(
        Array.from(
          new Set(
            (logsRes.data ?? [])
              .map((row: any) => row.log_date)
              .filter(Boolean)
          )
        )
      );
    }
  }, [userId]);

  const autoCompletePastRestDays = useCallback(async () => {
    if (!userId || !activeProgram?.id || !splits.length) return;

    const completedSet = new Set(completedDates);
    const skippedSet = new Set(skippedDates);

    const planned = getPlannedSplitsAroundDate({
      selectedDate: today,
      anchorDate,
      splits,
      daysBefore: 45,
      daysAfter: 0,
    });

    const restDatesToComplete = planned.filter((item) => {
      if (!item.isRestDay) return false;
      if (item.date === today) return false;
      if (completedSet.has(item.date)) return false;
      if (skippedSet.has(item.date)) return false;

      return hasDatePassedByHours(item.date, 24);
    });

    if (!restDatesToComplete.length) return;

    const rows = restDatesToComplete.map((item) => ({
      user_id: userId,
      program_id: activeProgram.id,
      split_id: item.splitId,
      workout_date: item.date,
      completed_at: new Date().toISOString(),
      session_type: "rest",
      status: "auto_completed_rest",
      source: "auto",
    }));

    const { error } = await supabase.from("workout_sessions").upsert(rows, {
      onConflict: "user_id,program_id,workout_date",
      ignoreDuplicates: true,
    });

    if (!error) {
      await fetchCalendarDates();
    }
  }, [
    activeProgram?.id,
    anchorDate,
    completedDates,
    fetchCalendarDates,
    skippedDates,
    splits,
    today,
    userId,
  ]);

  const markSelectedDateComplete = useCallback(async () => {
    if (!userId || !activeProgram?.id) return;

    try {
      setCalendarBusy(true);

      const { error } = await supabase.from("workout_sessions").upsert(
        {
          user_id: userId,
          program_id: activeProgram.id,
          split_id: selectedPlannedSplit.splitId,
          workout_date: selectedDate,
          completed_at: new Date().toISOString(),
          session_type: selectedPlannedSplit.isRestDay ? "rest" : "workout",
          status: "completed",
          source: "manual",
        },
        {
          onConflict: "user_id,program_id,workout_date",
        }
      );

      if (error) throw error;

      await fetchCalendarDates();
    } catch (err: any) {
      Alert.alert("Could not mark complete", err?.message || "Please try again.");
    } finally {
      setCalendarBusy(false);
    }
  }, [
    activeProgram?.id,
    fetchCalendarDates,
    selectedDate,
    selectedPlannedSplit.isRestDay,
    selectedPlannedSplit.splitId,
    userId,
  ]);

  const markSelectedDateSkipped = useCallback(async () => {
    if (!userId || !activeProgram?.id) return;

    try {
      setCalendarBusy(true);

      const { error } = await supabase.from("workout_sessions").upsert(
        {
          user_id: userId,
          program_id: activeProgram.id,
          split_id: selectedPlannedSplit.splitId,
          workout_date: selectedDate,
          completed_at: new Date().toISOString(),
          session_type: selectedPlannedSplit.isRestDay ? "rest" : "workout",
          status: "skipped",
          source: "manual",
        },
        {
          onConflict: "user_id,program_id,workout_date",
        }
      );

      if (error) throw error;

      await fetchCalendarDates();
    } catch (err: any) {
      Alert.alert("Could not mark skipped", err?.message || "Please try again.");
    } finally {
      setCalendarBusy(false);
    }
  }, [
    activeProgram?.id,
    fetchCalendarDates,
    selectedDate,
    selectedPlannedSplit.isRestDay,
    selectedPlannedSplit.splitId,
    userId,
  ]);

  const shiftCycleToSelectedSplit = useCallback(async () => {
    if (!userId || !activeProgram?.id || !selectedPlannedSplit.splitId) return;

    const nextAnchorDate = getAnchorDateForShift({
      selectedDate,
      targetSplitId: selectedPlannedSplit.splitId,
      splits,
    });

    try {
      setCalendarBusy(true);

      const { error } = await supabase
        .from("programs")
        .update({ schedule_anchor_date: nextAnchorDate })
        .eq("user_id", userId)
        .eq("id", activeProgram.id);

      if (error) throw error;

      Alert.alert(
        "Cycle shifted",
        "Your split calendar has been adjusted from this selected date."
      );
    } catch (err: any) {
      Alert.alert("Could not shift cycle", err?.message || "Please try again.");
    } finally {
      setCalendarBusy(false);
    }
  }, [
    activeProgram?.id,
    selectedDate,
    selectedPlannedSplit.splitId,
    splits,
    userId,
  ]);

  useEffect(() => {
    if (!userId) return;
    void fetchCalendarDates();
  }, [fetchCalendarDates, userId]);

  useEffect(() => {
    setTrainingDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (!userId || !activeProgram?.id || !splits.length) return;
    void autoCompletePastRestDays();
  }, [activeProgram?.id, autoCompletePastRestDays, splits.length, userId]);

  const selectedDateIsMissed =
    isPastDate(selectedDate) &&
    !completedDates.includes(selectedDate) &&
    !loggedDates.includes(selectedDate) &&
    !skippedDates.includes(selectedDate) &&
    !selectedPlannedSplit.isRestDay;

  return {
    selectedDate,
    setSelectedDate,
    selectedPlannedSplit,
    completedDates,
    loggedDates,
    skippedDates,
    missedDates,
    calendarBusy,
    selectedDateIsMissed,
    fetchCalendarDates,
    markSelectedDateComplete,
    markSelectedDateSkipped,
    shiftCycleToSelectedSplit,
    autoCompletePastRestDays,
  };
}
