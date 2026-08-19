import React from "react";
import { render, waitFor } from "@testing-library/react-native";

// See app/(auth)/__tests__/login.test.tsx for why the mock instance is
// created via require() inside the factory rather than an outer import.
jest.mock("@/src/lib/supabase", () => {
  const { createMockSupabase } = require("@/src/lib/testUtils/mockSupabase");
  return { __esModule: true, supabase: createMockSupabase() };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactActual = require("react");
    ReactActual.useEffect(() => callback(), []);
  },
}));

jest.mock("@/components/navigation/CustomTabBar", () => ({
  useCustomTabBarBottomPadding: () => 80,
}));

jest.mock("expo-local-llm", () => ({
  useLocalLLM: () => ({
    availability: "notReady",
    isGenerating: false,
    streamedText: "",
    error: null,
  }),
}));

jest.mock("@/src/features/coach/health/apple-health", () => ({
  fetchAppleHealthSnapshot: jest.fn(() => Promise.resolve(null)),
  requestAppleHealthPermissions: jest.fn(() => Promise.resolve()),
  syncAppleHealthToSupabase: jest.fn(() => Promise.resolve(null)),
}));

import { supabase } from "@/src/lib/supabase";
import CoachScreen from "../index";

describe("CoachScreen smoke test", () => {
  it("renders without crashing when there is no session yet", async () => {
    const { getByText } = await render(<CoachScreen />);

    await waitFor(() => {
      expect(getByText("Coach")).toBeTruthy();
    });
  });

  it("actually checks the Supabase session on mount", async () => {
    await render(<CoachScreen />);

    await waitFor(() => {
      expect(supabase.auth.getSession).toHaveBeenCalled();
    });
  });
});
