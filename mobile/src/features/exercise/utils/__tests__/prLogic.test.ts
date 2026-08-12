import { getLogAchievement, getPrFlags } from "../prLogic";
import type { LogRow } from "../../types";

function log(overrides: Partial<LogRow> & { id: string }): LogRow {
  return {
    user_id: "user-1",
    exercise_id: "exercise-1",
    weight: 100,
    reps: 5,
    sets: 3,
    volume: 1500,
    created_at: "2026-08-01T00:00:00.000Z",
    type: "working",
    ...overrides,
  };
}

describe("getPrFlags — rep PR for weighted exercises", () => {
  it("flags a rep PR on a weighted set that beats the previous best rep count", () => {
    const logs = [
      log({ id: "2", weight: 100, reps: 8, volume: 2400 }),
      log({ id: "1", weight: 100, reps: 5, volume: 1500 }),
    ];
    const flags = getPrFlags(logs);

    expect(flags["2"].reps).toBe(true);
    expect(flags["1"].reps).toBe(true); // first log ever seen is always a PR baseline
  });

  it("does not flag a rep PR when reps do not exceed the existing best, weighted or not", () => {
    const logs = [
      log({ id: "2", weight: 100, reps: 5, volume: 1500 }),
      log({ id: "1", weight: 100, reps: 8, volume: 2400 }),
    ];
    const flags = getPrFlags(logs);

    expect(flags["2"].reps).toBe(false);
  });

  it("still tracks rep PRs for bodyweight sets (weight 0)", () => {
    const logs = [
      log({ id: "2", weight: 0, reps: 15, volume: 0 }),
      log({ id: "1", weight: 0, reps: 10, volume: 0 }),
    ];
    const flags = getPrFlags(logs);

    expect(flags["2"].reps).toBe(true);
  });
});

describe("getLogAchievement — rep PR messaging", () => {
  it("reports a rep PR for a weighted exercise when only reps improved", () => {
    const previousLogs = [log({ id: "1", weight: 100, reps: 5, volume: 1500 })];
    const message = getLogAchievement({ weight: 100, reps: 8, sets: 3, volume: 1500, type: "working" }, previousLogs);

    expect(message).toBe("New rep PR");
  });

  it("still reports a bodyweight rep PR when weight is 0", () => {
    const previousLogs = [log({ id: "1", weight: 0, reps: 10, volume: 0 })];
    const message = getLogAchievement({ weight: 0, reps: 15, sets: 1, volume: 0, type: "working" }, previousLogs);

    expect(message).toBe("New bodyweight rep PR");
  });
});
