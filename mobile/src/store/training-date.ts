import { useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

let selectedTrainingDate = getTodayDateString();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getSelectedTrainingDate() {
  return selectedTrainingDate;
}

export function setSelectedTrainingDate(date: string) {
  if (!date || selectedTrainingDate === date) return;

  selectedTrainingDate = date;
  emit();
}

// Alias for files that import setTrainingDate
export const setTrainingDate = setSelectedTrainingDate;

export function resetSelectedTrainingDate() {
  selectedTrainingDate = getTodayDateString();
  emit();
}

// Alias for consistency
export const resetTrainingDate = resetSelectedTrainingDate;

function subscribe(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useTrainingDate() {
  const selectedDate = useSyncExternalStore(
    subscribe,
    getSelectedTrainingDate,
    getSelectedTrainingDate
  );

  return {
    selectedDate,
    setSelectedDate: setSelectedTrainingDate,
    setTrainingDate: setSelectedTrainingDate,
    resetSelectedDate: resetSelectedTrainingDate,
    resetTrainingDate: resetSelectedTrainingDate,
    today: getTodayDateString(),
  };
}
