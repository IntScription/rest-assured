import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemePreference = "light" | "dark" | "system";

const THEME_PREF_KEY = "rest-assured-theme-pref";

type Listener = (value: ThemePreference) => void;
const listeners: Listener[] = [];

export const setThemePreference = async (value: ThemePreference) => {
  try {
    await AsyncStorage.setItem(THEME_PREF_KEY, value);
  } catch {
    // ignore storage errors
  }
  listeners.forEach((l) => l(value));
};

export const getThemePreference = async (): Promise<ThemePreference> => {
  try {
    const stored = await AsyncStorage.getItem(THEME_PREF_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // ignore
  }
  return "system";
};

export function useColorScheme(): "light" | "dark" {
  const systemScheme = useRNColorScheme();
  const [pref, setPref] = useState<ThemePreference | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_PREF_KEY);
        if (!mounted) return;
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPref(stored);
        }
      } catch {
        // ignore
      }
    })();

    const listener: Listener = (value) => {
      if (!mounted) return;
      setPref(value);
    };
    listeners.push(listener);

    return () => {
      mounted = false;
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  const effective =
    pref && pref !== "system"
      ? pref
      : (systemScheme ?? "light");

  return effective === "dark" ? "dark" : "light";
}
