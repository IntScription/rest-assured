import { getTrendSeries } from "../trendLogic";
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

describe("getTrendSeries", () => {
  it("orders points chronologically (oldest to newest) from newest-first input", () => {
    const logs = [
      log({ id: "3", created_at: "2026-08-15T00:00:00.000Z", volume: 300 }),
      log({ id: "2", created_at: "2026-08-08T00:00:00.000Z", volume: 200 }),
      log({ id: "1", created_at: "2026-08-01T00:00:00.000Z", volume: 100 }),
    ];
    const series = getTrendSeries(logs, "volume");

    expect(series.map((p) => p.id)).toEqual(["1", "2", "3"]);
    expect(series.map((p) => p.value)).toEqual([100, 200, 300]);
  });

  it("caps the series at maxPoints, keeping only the most recent logs", () => {
    const logs = [
      log({ id: "3", created_at: "2026-08-15T00:00:00.000Z" }),
      log({ id: "2", created_at: "2026-08-08T00:00:00.000Z" }),
      log({ id: "1", created_at: "2026-08-01T00:00:00.000Z" }),
    ];
    const series = getTrendSeries(logs, "volume", 2);

    expect(series.map((p) => p.id)).toEqual(["2", "3"]);
  });

  it("reads the requested metric (weight, reps, volume, or rpe)", () => {
    const logs = [log({ id: "1", weight: 105, reps: 6, volume: 1890, rpe: 8 })];

    expect(getTrendSeries(logs, "weight")[0].value).toBe(105);
    expect(getTrendSeries(logs, "reps")[0].value).toBe(6);
    expect(getTrendSeries(logs, "volume")[0].value).toBe(1890);
    expect(getTrendSeries(logs, "rpe")[0].value).toBe(8);
  });

  it("skips logs with no RPE recorded rather than plotting them as 0", () => {
    const logs = [
      log({ id: "2", created_at: "2026-08-08T00:00:00.000Z", rpe: 9 }),
      log({ id: "1", created_at: "2026-08-01T00:00:00.000Z", rpe: null }),
    ];
    const series = getTrendSeries(logs, "rpe");

    expect(series.map((p) => p.id)).toEqual(["2"]);
  });

  it("returns an empty series for no logs", () => {
    expect(getTrendSeries([], "volume")).toEqual([]);
  });
});
