import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const WELCOME_VERSION_KEY = "welcomeSeenVersion";

function getCurrentWelcomeVersion(): string {
  const legacyVersion =
    (
      Constants as typeof Constants & {
        manifest2?: {
          extra?: {
            expoClient?: {
              version?: string;
            };
          };
        };
      }
    ).manifest2?.extra?.expoClient?.version ?? null;

  return Constants.expoConfig?.version ?? legacyVersion ?? "1.0.0";
}

export async function shouldShowWelcome(): Promise<boolean> {
  const seenVersion = await AsyncStorage.getItem(WELCOME_VERSION_KEY);
  const currentVersion = getCurrentWelcomeVersion();
  return seenVersion !== currentVersion;
}

export async function markWelcomeSeen(): Promise<void> {
  const currentVersion = getCurrentWelcomeVersion();
  await AsyncStorage.setItem(WELCOME_VERSION_KEY, currentVersion);
}

export async function resetWelcomeSeen(): Promise<void> {
  await AsyncStorage.removeItem(WELCOME_VERSION_KEY);
}

export async function getSeenWelcomeVersion(): Promise<string | null> {
  return AsyncStorage.getItem(WELCOME_VERSION_KEY);
}

export function getWelcomeVersion(): string {
  return getCurrentWelcomeVersion();
}
