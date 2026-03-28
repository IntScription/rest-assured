import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Skill,
  SkillLog,
  SkillStage,
  UserSkill,
} from "@/src/features/skills/types";
import { supabase } from "@/src/lib/supabase";

export type SkillMilestoneRow = {
  id: string;
  stage_id: string;
  achieved_at: string;
  best_value: number | null;
  note: string | null;
};

export type SkillResourceRow = {
  id: string;
  title: string;
  resource_type: string;
  url: string | null;
  description: string | null;
  order_index: number;
};

type UseSkillDetailState = {
  loading: boolean;
  userId: string | null;
  skill: Skill | null;
  userSkill: UserSkill | null;
  stages: SkillStage[];
  logs: SkillLog[];
  milestones: SkillMilestoneRow[];
  resources: SkillResourceRow[];
};

export function useSkillDetail(skillId?: string) {
  const [state, setState] = useState<UseSkillDetailState>({
    loading: true,
    userId: null,
    skill: null,
    userSkill: null,
    stages: [],
    logs: [],
    milestones: [],
    resources: [],
  });

  const load = useCallback(async () => {
    if (!skillId) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setState({
        loading: false,
        userId: null,
        skill: null,
        userSkill: null,
        stages: [],
        logs: [],
        milestones: [],
        resources: [],
      });
      return;
    }

    const [skillRes, userSkillRes, stagesRes, logsRes, milestonesRes, resourcesRes] =
      await Promise.all([
        supabase.from("skills").select("*").eq("id", skillId).maybeSingle(),
        supabase
          .from("user_skills")
          .select("*")
          .eq("user_id", user.id)
          .eq("skill_id", skillId)
          .maybeSingle(),
        supabase
          .from("skill_stages")
          .select("*")
          .eq("skill_id", skillId)
          .order("order_index", { ascending: true }),
        supabase
          .from("skill_logs")
          .select("*")
          .eq("user_id", user.id)
          .eq("skill_id", skillId)
          .order("logged_at", { ascending: false }),
        supabase
          .from("user_skill_milestones")
          .select("*")
          .eq("user_id", user.id)
          .eq("skill_id", skillId)
          .order("achieved_at", { ascending: false }),
        supabase
          .from("skill_resources")
          .select("*")
          .eq("skill_id", skillId)
          .eq("is_active", true)
          .order("order_index", { ascending: true }),
      ]);

    setState({
      loading: false,
      userId: user.id,
      skill: (skillRes.data as Skill | null) ?? null,
      userSkill: (userSkillRes.data as UserSkill | null) ?? null,
      stages: (stagesRes.data ?? []) as SkillStage[],
      logs: (logsRes.data ?? []) as SkillLog[],
      milestones: (milestonesRes.data ?? []) as SkillMilestoneRow[],
      resources: (resourcesRes.data ?? []) as SkillResourceRow[],
    });
  }, [skillId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentStage = useMemo(() => {
    if (!state.userSkill?.current_stage_id) return null;
    return state.stages.find((s) => s.id === state.userSkill?.current_stage_id) ?? null;
  }, [state.stages, state.userSkill?.current_stage_id]);

  const currentStageIndex = useMemo(() => {
    if (!currentStage) return -1;
    return state.stages.findIndex((s) => s.id === currentStage.id);
  }, [state.stages, currentStage]);

  const bestLog = useMemo(() => {
    if (state.logs.length === 0) return null;
    return [...state.logs].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))[0];
  }, [state.logs]);

  const latestLog = state.logs[0] ?? null;

  return {
    ...state,
    currentStage,
    currentStageIndex,
    bestLog,
    latestLog,
    refresh: load,
    setState,
  };
}
