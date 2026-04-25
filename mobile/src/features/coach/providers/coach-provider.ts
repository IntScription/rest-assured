import type {
  CoachProviderRequest,
  CoachProviderResponse,
} from "@/src/features/coach/types/coach";

export interface CoachProvider {
  ask(request: CoachProviderRequest): Promise<CoachProviderResponse>;
}
