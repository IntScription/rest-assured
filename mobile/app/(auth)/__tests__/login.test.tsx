import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

// The mock instance is created *inside* the factory (via require, not an
// outer `import`) because jest.mock() calls are hoisted above regular
// import/const statements — referencing a variable built from an imported
// factory here would silently resolve to undefined at mock-application time.
jest.mock("@/src/lib/supabase", () => {
  const { createMockSupabase } = require("@/src/lib/testUtils/mockSupabase");
  return { __esModule: true, supabase: createMockSupabase() };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

import { supabase } from "@/src/lib/supabase";
import LoginScreen from "../login";

describe("LoginScreen smoke test", () => {
  it("renders without crashing and shows the core sign-in controls", async () => {
    const { getByText, getByPlaceholderText } = await render(<LoginScreen />);

    await waitFor(() => {
      expect(getByPlaceholderText("Email")).toBeTruthy();
    });

    expect(getByPlaceholderText("Password")).toBeTruthy();
    expect(getByText("Login")).toBeTruthy();
  });

  it("actually calls Supabase auth when submitting the login form", async () => {
    const { getByText, getByPlaceholderText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByPlaceholderText("Email"), "athlete@example.com");
    await fireEvent.changeText(getByPlaceholderText("Password"), "hunter2");
    await fireEvent.press(getByText("Login"));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "athlete@example.com",
        password: "hunter2",
      });
    });
  });
});
