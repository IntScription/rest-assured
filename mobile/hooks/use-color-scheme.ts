import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemePreference = "light" | "dark" | "system";

const THEME_PREF_KEY = "rest-assured-theme-pref";

type Listener = (value: ThemePreference) => void;
const listeners: Listener[] = [];

// Every screen that mounts fresh (e.g. navigating to a new exercise's
// [slug] route) creates a brand-new useColorScheme() instance, which used
// to always start at `pref = null` and fall back to the OS system scheme
// for one render before its own AsyncStorage read resolved. If the device's
// system appearance differs from the user's saved in-app preference (a very
// common setup), that one render visibly flashes the wrong theme. This
// module-level cache lets every instance after the first seed synchronously
// from whatever's already been resolved this session.
let cachedPref: ThemePreference | null = null;

export const setThemePreference = async (value: ThemePreference) => {
  cachedPref = value;
  // Notify immediately so every screen re-themes on this tick; persist in the
  // background so the AsyncStorage round-trip never gates the visual change.
  listeners.forEach((l) => l(value));
  try {
    await AsyncStorage.setItem(THEME_PREF_KEY, value);
  } catch {
    // ignore storage errors — theme still applied for this session
  }
};

export const getThemePreference = async (): Promise<ThemePreference> => {
  try {
    const stored = await AsyncStorage.getItem(THEME_PREF_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      cachedPref = stored;
      return stored;
    }
  } catch {
    // ignore
  }
  return "system";
};

export function useColorScheme(): "light" | "dark" {
  const systemScheme = useRNColorScheme();
  const [pref, setPref] = useState<ThemePreference | null>(() => cachedPref);

  useEffect(() => {
    let mounted = true;

    if (cachedPref === null) {
      (async () => {
        try {
          const stored = await AsyncStorage.getItem(THEME_PREF_KEY);
          if (!mounted) return;
          if (stored === "light" || stored === "dark" || stored === "system") {
            cachedPref = stored;
            setPref(stored);
          } else {
            cachedPref = "system";
          }
        } catch {
          // ignore
        }
      })();
    }

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
