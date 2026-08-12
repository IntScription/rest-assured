import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import QuickLoggerCard from "../QuickLoggerCard";
import type { ThemeLike } from "../../types";
import type { CoachNextSetInsight } from "../../utils/coachNextSetInsight";

const theme: ThemeLike = {
  card: "#fff",
  cardAlt: "#f1f2f4",
  text: "#111",
  mutedText: "#666",
  border: "#ddd",
  link: "#2563eb",
};

const coachInsight: CoachNextSetInsight = {
  tone: "neutral",
  title: "Fill the set first",
  body: "Add reps and sets so Coach can compare this attempt.",
  disclaimer: "Coach is only giving context from your logs.",
};

function baseProps(overrides: Partial<React.ComponentProps<typeof QuickLoggerCard>> = {}) {
  return {
    t: theme,
    editingId: null,
    logTag: "working" as const,
    onTagChange: jest.fn(),
    lastHint: "No logs yet.",
    value: { weight: "100", reps: "5", sets: "3", note: "", rpe: "" },
    onChange: jest.fn(),
    currentVolume: 1500,
    restDuration: 120,
    onRestDurationChange: jest.fn(),
    weightJump: 2.5,
    onWeightJumpChange: jest.fn(),
    coachInsight,
    suggestionActions: [],
    lastLabel: "—",
    bestLabel: "—",
    formError: "",
    statusMsg: "",
    onSave: jest.fn(),
    onCancelEdit: jest.fn(),
    saving: false,
    ...overrides,
  };
}

describe("QuickLoggerCard — keyboard-first logging flow", () => {
  it("wires Weight and Reps to advance focus, and Sets to submit", async () => {
    const { getByPlaceholderText } = await render(<QuickLoggerCard {...baseProps()} />);

    const weightInput = getByPlaceholderText("0");
    const repsInput = getByPlaceholderText("8");
    const setsInput = getByPlaceholderText("1");

    expect(weightInput.props.returnKeyType).toBe("next");
    expect(weightInput.props.keyboardType).toBe("decimal-pad");
    expect(repsInput.props.returnKeyType).toBe("next");
    expect(repsInput.props.keyboardType).toBe("number-pad");
    expect(setsInput.props.returnKeyType).toBe("done");
    expect(setsInput.props.keyboardType).toBe("number-pad");
  });

  it("submits when Return is pressed on the final field (Sets)", async () => {
    const onSave = jest.fn();
    const { getByPlaceholderText } = await render(<QuickLoggerCard {...baseProps({ onSave })} />);

    fireEvent(getByPlaceholderText("1"), "submitEditing");

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("the Add Log button still submits, independent of the keyboard flow", async () => {
    const onSave = jest.fn();
    const { getByText } = await render(<QuickLoggerCard {...baseProps({ onSave })} />);

    fireEvent.press(getByText("Add Log"));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows Update Log instead of Add Log while editing an existing entry", async () => {
    const { getByText } = await render(<QuickLoggerCard {...baseProps({ editingId: "log-1" })} />);
    expect(getByText("Update Log")).toBeTruthy();
  });

  it("disables inputs and the save button while a save is in flight", async () => {
    const { getByPlaceholderText, getByText } = await render(
      <QuickLoggerCard {...baseProps({ saving: true })} />
    );

    expect(getByPlaceholderText("0").props.editable).toBe(false);
    expect(getByPlaceholderText("8").props.editable).toBe(false);
    expect(getByPlaceholderText("1").props.editable).toBe(false);
    expect(getByText("Saving…")).toBeTruthy();
  });
});
