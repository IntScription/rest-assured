import { getSkillBestLog, getSkillMetricValue, getSkillPrFlags, getSkillTrendSeries } from "../skill-pr";
import type { SkillLog } from "../../types";

function skillLog(overrides: Partial<SkillLog> & { id: string }): SkillLog {
  return {
    user_id: "user-1",
    user_skill_id: "user-skill-1",
    skill_id: "skill-1",
    stage_id: null,
    value: null,
    unit: null,
    attempts: null,
    notes: null,
    workout_session_id: null,
    exercise_id: null,
    logged_at: "2026-08-01T00:00:00.000Z",
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getSkillMetricValue", () => {
  it("reads attempts for attempts-type skills, not value", () => {
    const log = skillLog({ id: "1", value: null, attempts: 12 });
    expect(getSkillMetricValue(log, "attempts")).toBe(12);
  });

  it("reads value for seconds/reps-type skills", () => {
    const log = skillLog({ id: "1", value: 30, attempts: null });
    expect(getSkillMetricValue(log, "seconds")).toBe(30);
    expect(getSkillMetricValue(log, "reps")).toBe(30);
  });

  it("has no comparable value for milestone-type skills", () => {
    const log = skillLog({ id: "1", value: 5, attempts: 5 });
    expect(getSkillMetricValue(log, "milestone")).toBeNull();
  });
});

describe("getSkillBestLog", () => {
  it("picks the highest attempts count for attempts-type skills", () => {
    const logs = [
      skillLog({ id: "3", value: null, attempts: 4 }),
      skillLog({ id: "2", value: null, attempts: 9 }),
      skillLog({ id: "1", value: null, attempts: 6 }),
    ];
    expect(getSkillBestLog(logs, "attempts")?.id).toBe("2");
  });

  it("picks the highest hold time for seconds-type skills", () => {
    const logs = [
      skillLog({ id: "2", value: 45 }),
      skillLog({ id: "1", value: 30 }),
    ];
    expect(getSkillBestLog(logs, "seconds")?.id).toBe("2");
  });

  it("returns null when there are no logs", () => {
    expect(getSkillBestLog([], "seconds")).toBeNull();
  });
});

describe("getSkillPrFlags", () => {
  it("flags each new personal best for attempts-type skills", () => {
    // newest-first, as loaded from the API
    const logs = [
      skillLog({ id: "3", attempts: 8 }),
      skillLog({ id: "2", attempts: 5 }),
      skillLog({ id: "1", attempts: 6 }),
    ];
    const flags = getSkillPrFlags(logs, "attempts");

    expect(flags["1"]).toBe(true); // first log ever is always a PR baseline
    expect(flags["2"]).toBe(false); // 5 < 6, not a PR
    expect(flags["3"]).toBe(true); // 8 > 6, new PR
  });

  it("flags hold-time PRs in chronological order for seconds-type skills", () => {
    const logs = [
      skillLog({ id: "3", value: 20 }),
      skillLog({ id: "2", value: 40 }),
      skillLog({ id: "1", value: 30 }),
    ];
    const flags = getSkillPrFlags(logs, "seconds");

    expect(flags["1"]).toBe(true);
    expect(flags["2"]).toBe(true); // 40 > 30
    expect(flags["3"]).toBe(false); // 20 < 40
  });
});

describe("getSkillTrendSeries", () => {
  it("orders points chronologically (oldest to newest) from newest-first input", () => {
    const logs = [
      skillLog({ id: "3", value: 45, logged_at: "2026-08-15T00:00:00.000Z" }),
      skillLog({ id: "2", value: 30, logged_at: "2026-08-08T00:00:00.000Z" }),
      skillLog({ id: "1", value: 20, logged_at: "2026-08-01T00:00:00.000Z" }),
    ];
    const series = getSkillTrendSeries(logs, "seconds");

    expect(series.map((p) => p.id)).toEqual(["1", "2", "3"]);
    expect(series.map((p) => p.value)).toEqual([20, 30, 45]);
  });

  it("skips logs with no comparable value for the metric type", () => {
    const logs = [
      skillLog({ id: "2", attempts: 9, logged_at: "2026-08-08T00:00:00.000Z" }),
      skillLog({ id: "1", attempts: null, logged_at: "2026-08-01T00:00:00.000Z" }),
    ];
    const series = getSkillTrendSeries(logs, "attempts");

    expect(series.map((p) => p.id)).toEqual(["2"]);
  });

  it("caps the series at maxPoints, keeping only the most recent logs", () => {
    const logs = [
      skillLog({ id: "3", value: 10, logged_at: "2026-08-15T00:00:00.000Z" }),
      skillLog({ id: "2", value: 10, logged_at: "2026-08-08T00:00:00.000Z" }),
      skillLog({ id: "1", value: 10, logged_at: "2026-08-01T00:00:00.000Z" }),
    ];
    const series = getSkillTrendSeries(logs, "seconds", 2);

    expect(series.map((p) => p.id)).toEqual(["2", "3"]);
  });

  it("returns an empty series for no logs", () => {
    expect(getSkillTrendSeries([], "seconds")).toEqual([]);
  });
});
