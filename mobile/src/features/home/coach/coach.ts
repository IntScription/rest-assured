export function getCoachInsights(logs: any[]) {
  if (!logs.length) return "Start logging to get insights";

  const recent = logs.slice(-5);

  const avgRpe =
    recent.reduce((a, l) => a + (l.rpe || 0), 0) /
    recent.length;

  const volume = (l: any) =>
    (l.weight || 0) * (l.reps || 0) * (l.sets || 0);

  const volTrend =
    volume(recent[recent.length - 1]) -
    volume(recent[0]);

  if (avgRpe >= 8.5) {
    return "⚠ You're pushing hard. Consider lighter day.";
  }

  if (volTrend < 0) {
    return "Volume dropped. Try increasing intensity.";
  }

  if (volTrend > 0) {
    return "🔥 Progressing well. Keep it up.";
  }

  return "Stay consistent.";
}
