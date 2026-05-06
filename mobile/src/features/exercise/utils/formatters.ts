import { format, isToday, isYesterday } from "date-fns";
import { APPROX_LOG_CARD_HEIGHT, APPROX_MONTH_HEADER_HEIGHT } from "../constants";
import type { LogRow, LogTag } from "../types";

export function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const normalized =
    clean.length === 3
      ? clean
        .split("")
        .map((char) => char + char)
        .join("")
      : clean;

  const value = parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function isDarkColor(hex: string | undefined | null) {
  if (!hex || !hex.startsWith("#")) return false;

  try {
    const { r, g, b } = hexToRgb(hex);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.5;
  } catch {
    return false;
  }
}

export function formatWeightLabel(weight: number | null | undefined) {
  const value = Number(weight ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "Bodyweight";
  if (Number.isInteger(value)) return `${value} kg`;
  return `${value.toFixed(1)} kg`;
}

export function formatCompactWeight(weight: number | null | undefined) {
  const value = Number(weight ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "BW";
  if (Number.isInteger(value)) return `${value} kg`;
  return `${value.toFixed(1)} kg`;
}

export function formatLogLine(log: Pick<LogRow, "weight" | "reps" | "sets">) {
  const weightValue = Number(log.weight ?? 0);
  const weightText = weightValue > 0 ? `${formatWeightLabel(weightValue)} × ` : "Bodyweight × ";
  return `${weightText}${log.reps} × ${log.sets} sets`;
}

export function formatComparableLine(log: Pick<LogRow, "weight" | "reps" | "sets">) {
  return `${formatCompactWeight(log.weight)} · ${log.reps}×${log.sets}`;
}

export function formatLogDate(value: string | null | undefined) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  if (isToday(date)) return `Today · ${format(date, "p")}`;
  if (isYesterday(date)) return `Yesterday · ${format(date, "p")}`;
  return format(date, "MMM d, yyyy · p");
}

export function formatDurationLabel(seconds: number | null | undefined) {
  const value = Number(seconds ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 60) return `${value}s`;
  const mins = Math.floor(value / 60);
  const secs = value % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function sanitizeDecimalInput(value: string) {
  const cleaned = value.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

export function sanitizeIntegerInput(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export function calculateVolume(weight: string, reps: string, sets: string) {
  const w = parseFloat(weight) || 0;
  const r = parseInt(reps, 10) || 0;
  const s = parseInt(sets, 10) || 0;
  return Math.max(1, w) * r * s;
}

export function getValidationError(weight: string, reps: string, sets: string) {
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

export function addWeight(current: string, delta: number) {
  const base = parseFloat(current || "0") || 0;
  const next = Math.max(0, base + delta);
  if (Number.isInteger(next)) return String(next);
  return next.toFixed(1);
}

export function addInteger(current: string, delta: number) {
  const base = parseInt(current || "0", 10) || 0;
  return String(Math.max(0, base + delta));
}

export function getLogTag(log: Pick<LogRow, "type">): LogTag {
  if (log.type === "warmup" || log.type === "topset") return log.type;
  return "working";
}

export function getLogTagLabel(tag: LogTag) {
  if (tag === "warmup") return "Warm-up";
  if (tag === "topset") return "Top Set";
  return "Working";
}

export function getMonthLabel(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return format(date, "MMMM yyyy");
}

export function matchesSearch(log: LogRow, query: string) {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  const tag = getLogTagLabel(getLogTag(log)).toLowerCase();
  const date = formatLogDate(log.created_at).toLowerCase();
  const note = (log.day ?? "").toLowerCase();
  const line = formatLogLine(log).toLowerCase();
  return tag.includes(q) || date.includes(q) || note.includes(q) || line.includes(q);
}

export function getApproxScrollOffsetForIndex(logs: LogRow[], index: number) {
  if (index <= 0) return 0;
  let monthHeaders = 0;
  for (let i = 0; i <= index; i += 1) {
    const current = getMonthLabel(logs[i]?.created_at);
    const prev = i > 0 ? getMonthLabel(logs[i - 1]?.created_at) : null;
    if (i === 0 || current !== prev) monthHeaders += 1;
  }
  return index * APPROX_LOG_CARD_HEIGHT + monthHeaders * APPROX_MONTH_HEADER_HEIGHT;
}

export function getHeaderTitle(name: string | null | undefined) {
  if (!name) return "Exercise";
  return name.length > 24 ? `${name.slice(0, 24).trim()}…` : name;
}
