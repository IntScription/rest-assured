import { detectPlateau } from "../plateauDetection";
import { getPrFlags } from "../prLogic";
import type { LogRow } from "../../types";

function log(overrides: Partial<LogRow> & { id: string; log_date: string }): LogRow {
  return {
    user_id: "user-1",
    exercise_id: "exercise-1",
    weight: 100,
    reps: 5,
    sets: 3,
    volume: 1500,
    created_at: `${overrides.log_date}T00:00:00.000Z`,
    type: "working",
    ...overrides,
  };
}

describe("detectPlateau", () => {
  it("does not flag a plateau with too few sessions logged", () => {
    const logs = [log({ id: "1", log_date: "2026-08-01" }), log({ id: "2", log_date: "2026-08-03" })];
    const result = detectPlateau(logs, getPrFlags(logs));

    expect(result.isPlateaued).toBe(false);
    expect(result.sessionsConsidered).toBe(2);
  });

  it("flags a plateau when the last N sessions never beat the earlier best", () => {
    // Oldest session sets the benchmark (heaviest + volume PR); every
    // session after it repeats the exact same weight/reps/sets — no new PR.
    const logs = [
      log({ id: "5", log_date: "2026-08-15" }),
      log({ id: "4", log_date: "2026-08-11" }),
      log({ id: "3", log_date: "2026-08-08" }),
      log({ id: "2", log_date: "2026-08-04" }),
      log({ id: "1", log_date: "2026-08-01", weight: 105, volume: 1575 }),
    ];
    const result = detectPlateau(logs, getPrFlags(logs), 4);

    expect(result.isPlateaued).toBe(true);
    expect(result.message).toContain("No new weight or volume PR");
  });

  it("does not flag a plateau when a recent session set a new PR", () => {
    const logs = [
      log({ id: "5", log_date: "2026-08-15", weight: 110, volume: 1650 }),
      log({ id: "4", log_date: "2026-08-11" }),
      log({ id: "3", log_date: "2026-08-08" }),
      log({ id: "2", log_date: "2026-08-04" }),
      log({ id: "1", log_date: "2026-08-01" }),
    ];
    const result = detectPlateau(logs, getPrFlags(logs), 4);

    expect(result.isPlateaued).toBe(false);
  });

  it("ignores warmup sets when assessing progression", () => {
    const logs = [
      // A warmup on the most recent day, far heavier than any working set.
      // If warmups counted, this alone would cancel the plateau.
      log({ id: "warmup", log_date: "2026-08-18", type: "warmup", weight: 200, volume: 3000 }),
      log({ id: "6", log_date: "2026-08-15" }),
      log({ id: "5", log_date: "2026-08-11" }),
      log({ id: "4", log_date: "2026-08-08" }),
      log({ id: "3", log_date: "2026-08-04" }),
      log({ id: "1", log_date: "2026-08-01", weight: 105, volume: 1575 }),
    ];
    const result = detectPlateau(logs, getPrFlags(logs), 4);

    // 5 real working sessions exist; the PR sits in the oldest one, outside
    // the most-recent-4 window — and the warmup must not count as a 6th
    // session or as a PR that would cancel the plateau.
    expect(result.sessionsConsidered).toBe(4);
    expect(result.isPlateaued).toBe(true);
  });
});
