import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SKILL_STATUS } from "@/src/features/skills/constants";
import { subscribeSkillsDashboardChanged } from "@/src/features/skills/services";
import type {
  Skill,
  SkillDashboardCard,
  SkillLog,
  SkillStage,
  SkillsDashboardSummary,
  UserSkill,
  UserSkillMilestone,
} from "@/src/features/skills/types";
import { getSkillHighlight } from "@/src/features/skills/utils/get-skill-highlight";
import { getSkillProgress } from "@/src/features/skills/utils/get-skill-progress";
import { getSkillStreak } from "@/src/features/skills/utils/get-skill-streak";
import { getSkillMetricValue } from "@/src/features/skills/utils/skill-pr";
import { normalizeSkillStatus } from "@/src/features/skills/utils/normalize-skill-status";
import { supabase } from "@/src/lib/supabase";
import { cacheGetJson, cacheKey, cacheSetJson } from "@/src/lib/offline-cache";

type CachedSkillsDashboard = {
  cards: SkillDashboardCard[];
  nextRecommendation: SkillDashboardCard | null;
  recentMilestones: RecentMilestone[];
  summary: SkillsDashboardSummary;
};

type RecentMilestone = {
  id: string;
  skillName: string;
  stageName: string;
};

export type SkillStatusFilter = "all" | "active" | "paused" | "mastered";

type DashboardState = {
  loading: boolean;
  refreshing: boolean;
  summary: SkillsDashboardSummary;
  cards: SkillDashboardCard[];
  nextRecommendation: SkillDashboardCard | null;
  recentMilestones: RecentMilestone[];
  userId: string | null;
  statusFilter: SkillStatusFilter;
};

function getStartOfWeekDate() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  now.setDate(now.getDate() - diff);
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function emptySummary(): SkillsDashboardSummary {
  return {
    activeSkills: 0,
    sessionsThisWeek: 0,
    streakDays: 0,
    completedMilestones: 0,
  };
}

function getSafeTime(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortCards(a: SkillDashboardCard, b: SkillDashboardCard) {
  const favoriteDelta =
    Number(b.userSkill.is_favorite) - Number(a.userSkill.is_favorite);

  if (favoriteDelta !== 0) {
    return favoriteDelta;
  }

  const timeA = getSafeTime(
    a.userSkill.last_logged_at ?? a.userSkill.created_at
  );
  const timeB = getSafeTime(
    b.userSkill.last_logged_at ?? b.userSkill.created_at
  );

  return timeB - timeA;
}

function isSkillDashboardCard(
  value: SkillDashboardCard | null
): value is SkillDashboardCard {
  return value !== null;
}

function buildLogMaps(logs: SkillLog[], skillMetricTypeById: Map<string, Skill["metric_type"]>) {
  const logsByUserSkillId = new Map<string, SkillLog[]>();
  const bestLogByUserSkillId = new Map<string, SkillLog>();

  for (const log of logs) {
    const existingLogs = logsByUserSkillId.get(log.user_skill_id) ?? [];
    existingLogs.push(log);
    logsByUserSkillId.set(log.user_skill_id, existingLogs);

    const metricType = skillMetricTypeById.get(log.skill_id);
    if (!metricType) continue;

    const logScore = getSkillMetricValue(log, metricType);
    if (logScore === null) continue;

    const existingBest = bestLogByUserSkillId.get(log.user_skill_id);
    const existingScore = existingBest ? getSkillMetricValue(existingBest, metricType) : null;

    if (!existingBest || existingScore === null || logScore > existingScore) {
      bestLogByUserSkillId.set(log.user_skill_id, log);
    }
  }

  return { logsByUserSkillId, bestLogByUserSkillId };
}

function buildMilestoneCountMap(milestones: UserSkillMilestone[]) {
  const counts = new Map<string, number>();

  for (const milestone of milestones) {
    counts.set(
      milestone.user_skill_id,
      (counts.get(milestone.user_skill_id) ?? 0) + 1
    );
  }

  return counts;
}

export function useSkillsDashboard() {
  const [state, setState] = useState<DashboardState>({
    loading: true,
    refreshing: false,
    summary: emptySummary(),
    cards: [],
    nextRecommendation: null,
    recentMilestones: [],
    userId: null,
    statusFilter: "all",
  });

  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Instant paint from the last-known dashboard while buildState() refetches
  // in the background — mirrors HomeScreen's cache-first hydration, since
  // this hook previously had no caching at all and always showed the
  // skeleton dashboard on every visit.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId || cancelled) return;

      const cached = await cacheGetJson<CachedSkillsDashboard>(
        cacheKey(["skills-dashboard", userId])
      );
      if (!cached || cancelled) return;

      setState((prev) =>
        prev.loading
          ? {
            ...prev,
            loading: false,
            userId,
            cards: cached.cards,
            nextRecommendation: cached.nextRecommendation,
            recentMilestones: cached.recentMilestones,
            summary: cached.summary,
          }
          : prev
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const buildState = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    const commit = (updater: (prev: DashboardState) => DashboardState) => {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setState(updater);
    };

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      commit((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        summary: emptySummary(),
        cards: [],
        nextRecommendation: null,
        recentMilestones: [],
        userId: null,
      }));
      return;
    }

    const userId = user.id;
    const weekStart = getStartOfWeekDate();

    const [skillsRes, stagesRes, userSkillsRes, logsRes, milestonesRes] =
      await Promise.all([
        supabase.from("skills").select("*").eq("is_active", true).order("name"),
        supabase
          .from("skill_stages")
          .select("*")
          .order("skill_id")
          .order("order_index"),
        supabase
          .from("user_skills")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("skill_logs")
          .select("*")
          .eq("user_id", userId)
          .order("logged_at", { ascending: false }),
        supabase
          .from("user_skill_milestones")
          .select("*")
          .eq("user_id", userId)
          .order("achieved_at", { ascending: false }),
      ]);

    if (
      skillsRes.error ||
      stagesRes.error ||
      userSkillsRes.error ||
      logsRes.error ||
      milestonesRes.error
    ) {
      commit((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
      }));
      return;
    }

    const skills = (skillsRes.data ?? []) as Skill[];
    const stages = (stagesRes.data ?? []) as SkillStage[];
    const userSkills = (userSkillsRes.data ?? []) as UserSkill[];
    const logs = (logsRes.data ?? []) as SkillLog[];
    const milestones = (milestonesRes.data ?? []) as UserSkillMilestone[];

    const skillMap = new Map(skills.map((skill) => [skill.id, skill]));
    const stageMap = new Map(stages.map((stage) => [stage.id, stage]));
    const skillMetricTypeById = new Map(skills.map((skill) => [skill.id, skill.metric_type]));
    const { logsByUserSkillId, bestLogByUserSkillId } = buildLogMaps(logs, skillMetricTypeById);
    const milestoneCountsByUserSkillId = buildMilestoneCountMap(milestones);

    const cards = userSkills
      .map((userSkill): SkillDashboardCard | null => {
        const skill = skillMap.get(userSkill.skill_id);
        if (!skill) return null;

        const currentStage = userSkill.current_stage_id
          ? stageMap.get(userSkill.current_stage_id) ?? null
          : null;

        const latestLog = logsByUserSkillId.get(userSkill.id)?.[0] ?? null;
        const bestLog = bestLogByUserSkillId.get(userSkill.id) ?? null;

        return {
          skill,
          userSkill,
          currentStage,
          latestLog,
          bestLog,
          progressPercent: getSkillProgress({
            metricType: skill.metric_type,
            currentStage,
            bestLog,
          }),
          highlightText: getSkillHighlight({
            metricType: skill.metric_type,
            latestLog,
            bestLog,
            currentStage,
          }),
          isNewBest: Boolean(latestLog && bestLog && latestLog.id === bestLog.id),
        };
      })
      .filter(isSkillDashboardCard)
      .sort(sortCards);

    const activeCards = cards.filter(
      (item) =>
        normalizeSkillStatus(item.userSkill.status) === SKILL_STATUS.ACTIVE
    );

    const weeklyLogs = logs.filter((log) => log.logged_at >= weekStart);
    const streak = getSkillStreak(logs);

    const recentMilestones: RecentMilestone[] = milestones
      .slice(0, 6)
      .map((milestone) => {
        const skill = skillMap.get(milestone.skill_id);
        const stage = stageMap.get(milestone.stage_id);

        return {
          id: milestone.id,
          skillName: skill?.name ?? "Skill",
          stageName: stage?.name ?? "Stage",
        };
      });

    const nextRecommendation =
      [...activeCards].sort((a, b) => {
        const aLast = getSafeTime(
          a.userSkill.last_logged_at ?? a.userSkill.created_at
        );
        const bLast = getSafeTime(
          b.userSkill.last_logged_at ?? b.userSkill.created_at
        );

        const stalenessDelta = aLast - bLast;
        if (stalenessDelta !== 0) return stalenessDelta;

        if (a.progressPercent !== b.progressPercent) {
          return a.progressPercent - b.progressPercent;
        }

        const aMilestones = milestoneCountsByUserSkillId.get(a.userSkill.id) ?? 0;
        const bMilestones = milestoneCountsByUserSkillId.get(b.userSkill.id) ?? 0;

        return aMilestones - bMilestones;
      })[0] ?? null;

    const summary: SkillsDashboardSummary = {
      activeSkills: activeCards.length,
      sessionsThisWeek: weeklyLogs.length,
      streakDays: streak.currentStreak,
      completedMilestones: milestones.length,
    };

    commit((prev) => ({
      ...prev,
      loading: false,
      refreshing: false,
      userId,
      cards,
      nextRecommendation,
      recentMilestones,
      summary,
    }));

    void cacheSetJson<CachedSkillsDashboard>(cacheKey(["skills-dashboard", userId]), {
      cards,
      nextRecommendation,
      recentMilestones,
      summary,
    });
  }, []);

  useEffect(() => {
    void buildState();
  }, [buildState]);

  useEffect(() => {
    const unsubscribe = subscribeSkillsDashboardChanged(() => {
      void buildState();
    });

    return () => {
      unsubscribe();
    };
  }, [buildState]);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, refreshing: true }));
    await buildState();
  }, [buildState]);

  const setStatusFilter = useCallback((statusFilter: SkillStatusFilter) => {
    setState((prev) => ({ ...prev, statusFilter }));
  }, []);

  const filteredCards = useMemo(() => {
    if (state.statusFilter === "all") return state.cards;

    if (state.statusFilter === "mastered") {
      return state.cards.filter(
        (card) =>
          normalizeSkillStatus(card.userSkill.status) === SKILL_STATUS.MASTERED
      );
    }

    return state.cards.filter(
      (card) =>
        normalizeSkillStatus(card.userSkill.status) === state.statusFilter
    );
  }, [state.cards, state.statusFilter]);

  return {
    ...state,
    cards: filteredCards,
    rawCards: state.cards,
    refresh,
    setStatusFilter,
  };
}
