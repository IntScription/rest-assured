import AsyncStorage from "@react-native-async-storage/async-storage";

export type OnboardingStep =
  | "idle"
  | "profile_intro"
  | "create_program"
  | "create_split"
  | "go_home"
  | "create_exercise"
  | "open_log"
  | "create_log"
  | "open_advanced"
  | "done";

const ONBOARDING_ACTIVE_KEY = "onboarding_active";
const ONBOARDING_STEP_KEY = "onboarding_step";

export async function startOnboarding() {
  await AsyncStorage.multiSet([
    [ONBOARDING_ACTIVE_KEY, "true"],
    [ONBOARDING_STEP_KEY, "profile_intro"],
  ]);
}

export async function stopOnboarding() {
  await AsyncStorage.multiSet([
    [ONBOARDING_ACTIVE_KEY, "false"],
    [ONBOARDING_STEP_KEY, "done"],
  ]);
}

export async function resetOnboarding() {
  await AsyncStorage.multiRemove([ONBOARDING_ACTIVE_KEY, ONBOARDING_STEP_KEY]);
}

export async function isOnboardingActive(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_ACTIVE_KEY);
  return value === "true";
}

export async function getOnboardingStep(): Promise<OnboardingStep> {
  const value = await AsyncStorage.getItem(ONBOARDING_STEP_KEY);
  return (value as OnboardingStep) || "idle";
}

export async function setOnboardingStep(step: OnboardingStep) {
  await AsyncStorage.setItem(ONBOARDING_STEP_KEY, step);
}
