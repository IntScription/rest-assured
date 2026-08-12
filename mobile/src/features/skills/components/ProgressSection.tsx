import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import SkillGridCard from "@/src/features/skills/components/SkillGridCard";
import {
  SKILL_STATUS,
  type SkillDbStatus,
} from "@/src/features/skills/constants";
import { useAchievementUnlocks } from "@/src/features/skills/hooks/useAchievementUnlocks";
import { useSkillsDashboard } from "@/src/features/skills/hooks/useSkillsDashboard";
import {
  emitSkillChallengesChanged,
  emitSkillsDashboardChanged,
  syncSkillAchievementsForUserWithResult,
  syncSkillChallengesForUser,
} from "@/src/features/skills/services";
import type {
  Skill,
  SkillDashboardCard,
  SkillMetricType,
  UserSkillStatus,
} from "@/src/features/skills/types";
import { updateSkillStatus } from "@/src/features/skills/utils/update-skill-status";
import { setSkillRoutePreview } from "@/src/features/skills/utils/skillRouteCache";
import {
  getSkillStatusSync,
  publishSkillStatusSync,
  subscribeSkillStatusSync,
} from "@/src/features/skills/utils/skill-status-sync";
import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { useCustomTabBarBottomPadding } from "@/components/navigation/CustomTabBar";

type SummaryCardProps = {
  label: string;
  value: string;
  textColor: string;
  mutedTextColor: string;
  cardColor: string;
  borderColor: string;
};

type CreateSkillDraft = {
  name: string;
  category: string;
  difficulty: string;
  metricType: SkillMetricType;
  shortDescription: string;
};

type SortOption = "favorites" | "recent" | "progress" | "name" | "status";

function SummaryCard({
  label,
  value,
  textColor,
  mutedTextColor,
  cardColor,
  borderColor,
}: SummaryCardProps) {
  return (
    <View
      style={[
        styles.summaryCard,
        {
          backgroundColor: cardColor,
          borderColor,
        },
      ]}
    >
      <Text style={[styles.summaryValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: mutedTextColor }]}>
        {label}
      </Text>
    </View>
  );
}

function SkeletonCard({
  width,
  t,
}: {
  width: number;
  t: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View
      style={[
        styles.skeletonCard,
        {
          width,
          backgroundColor: t.card,
          borderColor: t.border,
        },
      ]}
    >
      <View
        style={[
          styles.skeletonLineSm,
          { backgroundColor: t.cardAlt, width: "42%" },
        ]}
      />
      <View
        style={[
          styles.skeletonLineLg,
          { backgroundColor: t.cardAlt, width: "78%" },
        ]}
      />
      <View
        style={[
          styles.skeletonLineSm,
          { backgroundColor: t.cardAlt, width: "58%" },
        ]}
      />
      <View
        style={[styles.skeletonProgress, { backgroundColor: t.cardAlt }]}
      />
      <View
        style={[
          styles.skeletonLineSm,
          { backgroundColor: t.cardAlt, width: "36%" },
        ]}
      />
    </View>
  );
}

function normalizeSkillStatus(
  status: UserSkillStatus | SkillDbStatus | null | undefined
): SkillDbStatus {
  if (status === SKILL_STATUS.ACTIVE || status === SKILL_STATUS.PAUSED) {
    return status;
  }

  return SKILL_STATUS.MASTERED;
}

function getStatusDisplayLabel(status: SkillDbStatus) {
  switch (status) {
    case SKILL_STATUS.ACTIVE:
      return "In Progress";
    case SKILL_STATUS.PAUSED:
      return "Paused";
    case SKILL_STATUS.MASTERED:
      return "Complete";
    default:
      return "In Progress";
  }
}

type QuickActionConfig = {
  status: SkillDbStatus;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function getQuickActionsForStatus(status: SkillDbStatus): QuickActionConfig[] {
  if (status === SKILL_STATUS.MASTERED) {
    return [
      {
        status: SKILL_STATUS.ACTIVE,
        title: "Mark In Progress",
        subtitle: "Reopen this skill and move it back into your active list.",
        icon: "refresh",
      },
    ];
  }

  if (status === SKILL_STATUS.PAUSED) {
    return [
      {
        status: SKILL_STATUS.ACTIVE,
        title: "Resume Skill",
        subtitle: "Bring this skill back into active work.",
        icon: "play",
      },
      {
        status: SKILL_STATUS.MASTERED,
        title: "Mark Complete",
        subtitle: "Finish this skill and keep it in your completed list.",
        icon: "checkmark-done-outline",
      },
    ];
  }

  return [
    {
      status: SKILL_STATUS.PAUSED,
      title: "Pause Skill",
      subtitle: "Pause progress for now without losing your data.",
      icon: "pause",
    },
    {
      status: SKILL_STATUS.MASTERED,
      title: "Mark Complete",
      subtitle: "Finish this skill now and move it into completed.",
      icon: "checkmark-done-outline",
    },
  ];
}

function getSafeTime(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getSortRank(status: SkillDbStatus) {
  switch (status) {
    case SKILL_STATUS.ACTIVE:
      return 0;
    case SKILL_STATUS.PAUSED:
      return 1;
    case SKILL_STATUS.MASTERED:
      return 2;
    default:
      return 3;
  }
}

function getSortMeta(sortBy: SortOption) {
  switch (sortBy) {
    case "favorites":
      return {
        label: "Pinned first",
        heading: "Pinned Skills",
        description:
          "Favorite skills stay at the top, followed by progress and name.",
      };
    case "recent":
      return {
        label: "Recently active",
        heading: "Recently Active",
        description:
          "Skills with the latest activity appear first for quick continuation.",
      };
    case "progress":
      return {
        label: "Highest progress",
        heading: "Progress Leaders",
        description:
          "Skills nearest to completion appear first so your strongest work stays visible.",
      };
    case "name":
      return {
        label: "Alphabetical",
        heading: "All Skills A–Z",
        description:
          "Everything is arranged alphabetically for the cleanest browsing.",
      };
    case "status":
      return {
        label: "By status",
        heading: "Grouped by Status",
        description:
          "In-progress skills appear first, then paused, then completed.",
      };
    default:
      return {
        label: "Pinned first",
        heading: "Pinned Skills",
        description:
          "Favorite skills stay at the top, followed by progress and name.",
      };
  }
}

function getSectionBackground(
  t: ReturnType<typeof useAppTheme>,
  tone: "progress" | "explore" | "challenges"
) {
  const palettes = {
    progress: {
      light: "#EEF4FF",
      dark: "#07172B",
    },
    explore: {
      light: "#ECFDF5",
      dark: "#052017",
    },
    challenges: {
      light: "#FFF4E6",
      dark: "#211407",
    },
  } as const;

  const raw = String(t.background ?? "").trim();
  const hex = raw.replace("#", "");

  let isDark = false;

  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    isDark = luminance < 0.5;
  } else if (raw.toLowerCase().includes("rgb")) {
    const nums = raw.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    if (nums.length >= 3) {
      const [r, g, b] = nums;
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      isDark = luminance < 0.5;
    }
  }

  return isDark ? palettes[tone].dark : palettes[tone].light;
}

export default function ProgressSection() {
  const t = useAppTheme();
  const sectionBackground = getSectionBackground(t, "progress");
  const tabBottomPadding = useCustomTabBarBottomPadding(20);
  const router = useRouter();
  const { width } = useWindowDimensions();

  const {
    loading,
    refreshing,
    summary,
    cards,
    rawCards,
    nextRecommendation,
    recentMilestones,
    refresh,
    userId,
  } = useSkillsDashboard();

  const [showStartSkillModal, setShowStartSkillModal] = useState(false);
  const [showCreateSkillModal, setShowCreateSkillModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);

  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [allActiveSkills, setAllActiveSkills] = useState<Skill[]>([]);
  const [loadingAvailableSkills, setLoadingAvailableSkills] = useState(false);
  const [startBusySkillId, setStartBusySkillId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] =
    useState<SkillDashboardCard | null>(null);
  const [statusBusy, setStatusBusy] = useState<SkillDbStatus | null>(null);
  const [creatingSkill, setCreatingSkill] = useState(false);

  const [sortBy, setSortBy] = useState<SortOption>("favorites");

  const [optimisticStatuses, setOptimisticStatuses] = useState<
    Record<string, SkillDbStatus>
  >({});
  const [pendingCardIds, setPendingCardIds] = useState<
    Record<string, boolean>
  >({});
  const [swipeResetNonce, setSwipeResetNonce] = useState(0);

  const [createDraft, setCreateDraft] = useState<CreateSkillDraft>({
    name: "",
    category: "general",
    difficulty: "beginner",
    metricType: "seconds",
    shortDescription: "",
  });

  const { toast, showToast, animatedStyle } = useAchievementUnlocks();

  const quickActionsTranslateY = useRef(new Animated.Value(22)).current;
  const quickActionsScale = useRef(new Animated.Value(0.985)).current;
  const quickActionsOverlayOpacity = useRef(new Animated.Value(0)).current;
  const quickActionsContentOpacity = useRef(new Animated.Value(0)).current;

  const animateQuickActionsOpen = useCallback(() => {
    quickActionsTranslateY.setValue(22);
    quickActionsScale.setValue(0.985);
    quickActionsOverlayOpacity.setValue(0);
    quickActionsContentOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(quickActionsTranslateY, {
        toValue: 0,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(quickActionsScale, {
        toValue: 1,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(quickActionsOverlayOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(quickActionsContentOpacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    quickActionsContentOpacity,
    quickActionsOverlayOpacity,
    quickActionsScale,
    quickActionsTranslateY,
  ]);

  useEffect(() => {
    if (selectedCard) {
      animateQuickActionsOpen();
    }
  }, [animateQuickActionsOpen, selectedCard]);

  const closeQuickActionsSheet = useCallback(
    (afterClose?: () => void) => {
      Animated.parallel([
        Animated.timing(quickActionsTranslateY, {
          toValue: 18,
          duration: 130,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(quickActionsScale, {
          toValue: 0.985,
          duration: 130,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(quickActionsOverlayOpacity, {
          toValue: 0,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(quickActionsContentOpacity, {
          toValue: 0,
          duration: 100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setSelectedCard(null);
        afterClose?.();
      });
    },
    [
      quickActionsContentOpacity,
      quickActionsOverlayOpacity,
      quickActionsScale,
      quickActionsTranslateY,
    ]
  );

  const numColumns = width >= 900 ? 3 : 2;
  const cardGap = 12;
  const horizontalPadding = 16;

  const trackedSkillIds = useMemo(
    () => new Set(rawCards.map((item) => item.skill.id)),
    [rawCards]
  );

  const cardWidth = useMemo(() => {
    const totalGap = cardGap * (numColumns - 1);
    const available = width - horizontalPadding * 2 - totalGap;
    return available / numColumns;
  }, [width, numColumns]);

  const sortMeta = useMemo(() => getSortMeta(sortBy), [sortBy]);

  const getEffectiveStatus = (card: SkillDashboardCard): SkillDbStatus => {
    const syncedStatus = getSkillStatusSync(card.userSkill.id);

    return (
      optimisticStatuses[card.userSkill.id] ??
      syncedStatus ??
      normalizeSkillStatus(card.userSkill.status)
    );
  };

  const openSkillDetail = (card: SkillDashboardCard) => {
    setSkillRoutePreview(card);
    router.push({
      pathname: "/skills/[skillId]",
      params: {
        skillId: card.skill.id,
        userSkillId: card.userSkill.id,
        initialStatus: getEffectiveStatus(card),
      },
    });
  };

  const bumpSwipeReset = useCallback(() => {
    setSwipeResetNonce((prev) => prev + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      bumpSwipeReset();
    }, [bumpSwipeReset])
  );

  useEffect(() => {
    return subscribeSkillStatusSync(({ userSkillId, status }) => {
      setOptimisticStatuses((prev) => {
        if (prev[userSkillId] === status) return prev;
        return { ...prev, [userSkillId]: status };
      });
    });
  }, []);

  const syncSystemsAndNotify = async () => {
    if (!userId) return;

    const [, newlyUnlocked] = await Promise.all([
      syncSkillChallengesForUser(userId),
      syncSkillAchievementsForUserWithResult(userId),
    ]);

    emitSkillChallengesChanged();
    emitSkillsDashboardChanged();

    if (newlyUnlocked.length > 0) {
      showToast({
        id: newlyUnlocked[0].definition.id,
        name: newlyUnlocked[0].definition.name,
      });
    }
  };

  useEffect(() => {
    if (!showStartSkillModal || !userId) return;

    let cancelled = false;

    const loadAvailableSkills = async () => {
      try {
        setLoadingAvailableSkills(true);

        const { data, error } = await supabase
          .from("skills")
          .select("*")
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        if (cancelled) return;

        const allSkills = (data ?? []) as Skill[];
        const next = allSkills.filter((skill) => !trackedSkillIds.has(skill.id));

        setAllActiveSkills(allSkills);
        setAvailableSkills(next);
      } catch (err: any) {
        if (!cancelled) {
          setAllActiveSkills([]);
          setAvailableSkills([]);
          Alert.alert(
            "Could not load skills",
            err?.message ?? "Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAvailableSkills(false);
        }
      }
    };

    void loadAvailableSkills();

    return () => {
      cancelled = true;
    };
  }, [showStartSkillModal, userId, trackedSkillIds]);

  const mergedCards = useMemo(() => {
    return cards.map((card) => {
      const overriddenStatus = optimisticStatuses[card.userSkill.id];
      if (overriddenStatus === undefined) return card;

      return {
        ...card,
        userSkill: {
          ...card.userSkill,
          status: overriddenStatus as UserSkillStatus,
        },
      };
    });
  }, [cards, optimisticStatuses]);

  const pinnedFavorites = useMemo(() => {
    return mergedCards.filter((card) => !!card.userSkill.is_favorite).slice(0, 6);
  }, [mergedCards]);

  const sortedCards = useMemo(() => {
    const list = [...mergedCards];

    list.sort((a, b) => {
      if (sortBy === "favorites") {
        const favoriteDelta =
          Number(b.userSkill.is_favorite) - Number(a.userSkill.is_favorite);
        if (favoriteDelta !== 0) return favoriteDelta;

        if (b.progressPercent !== a.progressPercent) {
          return b.progressPercent - a.progressPercent;
        }

        return a.skill.name.localeCompare(b.skill.name);
      }

      if (sortBy === "progress") {
        if (b.progressPercent !== a.progressPercent) {
          return b.progressPercent - a.progressPercent;
        }

        const favoriteDelta =
          Number(b.userSkill.is_favorite) - Number(a.userSkill.is_favorite);
        if (favoriteDelta !== 0) return favoriteDelta;

        return a.skill.name.localeCompare(b.skill.name);
      }

      if (sortBy === "name") {
        const nameDelta = a.skill.name.localeCompare(b.skill.name);
        if (nameDelta !== 0) return nameDelta;

        return (
          getSafeTime(b.userSkill.last_logged_at) -
          getSafeTime(a.userSkill.last_logged_at)
        );
      }

      if (sortBy === "status") {
        const statusDelta =
          getSortRank(normalizeSkillStatus(a.userSkill.status)) -
          getSortRank(normalizeSkillStatus(b.userSkill.status));
        if (statusDelta !== 0) return statusDelta;

        const favoriteDelta =
          Number(b.userSkill.is_favorite) - Number(a.userSkill.is_favorite);
        if (favoriteDelta !== 0) return favoriteDelta;

        return a.skill.name.localeCompare(b.skill.name);
      }

      return (
        getSafeTime(b.userSkill.last_logged_at) -
        getSafeTime(a.userSkill.last_logged_at)
      );
    });

    return list;
  }, [mergedCards, sortBy]);

  const topSortedCard = sortedCards[0] ?? null;

  const commitStatusChange = async (
    userSkillId: string,
    nextStatus: SkillDbStatus,
    previousStatus: SkillDbStatus
  ) => {
    try {
      publishSkillStatusSync({ userSkillId, status: nextStatus });
      await updateSkillStatus({ userSkillId, status: nextStatus });
      await syncSystemsAndNotify();
      await refresh();
    } catch (err: any) {
      publishSkillStatusSync({ userSkillId, status: previousStatus });
      setOptimisticStatuses((prev) => ({
        ...prev,
        [userSkillId]: previousStatus,
      }));

      Alert.alert(
        "Could not update status",
        err?.message ?? "Please try again."
      );
    } finally {
      setPendingCardIds((prev) => {
        const next = { ...prev };
        delete next[userSkillId];
        return next;
      });
      bumpSwipeReset();
    }
  };

  const handleStartSkill = async (skill: Skill) => {
    if (!userId) return;

    try {
      setStartBusySkillId(skill.id);

      const { data: firstStageData, error: stageError } = await supabase
        .from("skill_stages")
        .select("id")
        .eq("skill_id", skill.id)
        .order("order_index", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (stageError) throw stageError;

      const { error } = await supabase.from("user_skills").insert({
        user_id: userId,
        skill_id: skill.id,
        current_stage_id: firstStageData?.id ?? null,
        status: SKILL_STATUS.ACTIVE,
        is_favorite: false,
      });

      if (error) throw error;

      setAvailableSkills((prev) => prev.filter((item) => item.id !== skill.id));
      setShowStartSkillModal(false);
      await syncSystemsAndNotify();
      await refresh();
    } catch (err: any) {
      Alert.alert("Could not start skill", err?.message ?? "Please try again.");
    } finally {
      setStartBusySkillId(null);
    }
  };

  const handleCreateSkill = async () => {
    if (!userId) return;

    if (!createDraft.name.trim()) {
      Alert.alert("Name required", "Please enter a skill name.");
      return;
    }

    try {
      setCreatingSkill(true);

      const slugBase = createDraft.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const slug = `${slugBase}-${Date.now().toString().slice(-6)}`;

      const { data: createdSkill, error: createSkillError } = await supabase
        .from("skills")
        .insert({
          slug,
          name: createDraft.name.trim(),
          category: createDraft.category.trim() || "general",
          difficulty: createDraft.difficulty.trim() || "beginner",
          metric_type: createDraft.metricType,
          short_description: createDraft.shortDescription.trim() || null,
          is_active: true,
          is_custom: true,
          created_by_user_id: userId,
        } as any)
        .select("*")
        .single();

      if (createSkillError) throw createSkillError;

      const { error: createUserSkillError } = await supabase
        .from("user_skills")
        .insert({
          user_id: userId,
          skill_id: createdSkill.id,
          current_stage_id: null,
          status: SKILL_STATUS.ACTIVE,
          is_favorite: false,
        });

      if (createUserSkillError) throw createUserSkillError;

      setCreateDraft({
        name: "",
        category: "general",
        difficulty: "beginner",
        metricType: "seconds",
        shortDescription: "",
      });

      setShowCreateSkillModal(false);
      setShowStartSkillModal(false);

      await syncSystemsAndNotify();
      await refresh();
    } catch (err: any) {
      Alert.alert("Could not create skill", err?.message ?? "Please try again.");
    } finally {
      setCreatingSkill(false);
    }
  };

  const handleGridStatusChange = async (status: SkillDbStatus) => {
    if (!selectedCard) return;

    const userSkillId = selectedCard.userSkill.id;
    const previousStatus = getEffectiveStatus(selectedCard);

    if (previousStatus === status || pendingCardIds[userSkillId]) {
      closeQuickActionsSheet();
      return;
    }

    closeQuickActionsSheet();
    setStatusBusy(status);
    setPendingCardIds((prev) => ({ ...prev, [userSkillId]: true }));
    publishSkillStatusSync({ userSkillId, status });
    setOptimisticStatuses((prev) => ({ ...prev, [userSkillId]: status }));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await commitStatusChange(userSkillId, status, previousStatus);
    setStatusBusy(null);
  };

  const handleSwipeStatusChange = async (
    card: SkillDashboardCard,
    status: SkillDbStatus
  ) => {
    const userSkillId = card.userSkill.id;
    const currentStatus = getEffectiveStatus(card);

    if (currentStatus === status || pendingCardIds[userSkillId]) return;

    setPendingCardIds((prev) => ({ ...prev, [userSkillId]: true }));
    publishSkillStatusSync({ userSkillId, status });
    setOptimisticStatuses((prev) => ({ ...prev, [userSkillId]: status }));
    bumpSwipeReset();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await commitStatusChange(userSkillId, status, currentStatus);
  };

  useEffect(() => {
    setOptimisticStatuses((prev) => {
      if (Object.keys(prev).length === 0) return prev;

      const rawCardStatusMap = new Map(
        rawCards.map((card) => [
          card.userSkill.id,
          normalizeSkillStatus(card.userSkill.status),
        ])
      );

      const next: Record<string, SkillDbStatus> = {};

      for (const [userSkillId, optimisticStatus] of Object.entries(prev)) {
        const actualStatus = rawCardStatusMap.get(userSkillId);

        if (actualStatus !== undefined && actualStatus !== optimisticStatus) {
          next[userSkillId] = optimisticStatus;
        }
      }

      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [rawCards]);

  const renderStartSkillEmptyState = () => {
    if (loadingAvailableSkills) {
      return (
        <View style={styles.noSkillsStateWrap}>
          <ActivityIndicator size="small" color={t.text} />
          <Text style={[styles.noSkillsText, { color: t.mutedText }]}>
            Loading available skills...
          </Text>
        </View>
      );
    }

    if (allActiveSkills.length === 0) {
      return (
        <View
          style={[
            styles.noSkillsCard,
            { backgroundColor: t.cardAlt, borderColor: t.border },
          ]}
        >
          <Text style={[styles.noSkillsTitle, { color: t.text }]}>
            No skills have been added yet
          </Text>
          <Text style={[styles.noSkillsText, { color: t.mutedText }]}>
            Add your first custom skill to start tracking progress.
          </Text>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => {
              setShowStartSkillModal(false);
              setShowCreateSkillModal(true);
            }}
            style={[styles.createFromEmptyButton, { backgroundColor: t.link }]}
          >
            <Text style={styles.createFromEmptyButtonText}>Add Skill</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.noSkillsCard,
          { backgroundColor: t.cardAlt, borderColor: t.border },
        ]}
      >
        <Text style={[styles.noSkillsTitle, { color: t.text }]}>
          You are already tracking all available skills
        </Text>
        <Text style={[styles.noSkillsText, { color: t.mutedText }]}>
          Add a custom skill if you want to track something new.
        </Text>

        <TouchableOpacity
          activeOpacity={0.86}
          onPress={() => {
            setShowStartSkillModal(false);
            setShowCreateSkillModal(true);
          }}
          style={[styles.createFromEmptyButton, { backgroundColor: t.link }]}
        >
          <Text style={styles.createFromEmptyButtonText}>Add Skill</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: sectionBackground }]}>
        <View style={[styles.content, { paddingBottom: tabBottomPadding }]}>
          <View
            style={[
              styles.dashboardCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <View style={styles.summaryGrid}>
              <SummaryCard
                label="In Progress"
                value="—"
                textColor={t.text}
                mutedTextColor={t.mutedText}
                cardColor={t.cardAlt}
                borderColor={t.border}
              />
              <SummaryCard
                label="This Week"
                value="—"
                textColor={t.text}
                mutedTextColor={t.mutedText}
                cardColor={t.cardAlt}
                borderColor={t.border}
              />
              <SummaryCard
                label="Streak"
                value="—"
                textColor={t.text}
                mutedTextColor={t.mutedText}
                cardColor={t.cardAlt}
                borderColor={t.border}
              />
              <SummaryCard
                label="Milestones"
                value="—"
                textColor={t.text}
                mutedTextColor={t.mutedText}
                cardColor={t.cardAlt}
                borderColor={t.border}
              />
            </View>

            <View style={styles.actionGrid}>
              <View
                style={[
                  styles.skeletonAction,
                  { backgroundColor: t.cardAlt, borderColor: t.border },
                ]}
              />
              <View
                style={[
                  styles.skeletonAction,
                  { backgroundColor: t.cardAlt, borderColor: t.border },
                ]}
              />
              <View
                style={[
                  styles.skeletonAction,
                  { backgroundColor: t.cardAlt, borderColor: t.border },
                ]}
              />
              <View
                style={[
                  styles.skeletonAction,
                  { backgroundColor: t.cardAlt, borderColor: t.border },
                ]}
              />
            </View>
          </View>

          <View style={styles.skeletonGrid}>
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={index} width={cardWidth} t={t} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: sectionBackground }]}>
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.toastWrap, animatedStyle]}
        >
          <View
            style={[
              styles.toastCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Ionicons name="trophy" size={18} color={t.text} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.toastTitle, { color: t.text }]}>
                Achievement Unlocked
              </Text>
              <Text style={[styles.toastBody, { color: t.mutedText }]}>
                {toast.name}
              </Text>
            </View>
          </View>
        </Animated.View>
      ) : null}

      <FlatList
        data={sortedCards}
        key={numColumns}
        numColumns={numColumns}
        keyExtractor={(item) => item.userSkill.id}
        contentContainerStyle={[styles.content, { paddingBottom: tabBottomPadding }]}
        columnWrapperStyle={numColumns > 1 ? { gap: cardGap } : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View
              style={[
                styles.dashboardCard,
                { backgroundColor: t.card, borderColor: t.border },
              ]}
            >
              <View style={styles.summaryGrid}>
                <SummaryCard
                  label="In Progress"
                  value={String(summary.activeSkills)}
                  textColor={t.text}
                  mutedTextColor={t.mutedText}
                  cardColor={t.cardAlt}
                  borderColor={t.border}
                />
                <SummaryCard
                  label="This Week"
                  value={String(summary.sessionsThisWeek)}
                  textColor={t.text}
                  mutedTextColor={t.mutedText}
                  cardColor={t.cardAlt}
                  borderColor={t.border}
                />
                <SummaryCard
                  label="Streak"
                  value={`${summary.streakDays}d`}
                  textColor={t.text}
                  mutedTextColor={t.mutedText}
                  cardColor={t.cardAlt}
                  borderColor={t.border}
                />
                <SummaryCard
                  label="Milestones"
                  value={String(summary.completedMilestones)}
                  textColor={t.text}
                  mutedTextColor={t.mutedText}
                  cardColor={t.cardAlt}
                  borderColor={t.border}
                />
              </View>

              <View style={styles.actionGrid}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => setShowStartSkillModal(true)}
                  style={[
                    styles.primaryActionCard,
                    { backgroundColor: t.link },
                  ]}
                >
                  <Ionicons name="add" size={18} color="white" />
                  <Text style={styles.primaryActionCardText}>Start Skill</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => setShowCreateSkillModal(true)}
                  style={[
                    styles.secondaryActionCard,
                    { backgroundColor: t.cardAlt, borderColor: t.border },
                  ]}
                >
                  <Ionicons name="create-outline" size={18} color={t.text} />
                  <Text
                    style={[styles.secondaryActionCardText, { color: t.text }]}
                  >
                    Add Skill
                  </Text>
                </TouchableOpacity>

                {nextRecommendation ? (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => openSkillDetail(nextRecommendation)}
                    style={[
                      styles.secondaryActionCard,
                      { backgroundColor: t.cardAlt, borderColor: t.border },
                    ]}
                  >
                    <Ionicons name="play-outline" size={18} color={t.text} />
                    <Text
                      style={[
                        styles.secondaryActionCardText,
                        { color: t.text },
                      ]}
                    >
                      Resume Skill
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => setShowSortModal(true)}
                  style={[
                    styles.secondaryActionCard,
                    { backgroundColor: t.cardAlt, borderColor: t.border },
                  ]}
                >
                  <Ionicons
                    name="swap-vertical-outline"
                    size={18}
                    color={t.text}
                  />
                  <Text
                    style={[styles.secondaryActionCardText, { color: t.text }]}
                  >
                    Sort Skills
                  </Text>
                </TouchableOpacity>
              </View>

              {pinnedFavorites.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.favoriteStrip}
                >
                  {pinnedFavorites.map((item) => (
                    <TouchableOpacity
                      key={item.userSkill.id}
                      activeOpacity={0.88}
                      onPress={() =>
                        router.push({
                          pathname: "/skills/[skillId]",
                          params: { skillId: item.skill.id },
                        })
                      }
                      style={[
                        styles.favoritePill,
                        { backgroundColor: t.cardAlt, borderColor: t.border },
                      ]}
                    >
                      <Ionicons name="star" size={14} color={t.link} />
                      <Text
                        style={[styles.favoritePillText, { color: t.text }]}
                        numberOfLines={1}
                      >
                        {item.skill.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}

              {recentMilestones.length > 0 ? (
                <View
                  style={[
                    styles.milestonePanel,
                    { backgroundColor: t.cardAlt, borderColor: t.border },
                  ]}
                >
                  <Text style={[styles.milestonePanelLabel, { color: t.text }]}>
                    Recent milestones
                  </Text>
                  <Text
                    style={[styles.milestonePanelBody, { color: t.mutedText }]}
                    numberOfLines={2}
                  >
                    {recentMilestones
                      .slice(0, 2)
                      .map((item) => `${item.skillName}: ${item.stageName}`)
                      .join(" • ")}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: t.text }]}>
                  {sortMeta.heading}
                </Text>
                <Text
                  style={[styles.sectionDescription, { color: t.mutedText }]}
                >
                  {sortMeta.description}
                </Text>
              </View>
            </View>

            {topSortedCard ? (
              <View
                style={[
                  styles.contextCard,
                  { backgroundColor: t.card, borderColor: t.border },
                ]}
              >
                <View style={styles.contextCardTop}>
                  <Text style={[styles.contextLabel, { color: t.mutedText }]}>
                    Current sort
                  </Text>
                  <View
                    style={[
                      styles.contextBadge,
                      { backgroundColor: t.cardAlt, borderColor: t.border },
                    ]}
                  >
                    <Text style={[styles.contextBadgeText, { color: t.text }]}>
                      {sortMeta.label}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.contextTitle, { color: t.text }]}>
                  {topSortedCard.skill.name}
                </Text>
                <Text
                  style={[styles.contextBody, { color: t.mutedText }]}
                  numberOfLines={2}
                >
                  {topSortedCard.currentStage?.name
                    ? `Current stage: ${topSortedCard.currentStage.name}`
                    : topSortedCard.highlightText}
                </Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ width: cardWidth, marginBottom: cardGap }}>
            <SkillGridCard
              item={item}
              resetKey={`${item.userSkill.id}:${swipeResetNonce}:${getEffectiveStatus(item)}`}
              isBusy={!!pendingCardIds[item.userSkill.id]}
              onPress={() => openSkillDetail(item)}
              onLongPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedCard(item);
              }}
              onQuickStatusChange={(status: SkillDbStatus) =>
                void handleSwipeStatusChange(item, status)
              }
            />
          </View>
        )}
        ListEmptyComponent={
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Ionicons name="sparkles-outline" size={22} color={t.mutedText} />
            <Text style={[styles.emptyTitle, { color: t.text }]}>
              No skills here yet
            </Text>
            <Text style={[styles.emptyBody, { color: t.mutedText }]}>
              Start an existing skill or add your own custom skill to begin
              tracking progress.
            </Text>

            <View style={styles.emptyActionsRow}>
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => setShowStartSkillModal(true)}
                style={[
                  styles.emptyPrimaryAction,
                  { backgroundColor: t.link },
                ]}
              >
                <Text style={styles.emptyActionText}>Start Skill</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => setShowCreateSkillModal(true)}
                style={[
                  styles.emptySecondaryAction,
                  { backgroundColor: t.cardAlt, borderColor: t.border },
                ]}
              >
                <Text style={[styles.emptySecondaryText, { color: t.text }]}>
                  Add Skill
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
      />

      <Modal
        visible={showStartSkillModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStartSkillModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: t.text }]}>Start Skill</Text>
            <Text style={[styles.modalSubtitle, { color: t.mutedText }]}>
              Pick an available skill and start tracking it instantly.
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {availableSkills.map((skill) => (
                <TouchableOpacity
                  key={skill.id}
                  activeOpacity={0.86}
                  disabled={startBusySkillId === skill.id}
                  onPress={() => void handleStartSkill(skill)}
                  style={[
                    styles.skillPickRow,
                    {
                      backgroundColor: t.cardAlt,
                      borderColor: t.border,
                      opacity: startBusySkillId === skill.id ? 0.7 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.skillPickIconWrap,
                      { backgroundColor: sectionBackground },
                    ]}
                  >
                    <Ionicons name="flash-outline" size={18} color={t.text} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.skillPickTitle, { color: t.text }]}>
                      {skill.name}
                    </Text>
                    <Text style={[styles.skillPickBody, { color: t.mutedText }]}>
                      {(skill as any).short_description ||
                        `${(skill as any).category} · ${(skill as any).difficulty}`}
                    </Text>
                  </View>

                  {startBusySkillId === skill.id ? (
                    <ActivityIndicator size="small" color={t.text} />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={t.mutedText}
                    />
                  )}
                </TouchableOpacity>
              ))}

              {availableSkills.length === 0 ? renderStartSkillEmptyState() : null}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setShowStartSkillModal(false)}
              style={[
                styles.modalClose,
                { backgroundColor: t.cardAlt, borderColor: t.border },
              ]}
            >
              <Text style={{ color: t.text, fontWeight: "800" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCreateSkillModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateSkillModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: t.text }]}>Add Skill</Text>
            <Text style={[styles.modalSubtitle, { color: t.mutedText }]}>
              Create a custom skill and start tracking it right away.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                value={createDraft.name}
                onChangeText={(name) =>
                  setCreateDraft((prev) => ({ ...prev, name }))
                }
                placeholder="Skill name"
                placeholderTextColor={t.mutedText}
                style={[
                  styles.input,
                  {
                    color: t.text,
                    backgroundColor: t.background,
                    borderColor: t.border,
                  },
                ]}
              />

              <TextInput
                value={createDraft.category}
                onChangeText={(category) =>
                  setCreateDraft((prev) => ({ ...prev, category }))
                }
                placeholder="Category"
                placeholderTextColor={t.mutedText}
                style={[
                  styles.input,
                  {
                    color: t.text,
                    backgroundColor: t.background,
                    borderColor: t.border,
                  },
                ]}
              />

              <TextInput
                value={createDraft.difficulty}
                onChangeText={(difficulty) =>
                  setCreateDraft((prev) => ({ ...prev, difficulty }))
                }
                placeholder="Difficulty"
                placeholderTextColor={t.mutedText}
                style={[
                  styles.input,
                  {
                    color: t.text,
                    backgroundColor: t.background,
                    borderColor: t.border,
                  },
                ]}
              />

              <Text style={[styles.inlineLabel, { color: t.text }]}>
                Metric Type
              </Text>

              <View style={styles.metricRow}>
                {(["seconds", "reps", "attempts"] as SkillMetricType[]).map(
                  (metric) => {
                    const selected = createDraft.metricType === metric;

                    return (
                      <TouchableOpacity
                        key={metric}
                        activeOpacity={0.86}
                        onPress={() =>
                          setCreateDraft((prev) => ({
                            ...prev,
                            metricType: metric,
                          }))
                        }
                        style={[
                          styles.metricChip,
                          {
                            backgroundColor: selected ? t.link : t.cardAlt,
                            borderColor: selected ? t.link : t.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.metricChipText,
                            { color: selected ? "white" : t.text },
                          ]}
                        >
                          {metric}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>

              <TextInput
                value={createDraft.shortDescription}
                onChangeText={(shortDescription) =>
                  setCreateDraft((prev) => ({ ...prev, shortDescription }))
                }
                placeholder="Short description"
                placeholderTextColor={t.mutedText}
                multiline
                textAlignVertical="top"
                style={[
                  styles.input,
                  styles.notesInput,
                  {
                    color: t.text,
                    backgroundColor: t.background,
                    borderColor: t.border,
                  },
                ]}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setShowCreateSkillModal(false)}
                style={[
                  styles.secondaryButton,
                  { borderColor: t.border, backgroundColor: t.cardAlt },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: t.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={creatingSkill}
                onPress={() => void handleCreateSkill()}
                style={[
                  styles.primaryButtonSmall,
                  { backgroundColor: t.link, opacity: creatingSkill ? 0.7 : 1 },
                ]}
              >
                {creatingSkill ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSortModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sortModalCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: t.text }]}>
              Sort Skills
            </Text>

            {(
              ["favorites", "recent", "progress", "name", "status"] as SortOption[]
            ).map((option) => {
              const selected = sortBy === option;
              const meta = getSortMeta(option);

              return (
                <TouchableOpacity
                  key={option}
                  activeOpacity={0.86}
                  onPress={() => {
                    setSortBy(option);
                    setShowSortModal(false);
                  }}
                  style={[
                    styles.sortOptionRow,
                    {
                      backgroundColor: selected ? t.cardAlt : "transparent",
                      borderColor: t.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sortOptionText, { color: t.text }]}>
                      {meta.heading}
                    </Text>
                    <Text
                      style={[styles.sortOptionSubtext, { color: t.mutedText }]}
                    >
                      {meta.description}
                    </Text>
                  </View>

                  {selected ? (
                    <Ionicons name="checkmark" size={18} color={t.text} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!selectedCard}
        transparent
        animationType="none"
        onRequestClose={() => closeQuickActionsSheet()}
      >
        <View style={styles.quickActionModalRoot}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.quickActionBlurWrap,
              { opacity: quickActionsOverlayOpacity },
            ]}
          >
            <BlurView
              intensity={34}
              tint="dark"
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.quickActionBackdropTint} />
          </Animated.View>

          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => closeQuickActionsSheet()}
          />

          <View style={styles.quickActionModalContent}>
            <Animated.View
              style={[
                styles.quickActionPanel,
                {
                  backgroundColor: t.card,
                  borderColor: t.border,
                  opacity: quickActionsContentOpacity,
                  transform: [
                    { translateY: quickActionsTranslateY },
                    { scale: quickActionsScale },
                  ],
                },
              ]}
            >
              <View style={styles.quickActionTopRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.quickActionPanelTitle, { color: t.text }]}>
                    {selectedCard?.skill.name}
                  </Text>
                  <Text
                    style={[styles.quickActionPanelSubtitle, { color: t.mutedText }]}
                  >
                    Quick actions for this skill.
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => closeQuickActionsSheet()}
                  style={[
                    styles.quickActionCloseButton,
                    { backgroundColor: t.cardAlt, borderColor: t.border },
                  ]}
                >
                  <Ionicons name="close" size={18} color={t.text} />
                </TouchableOpacity>
              </View>

              {selectedCard ? (
                <View
                  style={[
                    styles.quickActionsHeader,
                    { backgroundColor: t.cardAlt, borderColor: t.border },
                  ]}
                >
                  <View style={styles.quickActionsHeaderLeft}>
                    <View
                      style={[
                        styles.quickActionsStatusDot,
                        {
                          backgroundColor:
                            getEffectiveStatus(selectedCard) === SKILL_STATUS.MASTERED
                              ? t.link
                              : getEffectiveStatus(selectedCard) === SKILL_STATUS.PAUSED
                                ? "#6b7280"
                                : t.text,
                        },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.quickActionsHeaderTitle, { color: t.text }]}
                      >
                        {getStatusDisplayLabel(getEffectiveStatus(selectedCard))}
                      </Text>
                      <Text
                        style={[
                          styles.quickActionsHeaderSubtitle,
                          { color: t.mutedText },
                        ]}
                      >
                        Update the skill instantly or open the full detail screen.
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              <View style={styles.quickActions}>
                {selectedCard
                  ? getQuickActionsForStatus(getEffectiveStatus(selectedCard)).map(
                    (action) => {
                      const busy = statusBusy === action.status;
                      const selected =
                        getEffectiveStatus(selectedCard) === action.status;

                      return (
                        <TouchableOpacity
                          key={action.status}
                          activeOpacity={0.88}
                          disabled={busy || selected}
                          onPress={() => void handleGridStatusChange(action.status)}
                          style={[
                            styles.quickActionButton,
                            {
                              backgroundColor: selected ? t.link : t.cardAlt,
                              borderColor: selected ? t.link : t.border,
                              opacity: busy ? 0.72 : 1,
                            },
                          ]}
                        >
                          <View style={styles.quickActionInner}>
                            <View
                              style={[
                                styles.quickActionIconWrap,
                                {
                                  backgroundColor: selected
                                    ? "rgba(255,255,255,0.18)"
                                    : t.background,
                                },
                              ]}
                            >
                              {busy ? (
                                <ActivityIndicator
                                  size="small"
                                  color={selected ? "white" : t.text}
                                />
                              ) : (
                                <Ionicons
                                  name={action.icon}
                                  size={18}
                                  color={selected ? "white" : t.text}
                                />
                              )}
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.quickActionTitle,
                                  { color: selected ? "white" : t.text },
                                ]}
                              >
                                {action.title}
                              </Text>
                              <Text
                                style={[
                                  styles.quickActionSubtitle,
                                  {
                                    color: selected
                                      ? "rgba(255,255,255,0.86)"
                                      : t.mutedText,
                                  },
                                ]}
                              >
                                {action.subtitle}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    }
                  )
                  : null}
              </View>

              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => {
                  const card = selectedCard;
                  if (!card) return;

                  closeQuickActionsSheet(() => {
                    bumpSwipeReset();
                    openSkillDetail(card);
                  });
                }}
                style={[
                  styles.modalSecondaryAction,
                  { backgroundColor: t.cardAlt, borderColor: t.border },
                ]}
              >
                <Text style={{ color: t.text, fontWeight: "800" }}>
                  View Full Details
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  toastWrap: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  toastCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  toastTitle: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  toastBody: {
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: "600",
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
  },

  dashboardCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
    marginBottom: 18,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryCard: {
    minWidth: "47%",
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "600",
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  primaryActionCard: {
    flexGrow: 1,
    minWidth: 150,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryActionCardText: {
    color: "white",
    fontSize: 14.5,
    fontWeight: "800",
  },
  secondaryActionCard: {
    flexGrow: 1,
    minWidth: 150,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryActionCardText: {
    fontSize: 14,
    fontWeight: "800",
  },
  skeletonAction: {
    flexGrow: 1,
    minWidth: 150,
    height: 50,
    borderWidth: 1,
    borderRadius: 18,
  },

  favoriteStrip: {
    gap: 8,
    paddingTop: 12,
  },
  favoritePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 180,
  },
  favoritePillText: {
    fontSize: 12.5,
    fontWeight: "700",
  },

  milestonePanel: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  milestonePanelLabel: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  milestonePanelBody: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
  },

  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },

  contextCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
  },
  contextCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contextLabel: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  contextBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  contextBadgeText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  contextTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "800",
  },
  contextBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },

  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  skeletonCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    minHeight: 176,
  },
  skeletonLineSm: {
    height: 12,
    borderRadius: 999,
    marginBottom: 10,
  },
  skeletonLineLg: {
    height: 20,
    borderRadius: 999,
    marginBottom: 10,
  },
  skeletonProgress: {
    height: 8,
    borderRadius: 999,
    marginTop: 16,
    marginBottom: 12,
  },

  emptyCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginTop: 8,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  emptyPrimaryAction: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptySecondaryAction: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyActionText: {
    color: "white",
    fontWeight: "800",
  },
  emptySecondaryText: {
    fontWeight: "800",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    maxHeight: "84%",
  },

  sortModalCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },
  sortOptionRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sortOptionText: {
    fontSize: 15,
    fontWeight: "800",
  },
  sortOptionSubtext: {
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 18,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  modalSubtitle: {
    marginTop: 8,
    marginBottom: 14,
    textAlign: "center",
    fontSize: 13.5,
    lineHeight: 19,
  },

  skillPickRow: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  skillPickIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  skillPickTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  skillPickBody: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
    textTransform: "capitalize",
  },

  noSkillsStateWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
  },
  noSkillsCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  noSkillsTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  noSkillsText: {
    marginTop: 6,
    fontSize: 13.5,
    lineHeight: 19,
  },
  createFromEmptyButton: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  createFromEmptyButtonText: {
    color: "white",
    fontWeight: "800",
  },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  notesInput: {
    minHeight: 110,
  },
  inlineLabel: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  metricChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  metricChipText: {
    fontWeight: "800",
    textTransform: "capitalize",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  primaryButtonSmall: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "800",
  },

  quickActionModalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  quickActionBlurWrap: {
    ...StyleSheet.absoluteFill,
  },
  quickActionBackdropTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(8,12,18,0.24)",
  },
  quickActionModalContent: {
    flex: 1,
    justifyContent: "center",
  },
  quickActionPanel: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },
  quickActionTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  quickActionPanelTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  quickActionPanelSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  quickActionCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  quickActionsHeader: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  quickActionsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quickActionsStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 2,
  },
  quickActionsHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  quickActionsHeaderSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },

  quickActions: {
    gap: 10,
    marginTop: 2,
  },
  quickActionButton: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  quickActionInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quickActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  quickActionSubtitle: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },

  modalSecondaryAction: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
  },
  modalClose: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
  },
});
