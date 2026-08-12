import { useMemo } from "react";
import { useLocalLLM } from "expo-local-llm";
import type { Schema } from "expo-local-llm";
import type { MonthlyTrainingStats } from "@/src/features/training-intelligence/types";
import type { MonthlyAiFeedback } from "../lib/monthlyReviewTypes";

const monthlyFeedbackSchema: Schema = {
  headline: { type: "string", description: "One-sentence headline summarizing the month." },
  positives: { type: "array", description: "What went well this month.", items: { type: "string" } },
  warnings: { type: "array", description: "Concerns worth watching.", items: { type: "string" } },
  nextMonthFocus: { type: "array", description: "What to focus on next month.", items: { type: "string" } },
  deloadSuggestion: {
    type: "string",
    description: "A brief training-load/deload note, or an empty string if none is needed.",
  },
  coachNote: { type: "string", description: "A short, encouraging coach note." },
};

function buildPrompt(stats: MonthlyTrainingStats) {
  return [
    "You are a practical strength training coach.",
    "Give concise monthly feedback based only on the provided stats. Do not invent numbers.",
    "Avoid medical claims. Mention deload only as a training-load suggestion, not medical advice.",
    "",
    "Monthly stats:",
    JSON.stringify(stats, null, 2),
  ].join("\n");
}

function normalizeFeedback(raw: string): MonthlyAiFeedback {
  try {
    const parsed = JSON.parse(raw) as Partial<MonthlyAiFeedback>;

    return {
      headline: String(parsed.headline ?? "Monthly training review"),
      positives: Array.isArray(parsed.positives) ? parsed.positives.map(String) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      nextMonthFocus: Array.isArray(parsed.nextMonthFocus) ? parsed.nextMonthFocus.map(String) : [],
      deloadSuggestion:
        parsed.deloadSuggestion == null || String(parsed.deloadSuggestion).trim() === ""
          ? null
          : String(parsed.deloadSuggestion),
      coachNote: String(parsed.coachNote ?? ""),
    };
  } catch {
    return {
      headline: "Monthly training review",
      positives: [],
      warnings: ["On-device feedback could not be parsed."],
      nextMonthFocus: [],
      deloadSuggestion: null,
      coachNote: raw,
    };
  }
}

export function useLocalMonthlyReview() {
  const llm = useLocalLLM({
    instructions:
      "You are a practical strength training coach. Be concise, safe, and conservative. Use only the provided stats.",
    responseFormat: "json",
    schema: monthlyFeedbackSchema,
  });

  const isAvailable = llm.availability === "available" && typeof llm.respond === "function";

  const generate = useMemo(
    () =>
      async (stats: MonthlyTrainingStats): Promise<MonthlyAiFeedback> => {
        if (llm.availability !== "available" || typeof llm.respond !== "function") {
          throw new Error(`On-device AI unavailable: ${llm.availability}`);
        }

        const raw = await llm.respond(buildPrompt(stats));
        return normalizeFeedback(raw);
      },
    [llm]
  );

  return {
    availability: llm.availability,
    isAvailable,
    generate,
  };
}
