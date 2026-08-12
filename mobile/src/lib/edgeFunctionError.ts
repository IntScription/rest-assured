// supabase-js's functions.invoke() only rejects with a generic
// "Edge Function returned a non-2xx status code" message. The actual
// reason lives in error.context, which for an HTTP error is the raw
// Response the function returned — it has to be read explicitly.
export async function getEdgeFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (!error || typeof error !== "object") return fallback;

  const context = (error as { context?: unknown }).context;

  if (context && typeof (context as Response).json === "function") {
    try {
      const body = await (context as Response).clone().json();
      const parts: string[] = [];

      if (typeof body?.error === "string" && body.error.trim()) parts.push(body.error.trim());
      else if (typeof body?.message === "string" && body.message.trim()) parts.push(body.message.trim());

      // Some functions (e.g. monthly-training-review) wrap the upstream
      // provider's raw error response in a `details` field — surface that
      // too, since "xAI request failed" alone hides the actual reason.
      const details = body?.details;
      const detailsMessage =
        typeof details?.error?.message === "string"
          ? details.error.message
          : typeof details?.error === "string"
            ? details.error
            : details
              ? JSON.stringify(details).slice(0, 300)
              : null;

      if (detailsMessage) parts.push(detailsMessage);

      if (parts.length) return [...new Set(parts)].join(" — ");
    } catch {
      // context wasn't JSON — fall through to the generic message below.
    }
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : fallback;
}
