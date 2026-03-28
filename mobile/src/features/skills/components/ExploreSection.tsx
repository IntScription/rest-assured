import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { Skill } from "@/src/features/skills/types";
import { importGlobalProgramToTrain } from "@/src/features/skills/utils/import-global-program";
import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";

type ProfileLite = {
  id: string;
  username: string | null;
  display_name?: string | null;
};

type GlobalProgramRow = {
  id: string;
  program_id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  category: string | null;
  like_count: number;
  import_count: number;
  published_by_user_id: string;
  created_at?: string | null;
  updated_at?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
  profiles?: {
    username: string | null;
  } | null;
};

type LocalProgramRow = {
  id: string;
  name: string;
  created_at: string | null;
};

type LocalSplitRow = {
  id: string;
  name: string;
  program_id: string;
  order_index?: number | null;
};

type LocalExerciseRow = {
  id: string;
  name: string;
  split_id: string;
};

type PublishDraft = {
  programId: string | null;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: string;
};

type SkillDifficultyFilter = "all" | "beginner" | "intermediate" | "advanced";
type SkillCategoryFilter =
  | "all"
  | "push"
  | "pull"
  | "core"
  | "balance"
  | "static"
  | "mobility"
  | "legs"
  | "full_body";

type ProgramDifficultyFilter = "all" | "beginner" | "intermediate" | "advanced";
type ProgramSort = "newest" | "most_imported";

type PreviewSplit = {
  id: string;
  name: string;
  order_index: number;
  exercises: { id: string; name: string }[];
};

type PreviewState = {
  visible: boolean;
  loading: boolean;
  title: string;
  subtitle: string;
  description: string;
  splits: PreviewSplit[];
};

function getProgramSubtitle(program: GlobalProgramRow) {
  return `${program.difficulty ?? "mixed"} · ${program.category ?? "general"}`;
}

function sortSplits(items: LocalSplitRow[]) {
  return [...items].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

export default function ExploreSection() {
  const t = useAppTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(null);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [trackedSkillIds, setTrackedSkillIds] = useState<Set<string>>(new Set());
  const [likedProgramIds, setLikedProgramIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const [difficultyFilter, setDifficultyFilter] =
    useState<SkillDifficultyFilter>("all");
  const [categoryFilter, setCategoryFilter] =
    useState<SkillCategoryFilter>("all");

  const [programDifficultyFilter, setProgramDifficultyFilter] =
    useState<ProgramDifficultyFilter>("all");
  const [programSort, setProgramSort] = useState<ProgramSort>("newest");

  const [featuredPrograms, setFeaturedPrograms] = useState<GlobalProgramRow[]>([]);
  const [communityPrograms, setCommunityPrograms] = useState<GlobalProgramRow[]>([]);
  const [myPrograms, setMyPrograms] = useState<LocalProgramRow[]>([]);
  const [myProgramSplitCounts, setMyProgramSplitCounts] = useState<Record<string, number>>({});
  const [publishedProgramMap, setPublishedProgramMap] = useState<Record<string, GlobalProgramRow>>(
    {}
  );

  const [startBusySkillId, setStartBusySkillId] = useState<string | null>(null);
  const [importBusyId, setImportBusyId] = useState<string | null>(null);
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null);
  const [publishBusyProgramId, setPublishBusyProgramId] = useState<string | null>(null);
  const [deleteBusyProgramId, setDeleteBusyProgramId] = useState<string | null>(null);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishDraft, setPublishDraft] = useState<PublishDraft>({
    programId: null,
    title: "",
    description: "",
    difficulty: "beginner",
    category: "general",
  });

  const [preview, setPreview] = useState<PreviewState>({
    visible: false,
    loading: false,
    title: "",
    subtitle: "",
    description: "",
    splits: [],
  });
  const [expandedPreviewSplitIds, setExpandedPreviewSplitIds] = useState<Set<string>>(new Set());

  const difficultyOptions: SkillDifficultyFilter[] = [
    "all",
    "beginner",
    "intermediate",
    "advanced",
  ];

  const categoryOptions: SkillCategoryFilter[] = [
    "all",
    "push",
    "pull",
    "core",
    "balance",
    "static",
    "mobility",
    "legs",
    "full_body",
  ];

  const programDifficultyOptions: ProgramDifficultyFilter[] = [
    "all",
    "beginner",
    "intermediate",
    "advanced",
  ];

  const programSortOptions: ProgramSort[] = ["newest", "most_imported"];

  const hasUsername = !!profile?.username?.trim();

  const starterSkills = useMemo(() => {
    const preferred = ["Handstand", "L-Sit", "Pike Push-Up"];
    return preferred
      .map((name) =>
        skills.find((skill) => skill.name.toLowerCase() === name.toLowerCase())
      )
      .filter(Boolean) as Skill[];
  }, [skills]);

  const publishablePrograms = useMemo(() => {
    return myPrograms.map((program) => {
      const splitCount = myProgramSplitCounts[program.id] ?? 0;
      const published = publishedProgramMap[program.id] ?? null;

      return {
        program,
        splitCount,
        published,
        canPublish: splitCount > 0,
      };
    });
  }, [myPrograms, myProgramSplitCounts, publishedProgramMap]);

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();

    return skills.filter((skill) => {
      const queryMatch =
        !q ||
        skill.name.toLowerCase().includes(q) ||
        skill.category.toLowerCase().includes(q) ||
        skill.difficulty.toLowerCase().includes(q) ||
        (skill.short_description ?? "").toLowerCase().includes(q);

      const difficultyMatch =
        difficultyFilter === "all" || skill.difficulty === difficultyFilter;

      const categoryMatch =
        categoryFilter === "all" || skill.category === categoryFilter;

      return queryMatch && difficultyMatch && categoryMatch;
    });
  }, [skills, query, difficultyFilter, categoryFilter]);

  const filteredFeaturedPrograms = useMemo(() => {
    let next = [...featuredPrograms];

    if (programDifficultyFilter !== "all") {
      next = next.filter(
        (program) => program.difficulty === programDifficultyFilter
      );
    }

    if (programSort === "most_imported") {
      next.sort((a, b) => (b.import_count ?? 0) - (a.import_count ?? 0));
    } else {
      next.sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
      );
    }

    return next;
  }, [featuredPrograms, programDifficultyFilter, programSort]);

  const filteredCommunityPrograms = useMemo(() => {
    let next = [...communityPrograms];

    if (programDifficultyFilter !== "all") {
      next = next.filter(
        (program) => program.difficulty === programDifficultyFilter
      );
    }

    if (programSort === "most_imported") {
      next.sort((a, b) => (b.import_count ?? 0) - (a.import_count ?? 0));
    } else {
      next.sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
      );
    }

    return next;
  }, [communityPrograms, programDifficultyFilter, programSort]);

  const promptUsernameRequired = () => {
    Alert.alert(
      "Username required",
      "Create a username in Profile before uploading to global or importing from global.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Go to Profile",
          onPress: () => router.push("/profile"),
        },
      ]
    );
  };

  const load = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const currentUserId = user?.id ?? null;
    setUserId(currentUserId);

    const [
      profileRes,
      skillsRes,
      userSkillsRes,
      featuredRes,
      communityRes,
      likesRes,
      programsRes,
      splitsRes,
      myGlobalProgramsRes,
    ] = await Promise.all([
      currentUserId
        ? supabase
          .from("profiles")
          .select("id, username, display_name")
          .eq("id", currentUserId)
          .maybeSingle()
        : Promise.resolve({
          data: null,
          error: null,
        } as { data: ProfileLite | null; error: null }),
      supabase.from("skills").select("*").eq("is_active", true).order("name"),
      currentUserId
        ? supabase
          .from("user_skills")
          .select("skill_id")
          .eq("user_id", currentUserId)
        : Promise.resolve({
          data: [],
          error: null,
        } as { data: { skill_id: string }[]; error: null }),
      supabase
        .from("global_programs")
        .select("*, profiles:published_by_user_id(username)")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("global_programs")
        .select("*, profiles:published_by_user_id(username)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(30),
      currentUserId
        ? supabase
          .from("global_program_likes")
          .select("global_program_id")
          .eq("user_id", currentUserId)
        : Promise.resolve({
          data: [],
          error: null,
        } as { data: { global_program_id: string }[]; error: null }),
      currentUserId
        ? supabase
          .from("programs")
          .select("id, name, created_at")
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false })
        : Promise.resolve({
          data: [],
          error: null,
        } as { data: LocalProgramRow[]; error: null }),
      currentUserId
        ? supabase
          .from("splits")
          .select("id, program_id")
          .eq("user_id", currentUserId)
        : Promise.resolve({
          data: [],
          error: null,
        } as { data: { id: string; program_id: string }[]; error: null }),
      currentUserId
        ? supabase
          .from("global_programs")
          .select("*")
          .eq("published_by_user_id", currentUserId)
        : Promise.resolve({
          data: [],
          error: null,
        } as { data: GlobalProgramRow[]; error: null }),
    ]);

    if (!profileRes.error) {
      setProfile((profileRes.data as ProfileLite | null) ?? null);
    } else {
      setProfile(null);
    }

    if (!skillsRes.error) {
      setSkills((skillsRes.data ?? []) as Skill[]);
    }

    if (!userSkillsRes.error) {
      const ids = new Set<string>(
        ((userSkillsRes.data ?? []) as { skill_id: string }[]).map(
          (row) => row.skill_id
        )
      );
      setTrackedSkillIds(ids);
    } else {
      setTrackedSkillIds(new Set<string>());
    }

    if (!likesRes.error) {
      const ids = new Set<string>(
        ((likesRes.data ?? []) as { global_program_id: string }[]).map(
          (row) => row.global_program_id
        )
      );
      setLikedProgramIds(ids);
    } else {
      setLikedProgramIds(new Set<string>());
    }

    if (!featuredRes.error) {
      setFeaturedPrograms((featuredRes.data ?? []) as GlobalProgramRow[]);
    }

    if (!communityRes.error) {
      setCommunityPrograms((communityRes.data ?? []) as GlobalProgramRow[]);
    }

    if (!programsRes.error) {
      setMyPrograms((programsRes.data ?? []) as LocalProgramRow[]);
    } else {
      setMyPrograms([]);
    }

    if (!splitsRes.error) {
      const counts: Record<string, number> = {};
      ((splitsRes.data ?? []) as { id: string; program_id: string }[]).forEach(
        (item) => {
          counts[item.program_id] = (counts[item.program_id] ?? 0) + 1;
        }
      );
      setMyProgramSplitCounts(counts);
    } else {
      setMyProgramSplitCounts({});
    }

    if (!myGlobalProgramsRes.error) {
      const nextMap: Record<string, GlobalProgramRow> = {};
      ((myGlobalProgramsRes.data ?? []) as GlobalProgramRow[]).forEach((item) => {
        nextMap[item.program_id] = item;
      });
      setPublishedProgramMap(nextMap);
    } else {
      setPublishedProgramMap({});
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  const handleStartSkill = async (skill: Skill) => {
    if (!userId) {
      Alert.alert("Sign in required", "Please sign in to start tracking a skill.");
      return;
    }

    try {
      setStartBusySkillId(skill.id);

      const { data: firstStage, error: stageError } = await supabase
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
        current_stage_id: firstStage?.id ?? null,
        status: "active",
        is_favorite: false,
      });

      if (error) throw error;

      setTrackedSkillIds((prev) => new Set<string>([...prev, skill.id]));
    } catch (err: any) {
      Alert.alert("Could not start skill", err?.message ?? "Please try again.");
    } finally {
      setStartBusySkillId(null);
    }
  };

  const handleToggleLike = async (program: GlobalProgramRow) => {
    if (!userId) {
      Alert.alert("Sign in required", "Please sign in to like a program.");
      return;
    }

    const alreadyLiked = likedProgramIds.has(program.id);

    try {
      setLikeBusyId(program.id);

      setLikedProgramIds((prev) => {
        const next = new Set(prev);
        if (alreadyLiked) next.delete(program.id);
        else next.add(program.id);
        return next;
      });

      const updatePrograms = (items: GlobalProgramRow[]) =>
        items.map((item) =>
          item.id === program.id
            ? {
              ...item,
              like_count: Math.max(
                0,
                item.like_count + (alreadyLiked ? -1 : 1)
              ),
            }
            : item
        );

      setFeaturedPrograms((prev) => updatePrograms(prev));
      setCommunityPrograms((prev) => updatePrograms(prev));

      if (alreadyLiked) {
        const { error } = await supabase
          .from("global_program_likes")
          .delete()
          .eq("global_program_id", program.id)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("global_program_likes").insert({
          global_program_id: program.id,
          user_id: userId,
        });

        if (error) throw error;
      }

      const { error: updateError } = await supabase
        .from("global_programs")
        .update({
          like_count: Math.max(
            0,
            program.like_count + (alreadyLiked ? -1 : 1)
          ),
        })
        .eq("id", program.id);

      if (updateError) throw updateError;
    } catch (err: any) {
      await load();
      Alert.alert("Could not update like", err?.message ?? "Please try again.");
    } finally {
      setLikeBusyId(null);
    }
  };

  const openPublishModal = (program: LocalProgramRow) => {
    if (!hasUsername) {
      promptUsernameRequired();
      return;
    }

    const published = publishedProgramMap[program.id] ?? null;

    setPublishDraft({
      programId: program.id,
      title: published?.title ?? program.name,
      description: published?.description ?? "",
      difficulty:
        (published?.difficulty as PublishDraft["difficulty"] | null) ?? "beginner",
      category: published?.category ?? "general",
    });
    setShowPublishModal(true);
  };

  const handlePublishProgram = async () => {
    if (!userId || !publishDraft.programId) return;

    if (!hasUsername) {
      setShowPublishModal(false);
      promptUsernameRequired();
      return;
    }

    if (!publishDraft.title.trim()) {
      Alert.alert("Title required", "Please enter a title for the global program.");
      return;
    }

    try {
      setPublishBusyProgramId(publishDraft.programId);

      const existing = publishedProgramMap[publishDraft.programId] ?? null;

      if (existing) {
        const { data, error } = await supabase
          .from("global_programs")
          .update({
            title: publishDraft.title.trim(),
            description: publishDraft.description.trim() || null,
            difficulty: publishDraft.difficulty,
            category: publishDraft.category.trim() || "general",
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("*")
          .single();

        if (error) throw error;

        setPublishedProgramMap((prev) => ({
          ...prev,
          [publishDraft.programId!]: data as GlobalProgramRow,
        }));
      } else {
        const { data, error } = await supabase
          .from("global_programs")
          .insert({
            program_id: publishDraft.programId,
            published_by_user_id: userId,
            title: publishDraft.title.trim(),
            description: publishDraft.description.trim() || null,
            difficulty: publishDraft.difficulty,
            category: publishDraft.category.trim() || "general",
            is_featured: false,
            is_active: true,
          })
          .select("*")
          .single();

        if (error) throw error;

        setPublishedProgramMap((prev) => ({
          ...prev,
          [publishDraft.programId!]: data as GlobalProgramRow,
        }));
      }

      setShowPublishModal(false);
      await load();
      Alert.alert("Published", "Your program is now available in the global section.");
    } catch (err: any) {
      Alert.alert("Could not publish", err?.message ?? "Please try again.");
    } finally {
      setPublishBusyProgramId(null);
    }
  };

  const handleDeleteGlobalProgram = async (
    publishedProgram: GlobalProgramRow,
    localProgramId: string
  ) => {
    if (!hasUsername) {
      promptUsernameRequired();
      return;
    }

    Alert.alert(
      "Remove from Global?",
      "This will remove the program from the global list. It will not delete your local Train program.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleteBusyProgramId(localProgramId);

              const { error } = await supabase
                .from("global_programs")
                .delete()
                .eq("id", publishedProgram.id)
                .eq("published_by_user_id", userId);

              if (error) throw error;

              setPublishedProgramMap((prev) => {
                const next = { ...prev };
                delete next[localProgramId];
                return next;
              });

              setFeaturedPrograms((prev) =>
                prev.filter((item) => item.id !== publishedProgram.id)
              );
              setCommunityPrograms((prev) =>
                prev.filter((item) => item.id !== publishedProgram.id)
              );

              await load();
            } catch (err: any) {
              Alert.alert(
                "Could not remove from global",
                err?.message ?? "Please try again."
              );
            } finally {
              setDeleteBusyProgramId(null);
            }
          },
        },
      ]
    );
  };

  const handlePreviewProgram = async (program: GlobalProgramRow) => {
    try {
      setExpandedPreviewSplitIds(new Set());

      setPreview({
        visible: true,
        loading: true,
        title: program.title,
        subtitle: `@${program.profiles?.username ?? "user"} · ${getProgramSubtitle(program)}`,
        description: program.description ?? "",
        splits: [],
      });

      const { data: splitsData, error: splitsError } = await supabase
        .from("splits")
        .select("id, name, program_id, order_index")
        .eq("program_id", program.program_id)
        .order("order_index", { ascending: true });

      if (splitsError) throw splitsError;

      const splits = sortSplits((splitsData ?? []) as LocalSplitRow[]);

      const splitIds = splits.map((split) => split.id);

      let exercises: LocalExerciseRow[] = [];
      if (splitIds.length > 0) {
        const { data: exercisesData, error: exercisesError } = await supabase
          .from("exercises")
          .select("id, name, split_id")
          .in("split_id", splitIds);

        if (exercisesError) throw exercisesError;
        exercises = (exercisesData ?? []) as LocalExerciseRow[];
      }

      const nextSplits: PreviewSplit[] = splits.map((split) => ({
        id: split.id,
        name: split.name,
        order_index: split.order_index ?? 0,
        exercises: exercises
          .filter((exercise) => exercise.split_id === split.id)
          .map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
          })),
      }));

      setPreview((prev) => ({
        ...prev,
        loading: false,
        splits: nextSplits,
      }));
    } catch (err: any) {
      setPreview((prev) => ({
        ...prev,
        loading: false,
        splits: [],
      }));
      Alert.alert("Could not load preview", err?.message ?? "Please try again.");
    }
  };

  const togglePreviewSplit = (splitId: string) => {
    setExpandedPreviewSplitIds((prev) => {
      const next = new Set(prev);
      if (next.has(splitId)) next.delete(splitId);
      else next.add(splitId);
      return next;
    });
  };

  const handleImportProgram = async (program: GlobalProgramRow) => {
    if (!userId) {
      Alert.alert("Sign in required", "Please sign in to import a program.");
      return;
    }

    if (!hasUsername) {
      promptUsernameRequired();
      return;
    }

    try {
      setImportBusyId(program.id);

      const result = await importGlobalProgramToTrain(userId, {
        id: program.id,
        program_id: program.program_id,
        title: program.title,
        import_count: program.import_count,
      });

      const updatePrograms = (items: GlobalProgramRow[]) =>
        items.map((item) =>
          item.id === program.id
            ? {
              ...item,
              import_count: result.nextImportCount,
            }
            : item
        );

      setFeaturedPrograms((prev) => updatePrograms(prev));
      setCommunityPrograms((prev) => updatePrograms(prev));

      router.push({
        pathname: "/(tabs)/train",
        params: {
          importedFromGlobal: "1",
          importedGlobalTitle: program.title,
          importedGlobalBy: program.profiles?.username ?? "",
          importedGlobalId: program.id,
        },
      });
    } catch (err: any) {
      Alert.alert("Could not import program", err?.message ?? "Please try again.");
    } finally {
      setImportBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.text} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: t.background }]}>
      <FlatList
        data={filteredSkills}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={[styles.header, { color: t.text }]}>Explore</Text>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search skills"
              placeholderTextColor={t.mutedText}
              style={[
                styles.searchInput,
                {
                  color: t.text,
                  borderColor: t.border,
                  backgroundColor: t.card,
                },
              ]}
            />

            {!hasUsername ? (
              <View
                style={[
                  styles.usernameGateCard,
                  { backgroundColor: t.card, borderColor: t.border },
                ]}
              >
                <View style={styles.usernameGateTop}>
                  <View
                    style={[
                      styles.usernameGateIcon,
                      { backgroundColor: t.cardAlt, borderColor: t.border },
                    ]}
                  >
                    <Ionicons name="person-circle-outline" size={18} color={t.text} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.usernameGateTitle, { color: t.text }]}>
                      Set a username to use Global Programs
                    </Text>
                    <Text
                      style={[styles.usernameGateBody, { color: t.mutedText }]}
                    >
                      Uploading to global and importing from global are locked until
                      you create a username in Profile.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => router.push("/profile")}
                  style={[styles.usernameGateButton, { backgroundColor: t.link }]}
                >
                  <Ionicons name="create-outline" size={16} color="white" />
                  <Text style={styles.usernameGateButtonText}>Go to Profile</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View
              style={[
                styles.onboardingCard,
                { backgroundColor: t.card, borderColor: t.border },
              ]}
            >
              <Text style={[styles.onboardingTitle, { color: t.text }]}>
                Good starters
              </Text>
              <Text style={[styles.onboardingBody, { color: t.mutedText }]}>
                Start with one of these simple, high-value skills.
              </Text>

              <View style={styles.onboardingRow}>
                {starterSkills.map((skill) => {
                  const tracked = trackedSkillIds.has(skill.id);

                  return (
                    <TouchableOpacity
                      key={skill.id}
                      activeOpacity={0.86}
                      disabled={tracked || startBusySkillId === skill.id}
                      onPress={() => void handleStartSkill(skill)}
                      style={[
                        styles.starterChip,
                        {
                          backgroundColor: tracked ? t.cardAlt : t.link,
                          borderColor: tracked ? t.border : t.link,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.starterChipText,
                          { color: tracked ? t.text : "white" },
                        ]}
                      >
                        {skill.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <Text style={[styles.filterLabel, { color: t.text }]}>Difficulty</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {difficultyOptions.map((option) => {
                const selected = difficultyFilter === option;
                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.86}
                    onPress={() => setDifficultyFilter(option)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: selected ? t.link : t.cardAlt,
                        borderColor: selected ? t.link : t.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: selected ? "white" : t.text },
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.filterLabel, { color: t.text }]}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {categoryOptions.map((option) => {
                const selected = categoryFilter === option;
                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.86}
                    onPress={() => setCategoryFilter(option)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: selected ? t.link : t.cardAlt,
                        borderColor: selected ? t.link : t.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: selected ? "white" : t.text },
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.sectionTitle, { color: t.text }]}>Skill Library</Text>
          </View>
        }
        renderItem={({ item }) => {
          const tracked = trackedSkillIds.has(item.id);

          return (
            <View
              style={[
                styles.skillCard,
                {
                  backgroundColor: t.card,
                  borderColor: t.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.skillTitle, { color: t.text }]}>{item.name}</Text>
                <Text style={[styles.skillMeta, { color: t.mutedText }]}>
                  {item.category} · {item.difficulty}
                </Text>
                <Text style={[styles.skillDesc, { color: t.mutedText }]}>
                  {item.short_description || "Start tracking this skill."}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                disabled={tracked || startBusySkillId === item.id}
                onPress={() => void handleStartSkill(item)}
                style={[
                  styles.skillAction,
                  {
                    backgroundColor: tracked ? t.cardAlt : t.link,
                    borderColor: tracked ? t.border : t.link,
                  },
                ]}
              >
                {startBusySkillId === item.id ? (
                  <ActivityIndicator
                    size="small"
                    color={tracked ? t.text : "white"}
                  />
                ) : (
                  <Text
                    style={{
                      color: tracked ? t.text : "white",
                      fontWeight: "800",
                    }}
                  >
                    {tracked ? "Added" : "Start"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={{ marginTop: 18 }}>
            <View
              style={[
                styles.publishPanel,
                { backgroundColor: t.card, borderColor: t.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: t.text }]}>
                Publish Your Programs
              </Text>
              <Text style={[styles.publishBody, { color: t.mutedText }]}>
                Upload your Train programs globally with splits and exercises, without logs.
              </Text>

              {publishablePrograms.length === 0 ? (
                <Text style={[styles.emptyText, { color: t.mutedText }]}>
                  Create a Train program first, then come back here to publish it globally.
                </Text>
              ) : (
                <View style={{ marginTop: 12, gap: 10 }}>
                  {publishablePrograms.map(({ program, splitCount, published, canPublish }) => {
                    const publishBusy = publishBusyProgramId === program.id;
                    const deleteBusy = deleteBusyProgramId === program.id;

                    return (
                      <View
                        key={program.id}
                        style={[
                          styles.publishCard,
                          { backgroundColor: t.cardAlt, borderColor: t.border },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.publishTitle, { color: t.text }]}>
                            {program.name}
                          </Text>
                          <Text style={[styles.publishMeta, { color: t.mutedText }]}>
                            {splitCount} {splitCount === 1 ? "split" : "splits"}
                            {published ? ` · global as @${profile?.username ?? "you"}` : ""}
                          </Text>
                        </View>

                        <View style={styles.publishActions}>
                          <TouchableOpacity
                            activeOpacity={0.86}
                            disabled={!canPublish || publishBusy}
                            onPress={() => openPublishModal(program)}
                            style={[
                              styles.publishButton,
                              {
                                backgroundColor: !canPublish ? t.card : t.link,
                                borderColor: !canPublish ? t.border : t.link,
                                opacity: publishBusy ? 0.72 : 1,
                              },
                            ]}
                          >
                            {publishBusy ? (
                              <ActivityIndicator size="small" color="white" />
                            ) : (
                              <Text
                                style={[
                                  styles.publishButtonText,
                                  { color: !canPublish ? t.text : "white" },
                                ]}
                              >
                                {published ? "Update" : "Add Global"}
                              </Text>
                            )}
                          </TouchableOpacity>

                          {published ? (
                            <TouchableOpacity
                              activeOpacity={0.86}
                              disabled={deleteBusy}
                              onPress={() =>
                                void handleDeleteGlobalProgram(published, program.id)
                              }
                              style={[
                                styles.unpublishButton,
                                {
                                  backgroundColor: t.card,
                                  borderColor: t.border,
                                  opacity: deleteBusy ? 0.72 : 1,
                                },
                              ]}
                            >
                              {deleteBusy ? (
                                <ActivityIndicator size="small" color={t.text} />
                              ) : (
                                <Ionicons
                                  name="trash-outline"
                                  size={16}
                                  color="#ff453a"
                                />
                              )}
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <Text style={[styles.filterLabel, { color: t.text, marginTop: 18 }]}>
              Program Difficulty
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {programDifficultyOptions.map((option) => {
                const selected = programDifficultyFilter === option;
                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.86}
                    onPress={() => setProgramDifficultyFilter(option)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: selected ? t.link : t.cardAlt,
                        borderColor: selected ? t.link : t.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: selected ? "white" : t.text },
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.filterLabel, { color: t.text }]}>Program Sort</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {programSortOptions.map((option) => {
                const selected = programSort === option;
                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.86}
                    onPress={() => setProgramSort(option)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: selected ? t.link : t.cardAlt,
                        borderColor: selected ? t.link : t.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: selected ? "white" : t.text },
                      ]}
                    >
                      {option === "newest" ? "Newest" : "Most Imported"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.sectionTitle, { color: t.text }]}>
              Featured Programs
            </Text>

            {filteredFeaturedPrograms.length === 0 ? (
              <Text style={[styles.emptyText, { color: t.mutedText }]}>
                No featured programs match this filter.
              </Text>
            ) : (
              filteredFeaturedPrograms.map((program) => (
                <ProgramCard key={program.id} item={program} />
              ))
            )}

            <Text
              style={[styles.sectionTitle, { color: t.text, marginTop: 18 }]}
            >
              Community Programs
            </Text>

            {filteredCommunityPrograms.length === 0 ? (
              <Text style={[styles.emptyText, { color: t.mutedText }]}>
                No community programs match this filter.
              </Text>
            ) : (
              filteredCommunityPrograms.map((program) => (
                <ProgramCard key={program.id} item={program} />
              ))
            )}
          </View>
        }
      />

      <Modal
        visible={showPublishModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPublishModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: t.text }]}>
              Add to Global
            </Text>
            <Text style={[styles.modalSubtitle, { color: t.mutedText }]}>
              Set the public details people will see before importing your program.
            </Text>

            <TextInput
              value={publishDraft.title}
              onChangeText={(title) =>
                setPublishDraft((prev) => ({ ...prev, title }))
              }
              placeholder="Program title"
              placeholderTextColor={t.mutedText}
              style={[
                styles.input,
                { color: t.text, backgroundColor: t.background, borderColor: t.border },
              ]}
            />

            <TextInput
              value={publishDraft.description}
              onChangeText={(description) =>
                setPublishDraft((prev) => ({ ...prev, description }))
              }
              placeholder="Short description"
              placeholderTextColor={t.mutedText}
              multiline
              textAlignVertical="top"
              style={[
                styles.input,
                styles.notesInput,
                { color: t.text, backgroundColor: t.background, borderColor: t.border },
              ]}
            />

            <Text style={[styles.inlineLabel, { color: t.text }]}>Difficulty</Text>
            <View style={styles.optionRow}>
              {(["beginner", "intermediate", "advanced"] as const).map((item) => {
                const selected = publishDraft.difficulty === item;
                return (
                  <TouchableOpacity
                    key={item}
                    activeOpacity={0.86}
                    onPress={() =>
                      setPublishDraft((prev) => ({ ...prev, difficulty: item }))
                    }
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: selected ? t.link : t.cardAlt,
                        borderColor: selected ? t.link : t.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        { color: selected ? "white" : t.text },
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={publishDraft.category}
              onChangeText={(category) =>
                setPublishDraft((prev) => ({ ...prev, category }))
              }
              placeholder="Category (push, pull, full_body...)"
              placeholderTextColor={t.mutedText}
              style={[
                styles.input,
                { color: t.text, backgroundColor: t.background, borderColor: t.border },
              ]}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setShowPublishModal(false)}
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
                disabled={publishBusyProgramId === publishDraft.programId}
                onPress={() => void handlePublishProgram()}
                style={[
                  styles.primaryButtonSmall,
                  {
                    backgroundColor: t.link,
                    opacity:
                      publishBusyProgramId === publishDraft.programId ? 0.72 : 1,
                  },
                ]}
              >
                {publishBusyProgramId === publishDraft.programId ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.primaryButtonText}>Publish</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={preview.visible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPreview((prev) => ({
            ...prev,
            visible: false,
            loading: false,
            splits: [],
          }));
          setExpandedPreviewSplitIds(new Set());
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.previewModalCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: t.text }]}>
              {preview.title || "Program Preview"}
            </Text>
            <Text style={[styles.modalSubtitle, { color: t.mutedText }]}>
              {preview.subtitle}
            </Text>

            {preview.description ? (
              <Text style={[styles.previewDescription, { color: t.mutedText }]}>
                {preview.description}
              </Text>
            ) : null}

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingTop: 8 }}
            >
              {preview.loading ? (
                <View style={styles.previewLoadingWrap}>
                  <ActivityIndicator size="small" color={t.text} />
                  <Text style={[styles.emptyText, { color: t.mutedText }]}>
                    Loading program preview...
                  </Text>
                </View>
              ) : preview.splits.length === 0 ? (
                <Text style={[styles.emptyText, { color: t.mutedText }]}>
                  No splits found for this program.
                </Text>
              ) : (
                preview.splits.map((split, index) => {
                  const expanded = expandedPreviewSplitIds.has(split.id);

                  return (
                    <View
                      key={split.id}
                      style={[
                        styles.previewSplitCard,
                        { backgroundColor: t.cardAlt, borderColor: t.border },
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.86}
                        onPress={() => togglePreviewSplit(split.id)}
                        style={styles.previewSplitHeader}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.previewSplitTitle, { color: t.text }]}>
                            {index + 1}. {split.name}
                          </Text>
                          <Text style={[styles.previewSplitHint, { color: t.mutedText }]}>
                            {expanded ? "Hide exercises" : "Show exercises"}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.previewChevronWrap,
                            { backgroundColor: t.card, borderColor: t.border },
                          ]}
                        >
                          <Ionicons
                            name={expanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={t.text}
                          />
                        </View>
                      </TouchableOpacity>

                      {expanded ? (
                        <View style={styles.previewExerciseWrap}>
                          {split.exercises.length === 0 ? (
                            <Text
                              style={[
                                styles.previewExerciseEmpty,
                                { color: t.mutedText },
                              ]}
                            >
                              No exercises created
                            </Text>
                          ) : (
                            split.exercises.map((exercise, exerciseIndex) => (
                              <View
                                key={exercise.id}
                                style={[
                                  styles.previewExerciseRow,
                                  {
                                    backgroundColor: t.card,
                                    borderColor: t.border,
                                  },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.previewExerciseDot,
                                    { backgroundColor: t.link },
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.previewExerciseText,
                                    { color: t.text },
                                  ]}
                                >
                                  {exerciseIndex + 1}. {exercise.name}
                                </Text>
                              </View>
                            ))
                          )}
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setPreview((prev) => ({
                  ...prev,
                  visible: false,
                  loading: false,
                  splits: [],
                }));
                setExpandedPreviewSplitIds(new Set());
              }}
              style={[
                styles.previewCloseButton,
                {
                  borderColor: t.border,
                  backgroundColor: t.cardAlt,
                },
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: t.text }]}>
                Close Preview
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );

  function ProgramCard({ item }: { item: GlobalProgramRow }) {
    const liked = likedProgramIds.has(item.id);

    return (
      <View
        style={[
          styles.programCard,
          {
            backgroundColor: t.card,
            borderColor: t.border,
          },
        ]}
      >
        <Text style={[styles.programTitle, { color: t.text }]}>{item.title}</Text>
        <Text style={[styles.programMeta, { color: t.mutedText }]}>
          @{item.profiles?.username ?? "user"} · {getProgramSubtitle(item)}
        </Text>

        {item.description ? (
          <Text style={[styles.programDesc, { color: t.mutedText }]}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.programStats}>
          <Text style={[styles.programStat, { color: t.mutedText }]}>
            {item.import_count} imports
          </Text>
          <Text style={[styles.programStat, { color: t.mutedText }]}>
            {item.like_count} likes
          </Text>
        </View>

        <View style={styles.programActions}>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => void handlePreviewProgram(item)}
            style={[
              styles.previewButton,
              { backgroundColor: t.cardAlt, borderColor: t.border },
            ]}
          >
            <Text style={[styles.previewButtonText, { color: t.text }]}>
              Preview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            disabled={likeBusyId === item.id}
            onPress={() => void handleToggleLike(item)}
            style={[
              styles.likeButton,
              { backgroundColor: t.cardAlt, borderColor: t.border },
            ]}
          >
            {likeBusyId === item.id ? (
              <ActivityIndicator size="small" color={t.text} />
            ) : (
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={18}
                color={liked ? t.link : t.text}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            disabled={importBusyId === item.id}
            onPress={() => void handleImportProgram(item)}
            style={[styles.importButton, { backgroundColor: t.link }]}
          >
            {importBusyId === item.id ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.importButtonText}>Use in Train</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
  },

  header: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    marginBottom: 14,
  },

  usernameGateCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
  },
  usernameGateTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  usernameGateIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  usernameGateTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  usernameGateBody: {
    marginTop: 5,
    fontSize: 13.5,
    lineHeight: 19,
  },
  usernameGateButton: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  usernameGateButtonText: {
    color: "white",
    fontWeight: "800",
  },

  onboardingCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
  },
  onboardingTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  onboardingBody: {
    marginTop: 6,
    fontSize: 13.5,
    lineHeight: 19,
  },
  onboardingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  starterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  starterChipText: {
    fontWeight: "800",
  },

  filterLabel: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  filterRow: {
    gap: 10,
    paddingBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipText: {
    fontWeight: "800",
    textTransform: "capitalize",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },

  skillCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  skillTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  skillMeta: {
    marginTop: 4,
    fontSize: 12.5,
    textTransform: "capitalize",
  },
  skillDesc: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  skillAction: {
    minWidth: 78,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  publishPanel: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
  },
  publishBody: {
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 4,
  },
  publishCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  publishTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  publishMeta: {
    marginTop: 4,
    fontSize: 12.5,
  },
  publishActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  publishButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minWidth: 98,
    alignItems: "center",
    justifyContent: "center",
  },
  publishButtonText: {
    fontWeight: "800",
    fontSize: 12.5,
  },
  unpublishButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  programCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  programTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  programMeta: {
    marginTop: 4,
    fontSize: 12.5,
    textTransform: "capitalize",
  },
  programDesc: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  programStats: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },
  programStat: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  programActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    alignItems: "center",
  },
  previewButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  previewButtonText: {
    fontWeight: "800",
  },
  likeButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  importButton: {
    flex: 1.1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  importButtonText: {
    color: "white",
    fontWeight: "800",
  },

  emptyText: {
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 6,
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
  },
  previewModalCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    maxHeight: "84%",
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
  previewDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
    textAlign: "center",
  },
  previewLoadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
  },
  previewSplitCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  previewSplitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewSplitTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    marginBottom: 2,
  },
  previewSplitHint: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  previewChevronWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  previewExerciseWrap: {
    marginTop: 12,
    gap: 8,
  },
  previewExerciseRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewExerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  previewExerciseText: {
    fontSize: 13.5,
    fontWeight: "600",
    flex: 1,
  },
  previewExerciseEmpty: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  previewCloseButton: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
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
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionChipText: {
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
});
