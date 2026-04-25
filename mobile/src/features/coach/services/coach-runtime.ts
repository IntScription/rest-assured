export type CoachRuntimeMode = "rule_only" | "hosted_ai" | "local_ai" | "auto";

export function getCoachRuntimeMode(): CoachRuntimeMode {
  return "auto";
}

export function getCoachDisplayLabel(params: {
  canUseLocal: boolean;
  canUseHosted: boolean;
}) {
  if (params.canUseLocal) return "On-device AI (Apple)";
  if (params.canUseHosted) return "Cloud AI (Groq)";
  return "Rule-based";
}
