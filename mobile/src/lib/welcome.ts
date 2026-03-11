import AsyncStorage from "@react-native-async-storage/async-storage";

const WELCOME_KEY = "hasSeenWelcome";

export async function shouldShowWelcome(): Promise<boolean> {
  const value = await AsyncStorage.getItem(WELCOME_KEY);
  return value !== "true";
}

export async function markWelcomeSeen(): Promise<void> {
  await AsyncStorage.setItem(WELCOME_KEY, "true");
}

export async function resetWelcomeSeen(): Promise<void> {
  await AsyncStorage.removeItem(WELCOME_KEY);
}
