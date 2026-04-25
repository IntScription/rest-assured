import { useMemo } from "react";
import { useLocalLLM } from "expo-local-llm";
import type { CoachAskContext } from "@/src/features/coach/types/coach";

function compactContext(context: CoachAskContext) {
  return JSON.stringify(
    {
      profile: context.profile
        ? {
          age: context.profile.age,
          height_cm: context.profile.height_cm,
          weight_kg: context.profile.weight_kg,
          goal: context.profile.goal,
          training_style: context.profile.training_style,
          experience_level: context.profile.experience_level,
          training_days_per_week: context.profile.training_days_per_week,
        }
        : null,
      recovery: context.todayRecovery
        ? {
          sleep_hours: context.todayRecovery.sleep_hours,
          energy_level: context.todayRecovery.energy_level,
          soreness_level: context.todayRecovery.soreness_level,
          stress_level: context.todayRecovery.stress_level,
          motivation_level: context.todayRecovery.motivation_level,
          resting_heart_rate: context.todayRecovery.resting_heart_rate,
          steps: context.todayRecovery.steps,
        }
        : null,
      measurements: context.latestMeasurements
        ? {
          weight_kg: context.latestMeasurements.weight_kg,
          waist_cm: context.latestMeasurements.waist_cm,
          body_fat_percent: context.latestMeasurements.body_fat_percent,
        }
        : null,
      recent_logs: context.recentLogs.slice(0, 8),
      recent_skill_logs: context.recentSkillLogs.slice(0, 6),
      latest_insights: context.latestInsights.slice(0, 4).map((x) => ({
        type: x.insight_type,
        title: x.title,
        summary: x.summary,
      })),
    },
    null,
    2
  );
}

function buildCoachPrompt(prompt: string, context: CoachAskContext) {
  return [
    "You are Coach inside a fitness app.",
    "Be practical, concise, safe, and conservative.",
    "Do not diagnose medical issues.",
    "Do not suggest reckless progression.",
    "Prefer modest progression when data is incomplete.",
    "Use only the provided context.",
    "Answer using this structure:",
    "1) direct answer",
    "2) why",
    "3) immediate next step",
    "",
    "User question:",
    prompt,
    "",
    "Training context:",
    compactContext(context),
  ].join("\n");
}

export function useLocalCoach() {
  const llm = useLocalLLM({
    instructions:
      "You are Coach inside a fitness app. Be concise, practical, safe, and conservative.",
  });

  const isAvailable =
    llm.availability === "available" && typeof llm.respond === "function";

  const askLocalCoach = useMemo(
    () =>
      async (prompt: string, context: CoachAskContext) => {
        if (llm.availability !== "available" || typeof llm.respond !== "function") {
          throw new Error(`Local Coach unavailable: ${llm.availability}`);
        }

        const message = await llm.respond(buildCoachPrompt(prompt, context));

        return {
          message,
          model: "apple_foundation_models",
          source: "local" as const,
        };
      },
    [llm]
  );

  return {
    availability: llm.availability,
    isGenerating: llm.isGenerating,
    streamedText: llm.streamedText,
    error: llm.error,
    isAvailable,
    askLocalCoach,
    streamResponse: llm.streamResponse,
    cancelStream: llm.cancelStream,
  };
}
