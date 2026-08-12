import type { SkillDashboardCard } from "@/src/features/skills/types";

export type SkillRoutePreview = {
  card: SkillDashboardCard;
  cachedAt: number;
};

const previews = new Map<string, SkillRoutePreview>();

/**
 * Instant, in-memory preview for the skill detail screen — mirrors
 * exerciseRouteCache. The dashboard already has the full SkillDashboardCard
 * in hand at tap time, so the detail screen can render immediately instead
 * of waiting on its own fresh fetch.
 */
export function setSkillRoutePreview(card: SkillDashboardCard) {
  previews.set(card.skill.id, { card, cachedAt: Date.now() });
}

export function getSkillRoutePreview(skillId: string | string[] | undefined) {
  const key = Array.isArray(skillId) ? skillId[0] : skillId;
  if (!key) return null;

  const preview = previews.get(key);
  if (!preview) return null;

  if (Date.now() - preview.cachedAt > 1000 * 60 * 5) {
    previews.delete(key);
    return null;
  }

  return preview;
}

export function clearSkillRoutePreview(skillId: string | string[] | undefined) {
  const key = Array.isArray(skillId) ? skillId[0] : skillId;
  if (!key) return;
  previews.delete(key);
}
