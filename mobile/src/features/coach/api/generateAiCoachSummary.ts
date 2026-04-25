import { supabase } from "@/src/lib/supabase";
import { buildCoachAskContext } from "@/src/features/coach/lib/coach-queries";

export async function generateAiCoachSummary(userId: string) {
  const context = await buildCoachAskContext(userId);

  const { data, error } = await supabase.functions.invoke("coach-ask", {
    body: {
      prompt:
        "Summarize the user's current training state, readiness, and immediate next-step recommendation in 3-5 concise sentences.",
      context,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to invoke coach-ask");
  }

  const { data: insertedInsight, error: insertError } = await supabase
    .from("coach_insights")
    .insert({
      user_id: userId,
      insight_type: "plan_adjustment",
      title: "AI Coach Summary",
      summary: data?.message ?? "No response generated.",
      payload: {
        provider: data?.provider ?? "hosted",
      },
      source: "ai",
      model_name: data?.model ?? null,
    })
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedInsight;
}
