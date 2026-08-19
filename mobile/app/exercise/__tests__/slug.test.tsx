import React from "react";
import { render, waitFor } from "@testing-library/react-native";

// See app/(auth)/__tests__/login.test.tsx for why everything the factory
// needs is constructed *inside* it (via require/literals) rather than
// closed over from outer const declarations.
jest.mock("@/src/lib/supabase", () => {
  const { createMockSupabase } = require("@/src/lib/testUtils/mockSupabase");
  const mock = createMockSupabase();
  mock.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "user-1", email: "athlete@example.com" } } },
    error: null,
  });
  mock.setTableResponse("exercises", {
    data: { id: "exercise-1", name: "Pike Push Ups", slug: "pike-push-ups", split_id: null },
    error: null,
  });
  mock.setTableResponse("logs", { data: [], error: null });
  return { __esModule: true, supabase: mock };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ slug: "pike-push-ups" }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactActual = require("react");
    ReactActual.useEffect(() => callback(), []);
  },
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

import ExerciseDetailScreen from "../[slug]";

describe("Exercise detail screen smoke test", () => {
  it("loads a real exercise and renders its name without crashing", async () => {
    const { getByText } = await render(<ExerciseDetailScreen />);

    await waitFor(
      () => {
        expect(getByText(/pike push ups/i)).toBeTruthy();
      },
      { timeout: 5000 }
    );
  });
});
