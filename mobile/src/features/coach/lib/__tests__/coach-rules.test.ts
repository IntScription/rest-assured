import {
  buildNextSessionInsight,
  buildSkillFocusInsight,
  calculateReadinessScore,
} from "../coach-rules";
import type { SkillLog } from "@/src/features/skills/types";

type WorkoutLogFixture = {
  id: string;
  exercise_id: string;
  weight: number | null;
  reps: number;
  sets: number;
  volume?: number | null;
  rpe?: number | null;
  type?: string | null;
  created_at: string | null;
  exercise_name?: string;
};

function log(overrides: Partial<WorkoutLogFixture> & { id: string; created_at: string }): WorkoutLogFixture {
  return {
    exercise_id: "ex-1",
    weight: 100,
    reps: 5,
    sets: 3,
    volume: 1500,
    exercise_name: "Bench Press",
    ...overrides,
  };
}

function skillLog(overrides: Partial<SkillLog> & { id: string; logged_at: string }): SkillLog {
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
    created_at: overrides.logged_at,
    ...overrides,
  };
}

describe("buildNextSessionInsight", () => {
  it("falls back to a default message with no weighted logs", () => {
    const result = buildNextSessionInsight({
      userId: "user-1",
      profile: null,
      recentLogs: [],
      nextSplitName: null,
    });

    expect(result.summary).toBe("Log your next session and Coach will start suggesting targets.");
    expect(result.payload.suggestion_available).toBe(false);
  });

  it("credits a recent PR alongside the base progression suggestion", () => {
    const recentLogs = [
      log({ id: "3", created_at: "2026-08-15", weight: 110, volume: 1650 }),
      log({ id: "2", created_at: "2026-08-10", weight: 100, volume: 1500 }),
      log({ id: "1", created_at: "2026-08-05", weight: 100, volume: 1500 }),
    ];

    const result = buildNextSessionInsight({
      userId: "user-1",
      profile: null,
      recentLogs,
      nextSplitName: null,
    });

    expect(result.summary).toContain("new PR");
    expect(result.payload.is_recent_pr).toBe(true);
    expect(result.payload.is_plateaued).toBe(false);
  });

  it("appends the plateau message when the focus exercise has plateaued", () => {
    const recentLogs = [
      log({ id: "5", created_at: "2026-08-20" }),
      log({ id: "4", created_at: "2026-08-16" }),
      log({ id: "3", created_at: "2026-08-12" }),
      log({ id: "2", created_at: "2026-08-08" }),
      log({ id: "1", created_at: "2026-08-04", weight: 105, volume: 1575 }),
    ];

    const result = buildNextSessionInsight({
      userId: "user-1",
      profile: null,
      recentLogs,
      nextSplitName: null,
    });

    expect(result.payload.is_plateaued).toBe(true);
    expect(result.payload.is_recent_pr).toBe(false);
    expect(result.summary).toContain("No new weight or volume PR");
  });

  it("gates progression when the latest set was near-max RPE (via getNextSetSuggestion)", () => {
    const recentLogs = [
      log({ id: "2", created_at: "2026-08-15", rpe: 9 }),
      log({ id: "1", created_at: "2026-08-10" }),
    ];

    const result = buildNextSessionInsight({
      userId: "user-1",
      profile: null,
      recentLogs,
      nextSplitName: null,
    });

    expect(result.payload.suggestion_title).toBe("Repeat load");
    expect(result.summary).toContain("Repeat");
  });
});

describe("buildSkillFocusInsight", () => {
  const userSkills = [
    {
      id: "us-1",
      skill_id: "skill-1",
      status: "active",
      skills: {
        id: "skill-1",
        name: "L-sit",
        category: "static",
        difficulty: "intermediate" as const,
        metric_type: "seconds" as const,
      },
    },
  ];

  it("suggests starting a skill when none is tracked", () => {
    const result = buildSkillFocusInsight({ userId: "user-1", userSkills: [], skillLogs: [] });
    expect(result.summary).toBe("Start tracking a skill so Coach can suggest a focused progression target.");
  });

  it("prompts consistent logging when a skill is active but never logged", () => {
    const result = buildSkillFocusInsight({ userId: "user-1", userSkills, skillLogs: [] });
    expect(result.summary).toContain("Log it consistently");
  });

  it("calls out a new personal best when the latest log is the best one", () => {
    const skillLogs = [
      skillLog({ id: "2", value: 45, unit: "s", logged_at: "2026-08-20" }),
      skillLog({ id: "1", value: 30, unit: "s", logged_at: "2026-08-10" }),
    ];

    const result = buildSkillFocusInsight({ userId: "user-1", userSkills, skillLogs });

    expect(result.summary).toContain("New personal best on L-sit: 45s");
    expect(result.payload.is_new_best).toBe(true);
  });

  it("shows the standing best when the latest log did not beat it", () => {
    const skillLogs = [
      skillLog({ id: "2", value: 20, unit: "s", logged_at: "2026-08-20" }),
      skillLog({ id: "1", value: 45, unit: "s", logged_at: "2026-08-10" }),
    ];

    const result = buildSkillFocusInsight({ userId: "user-1", userSkills, skillLogs });

    expect(result.summary).toContain("Best so far: 45s");
    expect(result.payload.is_new_best).toBe(false);
  });
});

describe("calculateReadinessScore — recovery/RPE warnings", () => {
  it("merges high-RPE recovery warnings into reasons and penalizes the score", () => {
    const recentLogs = [
      log({ id: "1", created_at: "2026-08-01T00:00:00.000Z", rpe: 9 }),
      log({ id: "2", created_at: "2026-07-25T00:00:00.000Z", rpe: 9 }),
      log({ id: "3", created_at: "2026-07-18T00:00:00.000Z", rpe: 9 }),
    ];

    const result = calculateReadinessScore({
      recovery: null,
      health: null,
      weeklySessions: [],
      recentLogs,
      sessions: [],
    });

    expect(result.reasons).toContain(
      "Several recent sets were high RPE. Consider repeating load or taking a lighter day."
    );
    expect(result.score).toBe(64);
    expect(result.status).toBe("moderate");
  });

  it("behaves exactly as before when recentLogs/sessions are omitted", () => {
    const result = calculateReadinessScore({
      recovery: null,
      health: null,
      weeklySessions: [],
    });

    expect(result.reasons).toEqual([]);
    expect(result.score).toBe(70);
    expect(result.status).toBe("moderate");
  });
});
