import { supabase } from "@/src/lib/supabase";
import { buildCoachAskContext } from "@/src/features/coach/lib/coach-queries";

function extractFunctionErrorMessage(error: unknown) {
  if (!error) return "Failed to invoke coach-ask";

  if (typeof error === "string") return error;

  if (typeof error === "object") {
    const e = error as {
      message?: string;
      context?: unknown;
      status?: number;
      statusCode?: number;
      response?: { status?: number; data?: unknown };
    };

    const parts: string[] = [];

    if (typeof e.message === "string" && e.message.trim()) {
      parts.push(e.message.trim());
    }

    if (typeof e.status === "number") {
      parts.push(`status ${e.status}`);
    } else if (typeof e.statusCode === "number") {
      parts.push(`status ${e.statusCode}`);
    } else if (typeof e.response?.status === "number") {
      parts.push(`status ${e.response.status}`);
    }

    const context = e.context;
    if (typeof context === "string" && context.trim()) {
      parts.push(context.trim());
    } else if (context && typeof context === "object") {
      try {
        const maybeError = (context as { error?: unknown; message?: unknown });
        if (typeof maybeError.error === "string" && maybeError.error.trim()) {
          parts.push(maybeError.error.trim());
        } else if (
          typeof maybeError.message === "string" &&
          maybeError.message.trim()
        ) {
          parts.push(maybeError.message.trim());
        } else {
          parts.push(JSON.stringify(context));
        }
      } catch {
        // ignore
      }
    }

    const responseData = e.response?.data;
    if (responseData && typeof responseData === "object") {
      try {
        const maybeError = responseData as { error?: unknown; message?: unknown };
        if (typeof maybeError.error === "string" && maybeError.error.trim()) {
          parts.push(maybeError.error.trim());
        } else if (
          typeof maybeError.message === "string" &&
          maybeError.message.trim()
        ) {
          parts.push(maybeError.message.trim());
        }
      } catch {
        // ignore
      }
    }

    const unique = [...new Set(parts.filter(Boolean))];
    if (unique.length > 0) return unique.join(" — ");
  }

  return "Failed to invoke coach-ask";
}

export async function askCoach(userId: string, message: string) {
  const context = await buildCoachAskContext(userId);

  const { data, error } = await supabase.functions.invoke("coach-ask", {
    body: {
      prompt: message,
      context,
    },
  });

  if (error) {
    throw new Error(extractFunctionErrorMessage(error));
  }

  if (!data || typeof data !== "object") {
    throw new Error("coach-ask returned an invalid response");
  }

  const payload = data as {
    message?: string;
    model?: string | null;
    provider?: string | null;
    error?: string;
  };

  if (payload.error) {
    throw new Error(payload.error);
  }

  const assistantMessage = payload.message ?? "No response generated.";
  const model = payload.model ?? null;
  const provider = payload.provider ?? "hosted";

  const { data: insertedAssistant, error: insertError } = await supabase
    .from("coach_conversations")
    .insert({
      user_id: userId,
      role: "assistant",
      message: assistantMessage,
      context: {
        source: provider,
        model,
      },
    })
    .select("id, role, message, created_at")
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedAssistant;
}
