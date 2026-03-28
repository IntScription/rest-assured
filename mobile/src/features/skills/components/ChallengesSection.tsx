import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  getSkillAchievementProgressForUser,
  subscribeSkillChallengesChanged,
} from "@/src/features/skills/services";
import type {
  ChallengeDefinition,
  UserChallenge,
} from "@/src/features/skills/types";
import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";

type ChallengeCard = {
  definition: ChallengeDefinition;
  userChallenge: UserChallenge | null;
  progressPercent: number;
};

type AchievementProgressCard = Awaited<
  ReturnType<typeof getSkillAchievementProgressForUser>
>[number];

type SectionItem =
  | { kind: "header"; id: string; title: string; subtitle: string }
  | { kind: "challenge"; id: string; card: ChallengeCard };

type MutationKind = "join" | "leave" | "restart";

function formatStatusLabel(status: UserChallenge["status"] | "available") {
  switch (status) {
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "expired":
      return "Expired";
    default:
      return "Available";
  }
}

function formatProgressText(card: ChallengeCard) {
  const current = Number(card.userChallenge?.progress_value ?? 0);
  const target = Number(card.definition.target_value ?? 0);

  if (card.userChallenge?.status === "completed") {
    return `Completed · ${target} target reached`;
  }

  if (card.userChallenge?.status === "expired") {
    return `${current} of ${target} done before expiry`;
  }

  if (card.userChallenge?.status === "active") {
    return `${current} of ${target} done`;
  }

  return `0 of ${target} done`;
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function getChallengeMeta(definition: ChallengeDefinition) {
  return `${definition.challenge_type} · ${definition.duration_type} · target ${definition.target_value}`;
}

function getEndsSoonText(endsAt: string | null | undefined) {
  if (!endsAt) return null;

  const now = Date.now();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return null;

  const diffMs = end - now;
  if (diffMs <= 0) return "Ended";

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} left`;
  }

  if (diffHours >= 1) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} left`;
  }

  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  return `${diffMinutes} min left`;
}

export default function ChallengesSection() {
  const t = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cards, setCards] = useState<ChallengeCard[]>([]);
  const [achievements, setAchievements] = useState<AchievementProgressCard[]>([]);
  const [mutationBusyId, setMutationBusyId] = useState<string | null>(null);
  const [mutationKind, setMutationKind] = useState<MutationKind | null>(null);

  const load = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCards([]);
      setAchievements([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [defsRes, userRes, achievementRows] = await Promise.all([
      supabase
        .from("challenge_definitions")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_challenges")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      getSkillAchievementProgressForUser(user.id),
    ]);

    const defs = (defsRes.data ?? []) as ChallengeDefinition[];
    const users = (userRes.data ?? []) as UserChallenge[];

    const userMap = new Map(users.map((item) => [item.challenge_id, item]));
    const nextCards: ChallengeCard[] = defs.map((definition) => {
      const userChallenge = userMap.get(definition.id) ?? null;
      const progressPercent = userChallenge
        ? Math.max(
          0,
          Math.min(
            100,
            (Number(userChallenge.progress_value) /
              Math.max(1, Number(definition.target_value))) *
            100
          )
        )
        : 0;

      return {
        definition,
        userChallenge,
        progressPercent,
      };
    });

    const sortedAchievements = [...achievementRows].sort((a, b) => {
      if (a.unlocked !== b.unlocked) return Number(b.unlocked) - Number(a.unlocked);
      return b.progressPercent - a.progressPercent;
    });

    setCards(nextCards);
    setAchievements(sortedAchievements);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSkillChallengesChanged(() => {
      void load();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  const createChallengeWindow = (durationType: string) => {
    const startsAt = new Date();
    const endsAt = new Date(startsAt);

    if (durationType === "daily") {
      endsAt.setDate(endsAt.getDate() + 1);
    } else if (durationType === "weekly") {
      endsAt.setDate(endsAt.getDate() + 7);
    } else {
      endsAt.setMonth(endsAt.getMonth() + 1);
    }

    return {
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    };
  };

  const handleJoinChallenge = async (
    challengeId: string,
    durationType: string,
    mode: MutationKind = "join"
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    try {
      setMutationBusyId(challengeId);
      setMutationKind(mode);

      const { starts_at, ends_at } = createChallengeWindow(durationType);

      const { error } = await supabase.from("user_challenges").insert({
        user_id: user.id,
        challenge_id: challengeId,
        progress_value: 0,
        status: "active",
        starts_at,
        ends_at,
      });

      if (error) throw error;

      await load();
    } catch (err: any) {
      Alert.alert(
        mode === "restart" ? "Could not restart challenge" : "Could not join challenge",
        err?.message ?? "Please try again."
      );
    } finally {
      setMutationBusyId(null);
      setMutationKind(null);
    }
  };

  const handleLeaveChallenge = async (userChallengeId: string) => {
    try {
      setMutationBusyId(userChallengeId);
      setMutationKind("leave");

      const { error } = await supabase
        .from("user_challenges")
        .update({ status: "expired" })
        .eq("id", userChallengeId);

      if (error) throw error;

      await load();
    } catch (err: any) {
      Alert.alert("Could not leave challenge", err?.message ?? "Please try again.");
    } finally {
      setMutationBusyId(null);
      setMutationKind(null);
    }
  };

  const activeCards = useMemo(
    () => cards.filter((c) => c.userChallenge?.status === "active"),
    [cards]
  );

  const availableCards = useMemo(
    () => cards.filter((c) => !c.userChallenge),
    [cards]
  );

  const finishedCards = useMemo(
    () =>
      cards.filter(
        (c) =>
          c.userChallenge?.status === "completed" ||
          c.userChallenge?.status === "expired"
      ),
    [cards]
  );

  const activeCount = activeCards.length;
  const completedCount = finishedCards.filter(
    (c) => c.userChallenge?.status === "completed"
  ).length;
  const unlockedAchievementCount = achievements.filter((a) => a.unlocked).length;

  const sectionedData = useMemo(() => {
    const result: SectionItem[] = [];

    if (activeCards.length > 0) {
      result.push({
        kind: "header",
        id: "section-active",
        title: "Active Challenges",
        subtitle: "Challenges you are currently working through.",
      });
      activeCards.forEach((card) =>
        result.push({
          kind: "challenge",
          id: `active-${card.definition.id}`,
          card,
        })
      );
    }

    if (availableCards.length > 0) {
      result.push({
        kind: "header",
        id: "section-available",
        title: "Available Challenges",
        subtitle: "Join one to start tracking progress.",
      });
      availableCards.forEach((card) =>
        result.push({
          kind: "challenge",
          id: `available-${card.definition.id}`,
          card,
        })
      );
    }

    if (finishedCards.length > 0) {
      result.push({
        kind: "header",
        id: "section-finished",
        title: "Completed & Expired",
        subtitle: "Finished challenges and failed attempts stay here.",
      });
      finishedCards.forEach((card) =>
        result.push({
          kind: "challenge",
          id: `finished-${card.definition.id}`,
          card,
        })
      );
    }

    return result;
  }, [activeCards, availableCards, finishedCards]);

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
        data={sectionedData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={[styles.header, { color: t.text }]}>Challenges</Text>

            <View style={styles.summaryGrid}>
              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: t.card, borderColor: t.border },
                ]}
              >
                <Text style={[styles.summaryValue, { color: t.text }]}>
                  {activeCount}
                </Text>
                <Text style={[styles.summaryLabel, { color: t.mutedText }]}>
                  Active right now
                </Text>
              </View>

              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: t.card, borderColor: t.border },
                ]}
              >
                <Text style={[styles.summaryValue, { color: t.text }]}>
                  {completedCount}
                </Text>
                <Text style={[styles.summaryLabel, { color: t.mutedText }]}>
                  Completed challenges
                </Text>
              </View>

              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: t.card, borderColor: t.border },
                ]}
              >
                <Text style={[styles.summaryValue, { color: t.text }]}>
                  {unlockedAchievementCount}
                </Text>
                <Text style={[styles.summaryLabel, { color: t.mutedText }]}>
                  Achievements unlocked
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: t.text }]}>Achievements</Text>

            {achievements.length > 0 ? (
              achievements.map((item) => (
                <View
                  key={item.definition.id}
                  style={[
                    styles.achievementCard,
                    { backgroundColor: t.card, borderColor: t.border },
                  ]}
                >
                  <Ionicons
                    name={item.unlocked ? "ribbon" : "ribbon-outline"}
                    size={18}
                    color={item.unlocked ? t.link : t.text}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.achievementTop}>
                      <Text style={[styles.achievementTitle, { color: t.text }]}>
                        {item.definition.name}
                      </Text>
                      <Text
                        style={[
                          styles.achievementState,
                          { color: item.unlocked ? t.link : t.mutedText },
                        ]}
                      >
                        {item.unlocked ? "Unlocked" : "Locked"}
                      </Text>
                    </View>

                    {item.definition.description ? (
                      <Text
                        style={[styles.achievementBody, { color: t.mutedText }]}
                      >
                        {item.definition.description}
                      </Text>
                    ) : null}

                    {!item.unlocked ? (
                      <>
                        <View
                          style={[
                            styles.progressTrack,
                            {
                              backgroundColor: t.cardAlt,
                              marginTop: 10,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${item.progressPercent}%`,
                                backgroundColor: t.link,
                              },
                            ]}
                          />
                        </View>

                        <Text
                          style={[styles.progressText, { color: t.mutedText }]}
                        >
                          {item.currentValue} of {item.targetValue} done
                        </Text>
                      </>
                    ) : (
                      <Text
                        style={[styles.achievementUnlockedText, { color: t.mutedText }]}
                      >
                        Ready and unlocked
                      </Text>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: t.card, borderColor: t.border },
                ]}
              >
                <Ionicons name="ribbon-outline" size={22} color={t.mutedText} />
                <Text style={[styles.emptyTitle, { color: t.text }]}>
                  No achievements yet
                </Text>
                <Text style={[styles.emptyBody, { color: t.mutedText }]}>
                  Your unlocked achievements will appear here.
                </Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: t.text, marginTop: 18 }]}>
              Challenge Board
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === "header") {
            return (
              <View style={styles.groupHeader}>
                <Text style={[styles.groupHeaderTitle, { color: t.text }]}>
                  {item.title}
                </Text>
                <Text style={[styles.groupHeaderSubtitle, { color: t.mutedText }]}>
                  {item.subtitle}
                </Text>
              </View>
            );
          }

          const card = item.card;
          const userChallenge = card.userChallenge;
          const status = userChallenge?.status ?? "available";
          const statusLabel = formatStatusLabel(status);
          const endsSoonText = getEndsSoonText(userChallenge?.ends_at);
          const joinBusy =
            mutationKind === "join" && mutationBusyId === card.definition.id;
          const restartBusy =
            mutationKind === "restart" && mutationBusyId === card.definition.id;
          const leaveBusy =
            mutationKind === "leave" && mutationBusyId === userChallenge?.id;

          return (
            <View
              style={[
                styles.card,
                { backgroundColor: t.card, borderColor: t.border },
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={[styles.cardTitle, { color: t.text }]}>
                  {card.definition.title}
                </Text>
                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: t.cardAlt, borderColor: t.border },
                  ]}
                >
                  <Text style={[styles.statusText, { color: t.text }]}>
                    {statusLabel}
                  </Text>
                </View>
              </View>

              {card.definition.description ? (
                <Text style={[styles.cardDesc, { color: t.mutedText }]}>
                  {card.definition.description}
                </Text>
              ) : null}

              <Text style={[styles.meta, { color: t.mutedText }]}>
                {getChallengeMeta(card.definition)}
              </Text>

              {userChallenge?.status === "active" && endsSoonText ? (
                <Text style={[styles.helperText, { color: t.mutedText }]}>
                  Started {formatDateLabel(userChallenge.starts_at)} · {endsSoonText}
                </Text>
              ) : userChallenge?.status === "completed" ? (
                <Text style={[styles.helperText, { color: t.mutedText }]}>
                  Completed on {formatDateLabel(userChallenge.completed_at)}
                </Text>
              ) : userChallenge?.status === "expired" ? (
                <Text style={[styles.helperText, { color: t.mutedText }]}>
                  Expired on {formatDateLabel(userChallenge.ends_at)}
                </Text>
              ) : null}

              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: t.cardAlt },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${card.progressPercent}%`,
                      backgroundColor: t.link,
                    },
                  ]}
                />
              </View>

              <Text style={[styles.progressText, { color: t.mutedText }]}>
                {formatProgressText(card)}
              </Text>

              {!userChallenge ? (
                <TouchableOpacity
                  activeOpacity={0.86}
                  disabled={joinBusy}
                  onPress={() =>
                    void handleJoinChallenge(
                      card.definition.id,
                      card.definition.duration_type,
                      "join"
                    )
                  }
                  style={[
                    styles.joinButton,
                    { backgroundColor: t.link, opacity: joinBusy ? 0.72 : 1 },
                  ]}
                >
                  {joinBusy ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.joinButtonText}>Join Challenge</Text>
                  )}
                </TouchableOpacity>
              ) : userChallenge.status === "active" ? (
                <TouchableOpacity
                  activeOpacity={0.86}
                  disabled={leaveBusy}
                  onPress={() => void handleLeaveChallenge(userChallenge.id)}
                  style={[
                    styles.leaveButton,
                    {
                      backgroundColor: t.cardAlt,
                      borderColor: t.border,
                      opacity: leaveBusy ? 0.72 : 1,
                    },
                  ]}
                >
                  {leaveBusy ? (
                    <ActivityIndicator size="small" color={t.text} />
                  ) : (
                    <Text style={[styles.leaveButtonText, { color: t.text }]}>
                      Leave Challenge
                    </Text>
                  )}
                </TouchableOpacity>
              ) : userChallenge.status === "expired" ? (
                <TouchableOpacity
                  activeOpacity={0.86}
                  disabled={restartBusy}
                  onPress={() =>
                    void handleJoinChallenge(
                      card.definition.id,
                      card.definition.duration_type,
                      "restart"
                    )
                  }
                  style={[
                    styles.joinButton,
                    { backgroundColor: t.link, opacity: restartBusy ? 0.72 : 1 },
                  ]}
                >
                  {restartBusy ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.joinButtonText}>Restart Challenge</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Ionicons name="trophy-outline" size={22} color={t.mutedText} />
            <Text style={[styles.emptyTitle, { color: t.text }]}>
              No challenges yet
            </Text>
            <Text style={[styles.emptyBody, { color: t.mutedText }]}>
              Active challenge definitions will show here once added.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  header: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  summaryGrid: {
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  summaryLabel: {
    marginTop: 6,
    fontSize: 13.5,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  achievementCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  achievementTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  achievementTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  achievementState: {
    fontSize: 12,
    fontWeight: "700",
  },
  achievementBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  achievementUnlockedText: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: "600",
  },
  groupHeader: {
    marginTop: 4,
    marginBottom: 10,
  },
  groupHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  groupHeaderSubtitle: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 18,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
  },
  statusChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  cardDesc: {
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 19,
  },
  meta: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  helperText: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 14,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressText: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: "600",
  },
  joinButton: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  joinButtonText: {
    color: "white",
    fontWeight: "800",
  },
  leaveButton: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveButtonText: {
    fontWeight: "800",
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
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
});
