import { getCoachNextSetInsight, type CoachInsightInput } from "../coachNextSetInsight";

function baseInput(overrides: Partial<CoachInsightInput> = {}): CoachInsightInput {
  return {
    currentWeight: 100,
    currentReps: 5,
    currentSets: 3,
    lastWeight: 100,
    lastReps: 5,
    lastSets: 3,
    bestWeight: 100,
    bestReps: 5,
    bestSets: 3,
    lastVolume: 1500,
    bestVolume: 1500,
    currentVolume: 1500,
    restSecondsLeft: 0,
    recentWorkingLogCount: 3,
    daysSinceLastWorkingLog: 1,
    lastRpe: null,
    ...overrides,
  };
}

describe("getCoachNextSetInsight — RPE integration", () => {
  it("cautions against pushing harder when the last set was near-max RPE", () => {
    const insight = getCoachNextSetInsight(baseInput({ lastRpe: 9 }));
    expect(insight.tone).toBe("caution");
    expect(insight.title).toBe("Last set was near max");
    expect(insight.body).toContain("RPE 9");
  });

  it("does not trigger the high-RPE warning below the threshold", () => {
    const insight = getCoachNextSetInsight(baseInput({ lastRpe: 7 }));
    expect(insight.title).not.toBe("Last set was near max");
  });

  it("does not trigger the high-RPE warning when no RPE was logged", () => {
    const insight = getCoachNextSetInsight(baseInput({ lastRpe: null }));
    expect(insight.title).not.toBe("Last set was near max");
  });

  it("still prioritizes the rest-timer check over the RPE check", () => {
    const insight = getCoachNextSetInsight(baseInput({ lastRpe: 9.5, restSecondsLeft: 30 }));
    expect(insight.title).toBe("Let the rest timer finish");
  });
});
