import type { CoachProvider } from "@/src/features/coach/providers/coach-provider";
import type {
  CoachProviderRequest,
  CoachProviderResponse,
} from "@/src/features/coach/types/coach";

export class HostedCoachProvider implements CoachProvider {
  async ask(request: CoachProviderRequest): Promise<CoachProviderResponse> {
    const response = await fetch("/api/coach/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody || "Hosted Coach request failed");
    }

    const data = await response.json();

    return {
      message: data.message ?? "No response",
      model: data.model ?? null,
      source: "hosted",
    };
  }
}
