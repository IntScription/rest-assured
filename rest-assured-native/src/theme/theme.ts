import { useMemo } from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";

export type AppTheme = {
  background: string;
  card: string;
  cardAlt: string;
  text: string;
  mutedText: string;
  border: string;
  primaryBg: string;
  primaryText: string;
  secondaryBg: string;
  secondaryText: string;
  link: string;
  danger: string;
  success: string;
  tabBarBg: string;
  tabBarBorder: string;
  inputBg: string;
  inputBorder: string;
};

export const DARK_THEME: AppTheme = {
  background: "#0a0a0a",
  card: "#151515",
  cardAlt: "#141414",
  text: "#ffffff",
  mutedText: "#888888",
  border: "#222222",
  primaryBg: "#ffffff",
  primaryText: "#000000",
  secondaryBg: "#333333",
  secondaryText: "#ffffff",
  link: "#1e90ff",
  danger: "#ff4d4d",
  success: "#16a34a",
  tabBarBg: "#000000",
  tabBarBorder: "#111111",
  inputBg: "#0f0f0f",
  inputBorder: "#2a2a2a",
};

export const LIGHT_THEME: AppTheme = {
  background: "#f6f7f8",
  card: "#ffffff",
  cardAlt: "#f1f2f4",
  text: "#111827",
  mutedText: "#6b7280",
  border: "#e5e7eb",
  primaryBg: "#111827",
  primaryText: "#ffffff",
  secondaryBg: "#e5e7eb",
  secondaryText: "#111827",
  link: "#2563eb",
  danger: "#dc2626",
  success: "#16a34a",
  tabBarBg: "#ffffff",
  tabBarBorder: "#e5e7eb",
  inputBg: "#ffffff",
  inputBorder: "#d1d5db",
};

export function useAppTheme(): AppTheme {
  const scheme = useColorScheme(); // resolved (preference + system)
  return useMemo(() => (scheme === "dark" ? DARK_THEME : LIGHT_THEME), [scheme]);
}

