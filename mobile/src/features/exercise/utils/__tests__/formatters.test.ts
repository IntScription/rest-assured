import {
  sanitizeDecimalInput,
  sanitizeIntegerInput,
  calculateVolume,
  getValidationError,
} from "../formatters";

describe("sanitizeDecimalInput", () => {
  it("strips non-numeric characters", () => {
    expect(sanitizeDecimalInput("12a3kg")).toBe("123");
  });

  it("converts a comma to a decimal point", () => {
    expect(sanitizeDecimalInput("82,5")).toBe("82.5");
  });

  it("collapses multiple decimal points into one", () => {
    expect(sanitizeDecimalInput("1.2.3")).toBe("1.23");
  });

  it("passes through a clean value unchanged", () => {
    expect(sanitizeDecimalInput("82.5")).toBe("82.5");
  });
});

describe("sanitizeIntegerInput", () => {
  it("strips everything but digits", () => {
    expect(sanitizeIntegerInput("1a2b3")).toBe("123");
  });

  it("strips decimal points (reps/sets are whole numbers)", () => {
    expect(sanitizeIntegerInput("8.5")).toBe("85");
  });
});

describe("calculateVolume", () => {
  it("multiplies weight * reps * sets", () => {
    expect(calculateVolume("100", "5", "3")).toBe(1500);
  });

  it("treats bodyweight (0 or empty weight) as a multiplier of 1, not 0", () => {
    expect(calculateVolume("", "10", "3")).toBe(30);
    expect(calculateVolume("0", "10", "3")).toBe(30);
  });

  it("treats missing reps/sets as 0", () => {
    expect(calculateVolume("100", "", "3")).toBe(0);
    expect(calculateVolume("100", "5", "")).toBe(0);
  });
});

describe("getValidationError", () => {
  it("requires reps", () => {
    expect(getValidationError("100", "", "3")).toBe("Reps are required.");
  });

  it("requires sets", () => {
    expect(getValidationError("100", "5", "")).toBe("Sets are required.");
  });

  it("allows empty weight (bodyweight exercises)", () => {
    expect(getValidationError("", "5", "3")).toBe("");
  });

  it("rejects negative weight", () => {
    expect(getValidationError("-10", "5", "3")).toBe("Weight cannot be negative.");
  });

  it("rejects reps below 1", () => {
    expect(getValidationError("100", "0", "3")).toBe("Reps must be at least 1.");
  });

  it("rejects sets below 1", () => {
    expect(getValidationError("100", "5", "0")).toBe("Sets must be at least 1.");
  });

  it("rejects unreasonably high values", () => {
    expect(getValidationError("100", "1000", "3")).toBe("Reps are too high.");
    expect(getValidationError("100", "5", "1000")).toBe("Sets are too high.");
    expect(getValidationError("10000", "5", "3")).toBe("Weight is too high.");
  });

  it("accepts a valid working set", () => {
    expect(getValidationError("100", "5", "3")).toBe("");
  });
});
