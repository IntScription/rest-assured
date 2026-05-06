export function getFatigue(logs: any[]) {
  if (!logs.length) return "low";

  const recent = logs.slice(-3);

  const avg =
    recent.reduce((a, l) => a + (l.rpe || 0), 0) /
    recent.length;

  if (avg >= 8.5) return "high";
  if (avg >= 7) return "moderate";
  return "low";
}
