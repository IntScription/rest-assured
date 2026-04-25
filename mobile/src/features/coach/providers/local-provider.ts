import { CoachProvider } from "@/src/features/coach/providers/coach-provider";
import type {
  CoachProviderRequest,
  CoachProviderResponse,
} from "@/src/features/coach/types/coach";

/**
 * This provider is intentionally not used directly from screens.
 * Hook-based local inference is handled by useLocalCoach.ts for React correctness.
 * This class exists for interface compatibility only.
 */
export class LocalCoachProvider implements CoachProvider {
  async ask(_request: CoachProviderRequest): Promise<CoachProviderResponse> {
    throw new Error(
      "LocalCoachProvider must be used through the useLocalCoach hook in React components."
    );
  }
}
