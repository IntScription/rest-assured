import { Dimensions } from "react-native";

export const SCREEN_WIDTH = Dimensions.get("window").width;
export const DASHBOARD_GAP = 10;
export const DASHBOARD_CELL_WIDTH = (SCREEN_WIDTH - 32 - 28 - DASHBOARD_GAP) / 2;
export const REST_PRESETS = [45, 60, 90, 120, 150, 180, 240, 300];
export const APPROX_LOG_CARD_HEIGHT = 170;
export const APPROX_MONTH_HEADER_HEIGHT = 30;

export const PR_COLORS = {
  heaviest: "#F59E0B",
  volume: "#8B5CF6",
  reps: "#2563EB",
  recent: "#10B981",
};

export const EXERCISE_BACKGROUND = {
  light: "#EAF1FF",
  dark: "#050A14",
};

export const EXERCISE_BUBBLES = {
  light: {
    primary: "rgba(37,99,235,0.14)",
    secondary: "rgba(139,92,246,0.10)",
    third: "rgba(16,185,129,0.08)",
  },
  dark: {
    primary: "rgba(59,130,246,0.16)",
    secondary: "rgba(139,92,246,0.13)",
    third: "rgba(16,185,129,0.10)",
  },
};
