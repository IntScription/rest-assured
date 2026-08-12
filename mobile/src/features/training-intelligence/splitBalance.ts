import type { TrainingLog } from "./types";
import { calcVolume } from "./metrics";

export function getSplitBalance(logs: TrainingLog[]) {
  const map = new Map<string, { split: string; volume: number; logs: number }>();

  logs.forEach((log) => {
    const split = log.split_name || log.day || "Unknown";
    const existing = map.get(split) ?? { split, volume: 0, logs: 0 };

    existing.volume += Number(log.volume ?? calcVolume(log));
    existing.logs += 1;

    map.set(split, existing);
  });

  return [...map.values()].sort((a, b) => b.volume - a.volume);
}

export function getSplitBalanceWarnings(logs: TrainingLog[]) {
  const balance = getSplitBalance(logs);
  const warnings: string[] = [];

  const push = balance.find((item) => /push|chest|shoulder|tricep/i.test(item.split));
  const pull = balance.find((item) => /pull|back|bicep/i.test(item.split));

  if (push && pull && pull.volume > 0 && push.volume / pull.volume >= 2) {
    warnings.push(
      `Push volume is ${(push.volume / pull.volume).toFixed(1)}× higher than pull. Consider balancing with more rows/pull work.`
    );
  }

  return warnings;
}
