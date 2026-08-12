import { mergeAction, MAX_SYNC_RETRIES } from "../queue";
import type { PendingAction } from "../types";

function logCreate(id: string, weight: number): PendingAction {
  return {
    id,
    type: "log.create",
    createdAt: new Date().toISOString(),
    retries: 0,
    status: "pending",
    payload: {
      id,
      user_id: "user-1",
      exercise_id: "exercise-1",
      weight,
      reps: 5,
      sets: 3,
      volume: weight * 15,
    },
  };
}

function tutLogCreate(id: string, tutSeconds: number): PendingAction {
  return {
    id,
    type: "tutLog.create",
    createdAt: new Date().toISOString(),
    retries: 0,
    status: "pending",
    payload: {
      id,
      user_id: "user-1",
      exercise_id: "exercise-1",
      tut_seconds: tutSeconds,
      sets: 3,
      reps: 5,
      performed_on: new Date().toISOString(),
    },
  };
}

describe("mergeAction", () => {
  it("appends distinct log.create actions rather than merging them", () => {
    const first = logCreate("pending-1", 100);
    const second = logCreate("pending-2", 105);

    const afterFirst = mergeAction([], first);
    const afterSecond = mergeAction(afterFirst, second);

    // Two separate sets logged offline must both survive as separate
    // pending actions — losing one here would mean a silently dropped set.
    expect(afterSecond).toHaveLength(2);
    expect(afterSecond.map((a) => a.id)).toEqual(["pending-1", "pending-2"]);
  });

  it("appends distinct tutLog.create actions rather than merging them", () => {
    const first = tutLogCreate("pending-1", 30);
    const second = tutLogCreate("pending-2", 45);

    const afterFirst = mergeAction([], first);
    const afterSecond = mergeAction(afterFirst, second);

    // Same reasoning as log.create — two Advanced Insights entries logged
    // offline must both survive as separate pending actions.
    expect(afterSecond).toHaveLength(2);
    expect(afterSecond.map((a) => a.id)).toEqual(["pending-1", "pending-2"]);
  });

  it("coalesces repeated updates to the same entity into one action", () => {
    const firstUpdate: PendingAction = {
      id: "action-1",
      type: "program.update",
      createdAt: new Date().toISOString(),
      retries: 0,
      status: "pending",
      payload: { id: "program-1", updates: { name: "Push Pull Legs" } },
    };
    const secondUpdate: PendingAction = {
      id: "action-2",
      type: "program.update",
      createdAt: new Date().toISOString(),
      retries: 0,
      status: "pending",
      payload: { id: "program-1", updates: { is_active: true } },
    };

    const afterFirst = mergeAction([], firstUpdate);
    const afterSecond = mergeAction(afterFirst, secondUpdate);

    expect(afterSecond).toHaveLength(1);
    expect(afterSecond[0]).toMatchObject({
      type: "program.update",
      payload: { id: "program-1", updates: { name: "Push Pull Legs", is_active: true } },
    });
  });

  it("keeps only the latest profile.setCurrentProgram action", () => {
    const first: PendingAction = {
      id: "action-1",
      type: "profile.setCurrentProgram",
      createdAt: new Date().toISOString(),
      retries: 0,
      status: "pending",
      payload: { user_id: "user-1", current_program_id: "program-a" },
    };
    const second: PendingAction = {
      id: "action-2",
      type: "profile.setCurrentProgram",
      createdAt: new Date().toISOString(),
      retries: 0,
      status: "pending",
      payload: { user_id: "user-1", current_program_id: "program-b" },
    };

    const afterFirst = mergeAction([], first);
    const afterSecond = mergeAction(afterFirst, second);

    expect(afterSecond).toHaveLength(1);
    expect(afterSecond[0]).toMatchObject({
      payload: { current_program_id: "program-b" },
    });
  });
});

describe("MAX_SYNC_RETRIES", () => {
  it("is a small, sane cutoff so failed actions eventually stop retrying", () => {
    expect(MAX_SYNC_RETRIES).toBeGreaterThan(0);
    expect(MAX_SYNC_RETRIES).toBeLessThan(20);
  });
});
