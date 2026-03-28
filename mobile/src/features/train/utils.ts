import type { Program, Split } from "./types";

export function normalizeProgram(program: Partial<Program> & { id: string; name: string }): Program {
  return {
    id: program.id,
    name: program.name,
    is_active: program.is_active ?? false,
    user_id: program.user_id ?? "",
    created_at: program.created_at ?? null,
  };
}

export function normalizeSplitOrder(items: Split[]): Split[] {
  return items.map((item, index) => ({ ...item, order_index: index }));
}

export function getProgramAccent(seed: number | string) {
  const accents = [
    { bg: "rgba(10,132,255,0.12)", text: "#0a84ff" },
    { bg: "rgba(94,92,230,0.12)", text: "#5e5ce6" },
    { bg: "rgba(255,159,10,0.12)", text: "#ff9f0a" },
    { bg: "rgba(48,209,88,0.12)", text: "#30d158" },
    { bg: "rgba(191,90,242,0.12)", text: "#bf5af2" },
  ];

  const hash =
    typeof seed === "number"
      ? seed
      : Array.from(seed).reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 7);

  return accents[Math.abs(hash) % accents.length];
}

export function getProgramInitials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return "P";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}
