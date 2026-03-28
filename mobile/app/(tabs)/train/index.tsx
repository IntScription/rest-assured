"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DraggableFlatList from "react-native-draggable-flatlist";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useLocalSearchParams, useRouter } from "expo-router";

import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { useIsOnline } from "@/hooks/use-is-online";
import { cacheGetJson, cacheKey, cacheSetJson } from "@/src/lib/offline-cache";
import {
  getOnboardingStep,
  isOnboardingActive,
  setOnboardingStep,
  stopOnboarding,
} from "@/src/lib/onboarding";
import OnboardingBanner from "@/src/components/OnboardingBanner";
import {
  publishActiveProgram,
  type Program as StoreProgram,
} from "@/src/store/active-program";

import type { Program, Split, ThemeType } from "@/src/features/train/types";
import {
  normalizeProgram,
  normalizeSplitOrder,
  getProgramAccent,
  getProgramInitials,
} from "@/src/features/train/utils";
import FancyModalShell from "@/src/features/train/components/FancyModalShell";
import {
  EmptyStateCard,
  SectionHeader,
  SectionShell,
} from "@/src/features/train/components/SectionShell";

type ProfileLite = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type PendingShare = {
  id: string;
  status: string;
  created_at: string | null;
  program_id: string | null;
  shared_by_user_id: string | null;
  program_name: string;
  sender_username: string | null;
};

type SentShare = {
  id: string;
  status: string;
  created_at: string | null;
  program_id: string | null;
  shared_with_user_id: string | null;
  program_name: string;
  receiver_username: string | null;
};

type RecentImport = {
  id: string;
  created_at: string | null;
  program_id: string | null;
  program_name: string;
  shared_by_user_id: string | null;
  shared_by_username: string | null;
};

type ProgramImport = {
  program_id: string;
  shared_by_user_id: string | null;
  shared_by_username: string | null;
};

type ShareSearchResult = {
  id: string;
  username: string;
  display_name?: string | null;
};

type ShareSearchStatus = "idle" | "searching" | "found" | "not_found";

type AcceptShareRpcResponse = {
  share_id: string;
  imported_program_id: string;
  import_id: string;
};

const CACHE_VERSION = "train-v11";
const SPLIT_ROW_HEIGHT = 62;

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const safeHaptics = {
  async selection() {
    try {
      const Haptics = await import("expo-haptics");
      await Haptics.selectionAsync();
    } catch { }
  },
  async impact(style: "light" | "medium" | "heavy" = "light") {
    try {
      const Haptics = await import("expo-haptics");
      const map = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      };
      await Haptics.impactAsync(map[style]);
    } catch { }
  },
  async notify(type: "success" | "warning" | "error" = "success") {
    try {
      const Haptics = await import("expo-haptics");
      const map = {
        success: Haptics.NotificationFeedbackType.Success,
        warning: Haptics.NotificationFeedbackType.Warning,
        error: Haptics.NotificationFeedbackType.Error,
      };
      await Haptics.notificationAsync(map[type]);
    } catch { }
  },
};

const splitItemLayout = (_data: unknown, index: number) => ({
  length: SPLIT_ROW_HEIGHT,
  offset: SPLIT_ROW_HEIGHT * index,
  index,
});

function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

function mergeUsernameDirectory(
  base: Record<string, string | null>,
  incoming: Record<string, string | null>
) {
  if (!incoming || Object.keys(incoming).length === 0) return base;

  const next = { ...base };
  for (const [id, username] of Object.entries(incoming)) {
    if (!id) continue;
    next[id] = username ?? null;
  }
  return next;
}

async function fetchUsernameMap(userIds: (string | null | undefined)[]) {
  const normalizedIds = Array.from(
    new Set(userIds.filter((value): value is string => Boolean(value)))
  );

  if (normalizedIds.length === 0) return {} as Record<string, string | null>;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", normalizedIds);

  if (error) return {} as Record<string, string | null>;

  const usernameMap: Record<string, string | null> = {};
  ((data ?? []) as { id: string; username: string | null }[]).forEach((row) => {
    usernameMap[row.id] = row.username ?? null;
  });

  return usernameMap;
}

function waitFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function waitMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getChevronButtonStyle(t: ThemeType) {
  return {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: t.cardAlt,
    borderWidth: 1,
    borderColor: t.border,
  };
}

function getPrimaryCtaStyle(t: ThemeType) {
  return {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: t.link,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
  };
}

function getSecondaryCtaStyle(t: ThemeType) {
  return {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: t.cardAlt,
    borderWidth: 1,
    borderColor: t.border,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
  };
}

function getStatusTone(status: string, t: ThemeType) {
  if (status === "accepted") {
    return {
      bg: "rgba(48,209,88,0.12)",
      border: "rgba(48,209,88,0.28)",
      text: "#30d158",
    };
  }
  if (status === "declined") {
    return {
      bg: "rgba(255,69,58,0.12)",
      border: "rgba(255,69,58,0.28)",
      text: "#ff453a",
    };
  }
  return { bg: t.cardAlt, border: t.border, text: t.text };
}

function formatRelativeTimestamp(value: string | null) {
  if (!value) return "";

  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return "";

  const diff = Date.now() - ms;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m ago`;
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))}h ago`;
  if (diff < 7 * day) return `${Math.max(1, Math.floor(diff / day))}d ago`;

  return new Date(value).toLocaleDateString();
}

function ProgramRowCard({
  program,
  isActive,
  splitCount,
  isImported,
  importedByUsername,
  busy,
  t,
  onPress,
  onManage,
  onShare,
  onEdit,
  onDelete,
}: {
  program: Program;
  isActive: boolean;
  splitCount: number;
  isImported: boolean;
  importedByUsername?: string | null;
  busy: boolean;
  t: ThemeType;
  onPress: () => void;
  onManage: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accent = getProgramAccent(program.id);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.9}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: 20,
        backgroundColor: isActive ? t.cardAlt : t.background,
        borderWidth: 1.2,
        borderColor: isActive ? t.link : t.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flex: 1,
          paddingRight: 8,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: accent.bg,
            marginRight: 12,
          }}
        >
          <Text style={{ color: accent.text, fontWeight: "800", fontSize: 13 }}>
            {getProgramInitials(program.name)}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{ color: t.text, fontSize: 16, fontWeight: "700" }}
            numberOfLines={1}
          >
            {program.name}
          </Text>

          <Text style={{ color: t.mutedText, marginTop: 5, fontSize: 12.5 }}>
            {isActive ? "Currently selected" : "Tap to select"}
          </Text>

          <Text style={{ color: t.mutedText, marginTop: 4, fontSize: 12.5 }}>
            {splitCount} {splitCount === 1 ? "split" : "splits"}
            {isImported
              ? ` · imported${importedByUsername ? ` from @${importedByUsername}` : ""}`
              : ""}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 10 }}>
        <TouchableOpacity
          onPress={onManage}
          hitSlop={10}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.card,
          }}
        >
          <Ionicons name="layers-outline" size={17} color={t.mutedText} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onShare}
          hitSlop={10}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.card,
          }}
        >
          <Ionicons name="share-social-outline" size={16} color={t.mutedText} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onEdit}
          hitSlop={10}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.card,
          }}
        >
          <Ionicons name="create-outline" size={16} color={t.mutedText} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDelete}
          hitSlop={10}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.card,
          }}
        >
          <Ionicons name="trash-outline" size={16} color="#ff453a" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function SplitSheetRow({
  item,
  displayOrder,
  busy,
  t,
  onDrag,
  onEdit,
  onDelete,
}: {
  item: Split;
  displayOrder: number;
  busy: boolean;
  t: ThemeType;
  onDrag: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accent = getProgramAccent(displayOrder);

  return (
    <TouchableOpacity
      onLongPress={onDrag}
      delayLongPress={135}
      disabled={busy}
      activeOpacity={0.92}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 18,
        marginBottom: 8,
        backgroundColor: t.cardAlt,
        borderWidth: 1,
        borderColor: t.border,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 10 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: accent.bg,
            marginRight: 10,
          }}
        >
          <Text style={{ color: accent.text, fontWeight: "800", fontSize: 11.5 }}>
            {String(displayOrder + 1).padStart(2, "0")}
          </Text>
        </View>

        <Text
          style={{ color: t.text, fontSize: 15, fontWeight: "700", flex: 1 }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TouchableOpacity
          onPress={onEdit}
          hitSlop={10}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.card,
          }}
        >
          <Ionicons name="create-outline" size={16} color={t.mutedText} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDelete}
          hitSlop={10}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.card,
          }}
        >
          <Ionicons name="trash-outline" size={16} color="#ff453a" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function TrainScreen() {
  const t = useAppTheme() as ThemeType;
  const isOnline = useIsOnline();
  const router = useRouter();
  const {
    importedFromGlobal,
    importedGlobalTitle,
    importedGlobalBy,
    importedGlobalId,
  } = useLocalSearchParams<{
    importedFromGlobal?: string;
    importedGlobalTitle?: string;
    importedGlobalBy?: string;
    importedGlobalId?: string;
  }>();

  const isDark =
    t.background === "#000000" ||
    t.background === "#0b0b0c" ||
    t.text === "#ffffff";

  const glowActiveBorder = isDark ? "rgba(10,132,255,0.42)" : "rgba(10,132,255,0.22)";
  const glowShareBorder = isDark ? "rgba(48,209,88,0.40)" : "rgba(48,209,88,0.20)";
  const glowActiveBg = isDark ? "rgba(10,132,255,0.10)" : "rgba(10,132,255,0.06)";
  const glowShareBg = isDark ? "rgba(48,209,88,0.10)" : "rgba(48,209,88,0.06)";

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState<string>("idle");
  const [tutorialProgramId, setTutorialProgramId] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(null);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [splitCountsByProgram, setSplitCountsByProgram] = useState<Record<string, number>>({});
  const [programImports, setProgramImports] = useState<Record<string, ProgramImport>>({});
  const [pendingShares, setPendingShares] = useState<PendingShare[]>([]);
  const [sentShares, setSentShares] = useState<SentShare[]>([]);
  const [recentImports, setRecentImports] = useState<RecentImport[]>([]);
  const [usernameDirectory, setUsernameDirectory] = useState<Record<string, string | null>>({});

  const [busy, setBusy] = useState(false);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [programsExpanded, setProgramsExpanded] = useState(true);
  const [programFilter, setProgramFilter] = useState<"all" | "own" | "imported">("all");
  const [globalImportBannerVisible, setGlobalImportBannerVisible] = useState(false);

  const [modal, setModal] = useState<{
    visible: boolean;
    type: "program" | "split";
    value: string;
    mode: "create" | "rename";
    targetId: string | null;
  }>({
    visible: false,
    type: "program",
    value: "",
    mode: "create",
    targetId: null,
  });

  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareProgram, setShareProgram] = useState<Program | null>(null);
  const [shareUsername, setShareUsername] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareSearchStatus, setShareSearchStatus] = useState<ShareSearchStatus>("idle");
  const [sharePreviewTarget, setSharePreviewTarget] = useState<ShareSearchResult | null>(null);

  const [sharedVisible, setSharedVisible] = useState(false);

  const [manageProgram, setManageProgram] = useState<Program | null>(null);
  const [manageSplits, setManageSplits] = useState<Split[]>([]);
  const [manageSplitsLoading, setManageSplitsLoading] = useState(false);

  const [splitTargetProgramId, setSplitTargetProgramId] = useState<string | null>(null);
  const [reopenManageProgramId, setReopenManageProgramId] = useState<string | null>(null);

  const programsRef = useRef<Program[]>([]);
  const manageSplitsReqId = useRef(0);
  const programsReqId = useRef(0);
  const shareSearchReqId = useRef(0);
  const usernameDirectoryRef = useRef<Record<string, string | null>>({});
  const prevPendingCountRef = useRef(0);
  const prevSentCountRef = useRef(0);
  const prevImportCountRef = useRef(0);

  useEffect(() => {
    programsRef.current = programs;
  }, [programs]);

  useEffect(() => {
    usernameDirectoryRef.current = usernameDirectory;
  }, [usernameDirectory]);

  useEffect(() => {
    const prevPending = prevPendingCountRef.current;
    const prevSent = prevSentCountRef.current;
    const prevImports = prevImportCountRef.current;

    if (
      pendingShares.length > prevPending ||
      sentShares.length > prevSent ||
      recentImports.length > prevImports
    ) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }

    prevPendingCountRef.current = pendingShares.length;
    prevSentCountRef.current = sentShares.length;
    prevImportCountRef.current = recentImports.length;
  }, [pendingShares.length, sentShares.length, recentImports.length]);

  const cacheId = useMemo(() => (userId ? cacheKey([CACHE_VERSION, userId]) : null), [userId]);

  const activeProgram = useMemo(
    () => programs.find((p) => p.id === activeProgramId) ?? null,
    [programs, activeProgramId]
  );

  const canSharePrograms = !!profile?.username;
  const canSubmitShare = shareSearchStatus === "found" && !!sharePreviewTarget && !shareBusy;
  const sharedBadgeCount = pendingShares.length;

  const stats = useMemo(() => {
    const importedCount = programs.filter((p) => !!programImports[p.id]).length;
    const totalSplits = Object.values(splitCountsByProgram).reduce((sum, count) => sum + count, 0);
    return {
      totalPrograms: programs.length,
      totalSplits,
      importedPrograms: importedCount,
      pendingShares: pendingShares.length,
    };
  }, [programs, programImports, splitCountsByProgram, pendingShares.length]);

  const filteredPrograms = useMemo(() => {
    let next = programs.filter((program) => {
      const isImported = !!programImports[program.id];
      return programFilter === "all"
        ? true
        : programFilter === "imported"
          ? isImported
          : !isImported;
    });

    next = [...next].sort((a, b) => {
      if (a.id === activeProgramId) return -1;
      if (b.id === activeProgramId) return 1;
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });

    return next;
  }, [programs, programFilter, programImports, activeProgramId]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadTour = async () => {
        const active = await isOnboardingActive();
        const step = await getOnboardingStep();

        if (!mounted) return;
        setTourActive(active);
        setTourStep(typeof step === "string" ? step : "idle");
      };

      void loadTour();

      return () => {
        mounted = false;
      };
    }, [])
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;

      if (error) {
        setScreenLoading(false);
        return;
      }

      const nextUserId = data?.user?.id ?? null;
      setUserId(nextUserId);

      if (nextUserId) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .eq("id", nextUserId)
          .maybeSingle();

        if (mounted) setProfile((profileData as ProfileLite | null) ?? null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (importedFromGlobal === "1") {
      setProgramsExpanded(true);
      setProgramFilter("imported");
      setGlobalImportBannerVisible(true);
    }
  }, [importedFromGlobal]);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("id", userId)
      .maybeSingle();
    setProfile((data as ProfileLite | null) ?? null);
  }, [userId]);

  const fetchSplitCounts = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("splits")
      .select("id, program_id")
      .eq("user_id", userId);

    if (error) return;

    const nextCounts: Record<string, number> = {};
    (data ?? []).forEach((item: any) => {
      const key = item.program_id as string;
      nextCounts[key] = (nextCounts[key] ?? 0) + 1;
    });

    setSplitCountsByProgram(nextCounts);
  }, [userId]);

  const fetchPrograms = useCallback(async () => {
    if (!userId) return;
    if (!isOnline && programsRef.current.length > 0) return;

    const rid = ++programsReqId.current;

    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (rid !== programsReqId.current || error) return;

    const list = ((data ?? []) as any[]).map((item) => normalizeProgram(item));
    setPrograms(list);

    setActiveProgramId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev;
      const dbActive = list.find((p) => p.is_active)?.id ?? null;
      if (dbActive) return dbActive;
      return list.length ? list[0].id : null;
    });
  }, [userId, isOnline]);

  const fetchSplitsForProgram = useCallback(
    async (programId: string) => {
      if (!userId || !programId) return [] as Split[];

      const rid = ++manageSplitsReqId.current;

      const { data, error } = await supabase
        .from("splits")
        .select("*")
        .eq("user_id", userId)
        .eq("program_id", programId)
        .order("order_index");

      if (rid !== manageSplitsReqId.current || error) return [] as Split[];

      return normalizeSplitOrder((data ?? []) as Split[]);
    },
    [userId]
  );

  const fetchProgramImports = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("program_imports")
      .select("program_id, shared_by_user_id")
      .eq("imported_by_user_id", userId);

    if (error) return;

    const rows = (data ?? []) as {
      program_id: string;
      shared_by_user_id: string | null;
    }[];

    const usernameMap = await fetchUsernameMap(rows.map((row) => row.shared_by_user_id));
    setUsernameDirectory((prev) => mergeUsernameDirectory(prev, usernameMap));

    const cachedDirectory = usernameDirectoryRef.current;
    const nextMap: Record<string, ProgramImport> = {};
    rows.forEach((row) => {
      nextMap[row.program_id] = {
        program_id: row.program_id,
        shared_by_user_id: row.shared_by_user_id ?? null,
        shared_by_username: row.shared_by_user_id
          ? usernameMap[row.shared_by_user_id] ?? cachedDirectory[row.shared_by_user_id] ?? null
          : null,
      };
    });

    setProgramImports(nextMap);
  }, [userId]);

  const fetchPendingShares = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("program_shares")
      .select(
        "id, status, created_at, program_id, shared_by_user_id, program_name_snapshot, shared_by_username_snapshot"
      )
      .eq("shared_with_user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) return;

    const rows = (data ?? []) as {
      id: string;
      status: string;
      created_at: string | null;
      program_id: string | null;
      shared_by_user_id: string | null;
      program_name_snapshot?: string | null;
      shared_by_username_snapshot?: string | null;
    }[];

    const missingUserIds = rows
      .filter((row) => !row.shared_by_username_snapshot && row.shared_by_user_id)
      .map((row) => row.shared_by_user_id);

    const usernameMap = await fetchUsernameMap(missingUserIds);
    setUsernameDirectory((prev) => mergeUsernameDirectory(prev, usernameMap));

    const cachedDirectory = usernameDirectoryRef.current;

    const localProgramNameMap = new Map(
      programsRef.current.map((program) => [program.id, program.name] as const)
    );

    const next = rows.map((row) => ({
      id: row.id,
      status: row.status,
      created_at: row.created_at ?? null,
      program_id: row.program_id ?? null,
      shared_by_user_id: row.shared_by_user_id ?? null,
      program_name:
        row.program_name_snapshot?.trim() ||
        (row.program_id ? localProgramNameMap.get(row.program_id) : null) ||
        "Program",
      sender_username:
        row.shared_by_username_snapshot?.trim() ||
        (row.shared_by_user_id
          ? usernameMap[row.shared_by_user_id] ?? cachedDirectory[row.shared_by_user_id] ?? null
          : null),
    })) as PendingShare[];

    setPendingShares(next);
  }, [userId]);

  const fetchSentShares = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("program_shares")
      .select(
        "id, status, created_at, program_id, shared_with_user_id, program_name_snapshot"
      )
      .eq("shared_by_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return;

    const rows = (data ?? []) as {
      id: string;
      status: string;
      created_at: string | null;
      program_id: string | null;
      shared_with_user_id: string | null;
      program_name_snapshot?: string | null;
    }[];

    const usernameMap = await fetchUsernameMap(rows.map((row) => row.shared_with_user_id));
    setUsernameDirectory((prev) => mergeUsernameDirectory(prev, usernameMap));

    const cachedDirectory = usernameDirectoryRef.current;
    const localProgramNameMap = new Map(
      programsRef.current.map((program) => [program.id, program.name] as const)
    );

    const next = rows.map((row) => ({
      id: row.id,
      status: row.status,
      created_at: row.created_at ?? null,
      program_id: row.program_id ?? null,
      shared_with_user_id: row.shared_with_user_id ?? null,
      program_name:
        row.program_name_snapshot?.trim() ||
        (row.program_id ? localProgramNameMap.get(row.program_id) : null) ||
        "Program",
      receiver_username: row.shared_with_user_id
        ? usernameMap[row.shared_with_user_id] ??
        cachedDirectory[row.shared_with_user_id] ??
        null
        : null,
    })) as SentShare[];

    setSentShares(next);
  }, [userId]);

  const fetchRecentImports = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("program_imports")
      .select("id, created_at, program_id, shared_by_user_id")
      .eq("imported_by_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) return;

    const rows = (data ?? []) as {
      id: string;
      created_at: string | null;
      program_id: string | null;
      shared_by_user_id: string | null;
    }[];

    const usernameMap = await fetchUsernameMap(rows.map((row) => row.shared_by_user_id));
    setUsernameDirectory((prev) => mergeUsernameDirectory(prev, usernameMap));

    const localProgramNameMap = new Map(
      programsRef.current.map((program) => [program.id, program.name] as const)
    );
    const cachedDirectory = usernameDirectoryRef.current;

    const next = rows.map((row) => ({
      id: row.id,
      created_at: row.created_at ?? null,
      program_id: row.program_id ?? null,
      shared_by_user_id: row.shared_by_user_id ?? null,
      program_name:
        (row.program_id ? localProgramNameMap.get(row.program_id) : null) || "Program",
      shared_by_username: row.shared_by_user_id
        ? usernameMap[row.shared_by_user_id] ??
        cachedDirectory[row.shared_by_user_id] ??
        null
        : null,
    })) as RecentImport[];

    setRecentImports(next);
  }, [userId]);

  const hydrateCacheThenFetch = useCallback(async () => {
    if (!userId || !cacheId) {
      setScreenLoading(false);
      return;
    }

    try {
      const cached = await cacheGetJson<{
        programs: Program[];
        activeProgramId: string | null;
        splitCountsByProgram?: Record<string, number>;
        pendingShares?: PendingShare[];
        sentShares?: SentShare[];
        recentImports?: RecentImport[];
        usernameDirectory?: Record<string, string | null>;
        programImports?: Record<string, ProgramImport>;
      }>(cacheId);

      if (cached?.programs?.length) setPrograms(cached.programs);
      if (cached?.activeProgramId) setActiveProgramId(cached.activeProgramId);
      if (cached?.splitCountsByProgram) setSplitCountsByProgram(cached.splitCountsByProgram);
      if (cached?.pendingShares) setPendingShares(cached.pendingShares);
      if (cached?.sentShares) setSentShares(cached.sentShares);
      if (cached?.recentImports) setRecentImports(cached.recentImports);
      if (cached?.usernameDirectory) setUsernameDirectory(cached.usernameDirectory);
      if (cached?.programImports) setProgramImports(cached.programImports);

      await Promise.all([
        fetchProfile(),
        fetchPrograms(),
        fetchSplitCounts(),
        fetchProgramImports(),
        fetchPendingShares(),
        fetchSentShares(),
        fetchRecentImports(),
      ]);
    } finally {
      setScreenLoading(false);
    }
  }, [
    userId,
    cacheId,
    fetchProfile,
    fetchPrograms,
    fetchSplitCounts,
    fetchProgramImports,
    fetchPendingShares,
    fetchSentShares,
    fetchRecentImports,
  ]);

  useEffect(() => {
    if (!userId) return;
    void hydrateCacheThenFetch();
  }, [userId, hydrateCacheThenFetch]);

  useEffect(() => {
    if (!userId || !cacheId) return;

    void cacheSetJson(cacheId, {
      programs,
      activeProgramId,
      splitCountsByProgram,
      pendingShares,
      sentShares,
      recentImports,
      usernameDirectory,
      programImports,
    });
  }, [
    userId,
    cacheId,
    programs,
    activeProgramId,
    splitCountsByProgram,
    pendingShares,
    sentShares,
    recentImports,
    usernameDirectory,
    programImports,
  ]);

  useEffect(() => {
    if (!userId) return;

    const incomingSharesChannel = supabase
      .channel(`program-shares-incoming:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "program_shares",
          filter: `shared_with_user_id=eq.${userId}`,
        },
        () => {
          void fetchPendingShares();
        }
      )
      .subscribe();

    const outgoingSharesChannel = supabase
      .channel(`program-shares-outgoing:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "program_shares",
          filter: `shared_by_user_id=eq.${userId}`,
        },
        () => {
          void fetchSentShares();
          void fetchPendingShares();
        }
      )
      .subscribe();

    const importsChannel = supabase
      .channel(`program-imports:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "program_imports",
          filter: `imported_by_user_id=eq.${userId}`,
        },
        () => {
          void fetchProgramImports();
          void fetchRecentImports();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(incomingSharesChannel);
      void supabase.removeChannel(outgoingSharesChannel);
      void supabase.removeChannel(importsChannel);
    };
  }, [userId, fetchPendingShares, fetchSentShares, fetchProgramImports, fetchRecentImports]);

  useEffect(() => {
    if (!shareModalVisible) {
      setShareSearchStatus("idle");
      setShareMessage(null);
      setSharePreviewTarget(null);
      return;
    }

    const clean = normalizeUsername(shareUsername);

    if (!clean) {
      setShareSearchStatus("idle");
      setShareMessage(null);
      setSharePreviewTarget(null);
      return;
    }

    const reqId = ++shareSearchReqId.current;
    setShareSearchStatus("searching");
    setShareMessage(null);
    setSharePreviewTarget(null);

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("search_profiles_by_username", {
          q: clean,
        });

        if (reqId !== shareSearchReqId.current) return;
        if (error) throw error;

        const matches = (data ?? []) as ShareSearchResult[];
        const exact = matches.find((item) => item.username === clean) ?? null;

        if (!exact) {
          setShareSearchStatus("not_found");
          setShareMessage("Username does not exist.");
          setSharePreviewTarget(null);
          return;
        }

        if (exact.id === userId) {
          setShareSearchStatus("not_found");
          setShareMessage("You cannot share a program with yourself.");
          setSharePreviewTarget(null);
          return;
        }

        setUsernameDirectory((prev) =>
          mergeUsernameDirectory(prev, { [exact.id]: exact.username })
        );
        setShareSearchStatus("found");
        setShareMessage(
          exact.display_name?.trim()
            ? `Found @${exact.username} · ${exact.display_name}`
            : `Found @${exact.username}`
        );
        setSharePreviewTarget(exact);
      } catch {
        if (reqId !== shareSearchReqId.current) return;
        setShareSearchStatus("not_found");
        setShareMessage("Could not verify username right now.");
        setSharePreviewTarget(null);
      }
    }, 320);

    return () => {
      clearTimeout(timer);
    };
  }, [shareModalVisible, shareUsername, userId]);

  const handleRefresh = useCallback(async () => {
    if (!userId) return;
    try {
      setRefreshing(true);
      await Promise.all([
        fetchProfile(),
        fetchPrograms(),
        fetchSplitCounts(),
        fetchProgramImports(),
        fetchPendingShares(),
        fetchSentShares(),
        fetchRecentImports(),
      ]);
      if (manageProgram?.id) {
        const next = await fetchSplitsForProgram(manageProgram.id);
        setManageSplits(next);
      }
    } finally {
      setRefreshing(false);
    }
  }, [
    userId,
    fetchProfile,
    fetchPrograms,
    fetchSplitCounts,
    fetchProgramImports,
    fetchPendingShares,
    fetchSentShares,
    fetchRecentImports,
    manageProgram?.id,
    fetchSplitsForProgram,
  ]);

  const toggleProgramsExpanded = useCallback(async () => {
    await safeHaptics.selection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setProgramsExpanded((prev) => !prev);
  }, []);

  const closeModal = useCallback(() => {
    setModal({
      visible: false,
      type: "program",
      value: "",
      mode: "create",
      targetId: null,
    });
    setSplitTargetProgramId(null);
  }, []);

  const openCreateProgram = useCallback(() => {
    void setOnboardingStep("create_program");
    setTourStep("create_program");
    setProgramsExpanded(true);
    setModal({
      visible: true,
      type: "program",
      value: "",
      mode: "create",
      targetId: null,
    });
  }, []);

  const openManageProgram = useCallback(
    async (program: Program) => {
      await safeHaptics.selection();

      const alreadyOpen = manageProgram?.id === program.id;
      if (alreadyOpen && manageSplits.length > 0) {
        setManageProgram(program);
        return;
      }

      setManageProgram(program);
      setManageSplitsLoading(true);
      const next = await fetchSplitsForProgram(program.id);
      setManageSplits(next);
      setManageSplitsLoading(false);
    },
    [fetchSplitsForProgram, manageProgram?.id, manageSplits.length]
  );

  const closeManageProgram = useCallback(() => {
    setManageProgram(null);
    setManageSplits([]);
    setManageSplitsLoading(false);
    setSplitTargetProgramId(null);
  }, []);

  const openCreateSplit = useCallback(
    async (programId?: string | null) => {
      const targetId = programId ?? manageProgram?.id ?? activeProgramId ?? null;

      if (!targetId) {
        Alert.alert("Select a program", "Create or choose a program first.");
        return;
      }

      const targetProgram =
        programs.find((p) => p.id === targetId) ?? manageProgram ?? activeProgram ?? null;

      if (!targetProgram) {
        Alert.alert("Program not found", "Please try again.");
        return;
      }

      const wasManageOpen = !!manageProgram?.id;

      if (wasManageOpen) {
        setReopenManageProgramId(targetId);
        closeManageProgram();
        await waitFrame();
        await waitMs(40);
      } else {
        setReopenManageProgramId(null);
      }

      setSplitTargetProgramId(targetId);

      void setOnboardingStep("create_split");
      setTourStep("create_split");

      setModal({
        visible: true,
        type: "split",
        value: "",
        mode: "create",
        targetId: null,
      });
    },
    [manageProgram, activeProgramId, activeProgram, programs, closeManageProgram]
  );

  const openRename = useCallback((item: Program | Split, type: "program" | "split") => {
    setModal({
      visible: true,
      type,
      value: item.name,
      mode: "rename",
      targetId: item.id,
    });
  }, []);

  const setActiveProgram = useCallback(
    async (program: Program) => {
      if (!userId || busy || program.id === activeProgramId) return;

      const previousPrograms = programsRef.current;
      const normalized = normalizeProgram({ ...program, is_active: true });

      setPrograms((prev) =>
        prev.map((item) => ({
          ...item,
          is_active: item.id === program.id,
        }))
      );
      setActiveProgramId(program.id);
      publishActiveProgram(normalized as StoreProgram);

      try {
        setBusy(true);

        const { error: offError } = await supabase
          .from("programs")
          .update({ is_active: false })
          .eq("user_id", userId);

        if (offError) throw offError;

        const { error: onError } = await supabase
          .from("programs")
          .update({ is_active: true })
          .eq("user_id", userId)
          .eq("id", program.id);

        if (onError) throw onError;

        await safeHaptics.notify("success");
      } catch (e: any) {
        setPrograms(previousPrograms);
        setActiveProgramId(previousPrograms.find((item) => item.is_active)?.id ?? null);
        publishActiveProgram(
          (previousPrograms.find((item) => item.is_active) ?? null) as StoreProgram | null
        );
        Alert.alert("Could not select program", String(e?.message ?? "Unknown error"));
        await fetchPrograms();
      } finally {
        setBusy(false);
      }
    },
    [userId, busy, activeProgramId, fetchPrograms]
  );

  const handleModalConfirm = useCallback(async () => {
    if (!userId || busy) return;

    const name = modal.value.trim();
    if (!name) {
      Alert.alert("Name required", "Please enter a valid name.");
      return;
    }

    Keyboard.dismiss();

    try {
      setBusy(true);

      if (modal.mode === "rename" && modal.targetId) {
        if (modal.type === "program") {
          const { data, error } = await supabase
            .from("programs")
            .update({ name })
            .eq("user_id", userId)
            .eq("id", modal.targetId)
            .select()
            .single();

          if (error) throw error;

          setPrograms((prev) =>
            prev.map((p) =>
              p.id === modal.targetId ? normalizeProgram((data ?? p) as any) : p
            )
          );

          closeModal();
          return;
        }

        const targetProgramId = manageProgram?.id ?? reopenManageProgramId ?? splitTargetProgramId;

        const { data, error } = await supabase
          .from("splits")
          .update({ name })
          .eq("user_id", userId)
          .eq("id", modal.targetId)
          .select()
          .single();

        if (error) throw error;

        setManageSplits((prev) =>
          prev.map((s) => (s.id === modal.targetId ? { ...s, name: data?.name ?? name } : s))
        );

        if (targetProgramId) {
          const targetProgram = programsRef.current.find((p) => p.id === targetProgramId) ?? null;
          if (targetProgram) {
            const fresh = await fetchSplitsForProgram(targetProgramId);
            setManageProgram(targetProgram);
            setManageSplits(fresh);
          }
        }

        closeModal();
        return;
      }

      if (modal.type === "program") {
        const { error: offError } = await supabase
          .from("programs")
          .update({ is_active: false })
          .eq("user_id", userId);

        if (offError) throw offError;

        const { data, error } = await supabase
          .from("programs")
          .insert([{ name, is_active: true, user_id: userId }])
          .select()
          .single();

        if (error) throw error;

        const createdProgram = normalizeProgram((data ?? {}) as any);

        setPrograms((prev) =>
          [...prev, createdProgram].map((p) => ({
            ...p,
            is_active: p.id === createdProgram.id,
          }))
        );

        setActiveProgramId(createdProgram.id);
        publishActiveProgram(createdProgram as StoreProgram);
        await fetchSplitCounts();

        if (await isOnboardingActive()) {
          setTutorialProgramId(createdProgram.id);
          await setOnboardingStep("create_split");
          setTourStep("create_split");
        }

        closeModal();
        return;
      }

      const targetProgramId = splitTargetProgramId ?? manageProgram?.id ?? activeProgramId;

      if (!targetProgramId) {
        Alert.alert("Select a program", "Create or choose a program first.");
        return;
      }

      const currentSplitCount = splitCountsByProgram[targetProgramId] ?? 0;

      const { data, error } = await supabase
        .from("splits")
        .insert([
          {
            name,
            program_id: targetProgramId,
            order_index: currentSplitCount,
            user_id: userId,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setSplitCountsByProgram((prev) => ({
        ...prev,
        [targetProgramId]: (prev[targetProgramId] ?? 0) + 1,
      }));

      if (await isOnboardingActive()) {
        await setOnboardingStep("go_home");
        setTourStep("go_home");
      }

      const shouldReopenProgramId = reopenManageProgramId ?? targetProgramId;

      closeModal();

      if (shouldReopenProgramId) {
        await waitFrame();
        await waitMs(40);

        const targetProgram =
          programsRef.current.find((p) => p.id === shouldReopenProgramId) ?? null;

        if (targetProgram) {
          setManageProgram(targetProgram);
          setManageSplitsLoading(true);
          const fresh = await fetchSplitsForProgram(shouldReopenProgramId);
          setManageSplits(fresh);
          setManageSplitsLoading(false);
        }
      }

      setReopenManageProgramId(null);
      setSplitTargetProgramId(null);

      if (data) {
        await safeHaptics.notify("success");
      }
    } catch (e: any) {
      Alert.alert("Action failed", String(e?.message ?? "Unknown error"));
      await fetchPrograms();
      await fetchSplitCounts();

      const fallbackProgramId =
        reopenManageProgramId ?? splitTargetProgramId ?? manageProgram?.id ?? null;

      if (fallbackProgramId) {
        const targetProgram =
          programsRef.current.find((p) => p.id === fallbackProgramId) ?? null;
        if (targetProgram) {
          const fresh = await fetchSplitsForProgram(fallbackProgramId);
          setManageProgram(targetProgram);
          setManageSplits(fresh);
        }
      }

      setReopenManageProgramId(null);
      setSplitTargetProgramId(null);
    } finally {
      setBusy(false);
    }
  }, [
    userId,
    busy,
    modal,
    manageProgram?.id,
    activeProgramId,
    splitTargetProgramId,
    reopenManageProgramId,
    splitCountsByProgram,
    closeModal,
    fetchPrograms,
    fetchSplitCounts,
    fetchSplitsForProgram,
  ]);

  const deleteItem = useCallback(
    async (id: string, type: "program" | "split") => {
      if (!userId || busy) return;

      const title = type === "program" ? "Delete program?" : "Delete split?";
      const message =
        type === "program"
          ? "This will remove the program and all of its splits."
          : "This will remove the split.";

      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy(true);

              if (type === "program") {
                const currentPrograms = programsRef.current;
                const nextPrograms = currentPrograms.filter((p) => p.id !== id);
                const deletedWasActive = activeProgramId === id;
                const nextActiveId = deletedWasActive
                  ? nextPrograms[0]?.id ?? null
                  : activeProgramId;

                setPrograms(nextPrograms);
                setActiveProgramId(nextActiveId);

                if (deletedWasActive) {
                  const nextActiveProgram =
                    nextPrograms.find((p) => p.id === nextActiveId) ?? null;
                  publishActiveProgram(
                    nextActiveProgram
                      ? (normalizeProgram(nextActiveProgram) as StoreProgram)
                      : null
                  );
                }

                if (manageProgram?.id === id) {
                  setManageProgram(null);
                  setManageSplits([]);
                  setSplitTargetProgramId(null);
                  setReopenManageProgramId(null);
                }

                const { error } = await supabase
                  .from("programs")
                  .delete()
                  .eq("user_id", userId)
                  .eq("id", id);

                if (error) throw error;

                if (nextPrograms.length > 0 && nextActiveId) {
                  await supabase
                    .from("programs")
                    .update({ is_active: false })
                    .eq("user_id", userId);

                  await supabase
                    .from("programs")
                    .update({ is_active: true })
                    .eq("user_id", userId)
                    .eq("id", nextActiveId);

                  setPrograms((prev) =>
                    prev.map((p) => ({
                      ...p,
                      is_active: p.id === nextActiveId,
                    }))
                  );

                  const nextActiveProgram =
                    nextPrograms.find((p) => p.id === nextActiveId) ?? null;
                  publishActiveProgram(
                    nextActiveProgram
                      ? (normalizeProgram(nextActiveProgram) as StoreProgram)
                      : null
                  );
                }

                await fetchSplitCounts();
                await fetchProgramImports();
                await fetchRecentImports();
                return;
              }

              const targetProgramId =
                manageProgram?.id ?? reopenManageProgramId ?? splitTargetProgramId;
              const nextSplits = normalizeSplitOrder(manageSplits.filter((s) => s.id !== id));
              setManageSplits(nextSplits);

              const { error } = await supabase
                .from("splits")
                .delete()
                .eq("user_id", userId)
                .eq("id", id);

              if (error) throw error;

              if (nextSplits.length > 0) {
                await Promise.all(
                  nextSplits.map((item) =>
                    supabase
                      .from("splits")
                      .update({ order_index: item.order_index })
                      .eq("user_id", userId)
                      .eq("id", item.id)
                  )
                );
              }

              if (targetProgramId) {
                setSplitCountsByProgram((prev) => ({
                  ...prev,
                  [targetProgramId]: Math.max(0, (prev[targetProgramId] ?? 1) - 1),
                }));
              }
            } catch (e: any) {
              Alert.alert("Delete failed", String(e?.message ?? "Unknown error"));
              await fetchPrograms();
              await fetchSplitCounts();
              await fetchRecentImports();
              if (manageProgram?.id) {
                const fresh = await fetchSplitsForProgram(manageProgram.id);
                setManageSplits(fresh);
              }
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [
      userId,
      busy,
      activeProgramId,
      manageProgram?.id,
      manageSplits,
      reopenManageProgramId,
      splitTargetProgramId,
      fetchPrograms,
      fetchSplitCounts,
      fetchProgramImports,
      fetchRecentImports,
      fetchSplitsForProgram,
    ]
  );

  const handleDragBegin = useCallback(async () => {
    await safeHaptics.impact("light");
  }, []);

  const handleDragRelease = useCallback(async () => {
    await safeHaptics.selection();
  }, []);

  const handleSplitDragEnd = useCallback(
    async ({ data }: { data: Split[] }) => {
      const ordered = normalizeSplitOrder(data);
      const previousSplits = manageSplits;

      setManageSplits(ordered);

      try {
        if (!userId) return;

        const updates = ordered.map((item) =>
          supabase
            .from("splits")
            .update({ order_index: item.order_index })
            .eq("id", item.id)
            .eq("user_id", userId)
        );

        await Promise.all(updates);
      } catch (e: any) {
        setManageSplits(previousSplits);
        Alert.alert("Could not reorder splits", String(e?.message ?? "Unknown error"));
        if (manageProgram?.id) {
          const fresh = await fetchSplitsForProgram(manageProgram.id);
          setManageSplits(fresh);
        }
      }
    },
    [userId, manageProgram?.id, manageSplits, fetchSplitsForProgram]
  );

  const renderManageSplitItem = useCallback(
    ({ item, drag }: { item: Split; drag: () => void; isActive: boolean }) => (
      <SplitSheetRow
        item={item}
        displayOrder={item.order_index}
        busy={busy}
        t={t}
        onDrag={drag}
        onEdit={() => openRename(item, "split")}
        onDelete={() => void deleteItem(item.id, "split")}
      />
    ),
    [busy, t, openRename, deleteItem]
  );

  const openShareForProgram = useCallback(
    (program: Program) => {
      if (!profile?.username) {
        Alert.alert("Username required", "Set a username in Profile before sharing programs.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Go to Profile",
            onPress: () => router.push("/profile"),
          },
        ]);
        return;
      }

      setShareProgram(program);
      setShareUsername("");
      setShareMessage(null);
      setShareSearchStatus("idle");
      setSharePreviewTarget(null);
      setShareModalVisible(true);
    },
    [profile?.username, router]
  );

  const closeShareModal = useCallback(() => {
    setShareModalVisible(false);
    setShareProgram(null);
    setShareUsername("");
    setShareMessage(null);
    setShareSearchStatus("idle");
    setSharePreviewTarget(null);
  }, []);

  const sendShare = useCallback(async () => {
    if (!userId || !shareProgram || !profile?.username) return;

    const clean = normalizeUsername(shareUsername);
    if (!clean) {
      setShareMessage("Enter a valid username.");
      setShareSearchStatus("not_found");
      setSharePreviewTarget(null);
      return;
    }

    try {
      setShareBusy(true);

      let target = sharePreviewTarget;

      if (!target || target.username !== clean) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .eq("username", clean)
          .maybeSingle();

        if (error) throw error;

        target = data as ShareSearchResult | null;
        if (target && target.id === userId) target = null;
      }

      if (!target) {
        setShareSearchStatus("not_found");
        setShareMessage("User does not exist.");
        setSharePreviewTarget(null);
        return;
      }

      if (target.id === userId) {
        setShareSearchStatus("not_found");
        setShareMessage("You cannot share a program with yourself.");
        setSharePreviewTarget(null);
        return;
      }

      const { error: shareError } = await supabase.from("program_shares").insert([
        {
          program_id: shareProgram.id,
          shared_by_user_id: userId,
          shared_with_user_id: target.id,
          status: "pending",
          program_name_snapshot: shareProgram.name,
          shared_by_username_snapshot: profile.username,
        },
      ]);

      if (shareError) {
        if (String(shareError.message).toLowerCase().includes("duplicate")) {
          setShareSearchStatus("not_found");
          setShareMessage("A pending request already exists for this user.");
          return;
        }
        throw shareError;
      }

      setUsernameDirectory((prev) =>
        mergeUsernameDirectory(prev, { [target.id]: target.username })
      );

      const optimisticSentShare: SentShare = {
        id: `optimistic-${shareProgram.id}-${target.id}-${Date.now()}`,
        status: "pending",
        created_at: new Date().toISOString(),
        program_id: shareProgram.id,
        shared_with_user_id: target.id,
        program_name: shareProgram.name,
        receiver_username: target.username,
      };

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSentShares((prev) => [optimisticSentShare, ...prev].slice(0, 20));
      setSharedVisible(true);

      await safeHaptics.notify("success");
      setShareSearchStatus("found");
      setSharePreviewTarget(target);
      setShareMessage(`Shared with @${target.username}`);
      void fetchSentShares();

      Toast.show({
        type: "success",
        text1: "Program shared",
        text2: "Program structure was shared without logs.",
      });

      setTimeout(() => {
        closeShareModal();
      }, 700);
    } catch (e: any) {
      setShareSearchStatus("not_found");
      setShareMessage(e?.message ?? "Could not share program");
    } finally {
      setShareBusy(false);
    }
  }, [
    userId,
    shareProgram,
    profile?.username,
    shareUsername,
    sharePreviewTarget,
    fetchSentShares,
    closeShareModal,
  ]);

  const handleAcceptShare = useCallback(
    async (shareId: string) => {
      try {
        setBusy(true);

        const { data, error } = await supabase
          .rpc("accept_program_share", {
            p_share_id: shareId,
          })
          .single<AcceptShareRpcResponse>();

        if (error) throw error;

        const importedProgramId = data?.imported_program_id ?? null;

        await safeHaptics.notify("success");
        const refreshedProgramsPromise = fetchPrograms();

        await Promise.all([
          fetchPendingShares(),
          fetchSentShares(),
          refreshedProgramsPromise,
          fetchProgramImports(),
          fetchSplitCounts(),
          fetchRecentImports(),
        ]);

        if (importedProgramId) {
          const { data: importedProgramData } = await supabase
            .from("programs")
            .select("*")
            .eq("user_id", userId)
            .eq("id", importedProgramId)
            .maybeSingle();

          const normalizedImported = importedProgramData
            ? (normalizeProgram({ ...importedProgramData, is_active: true }) as StoreProgram)
            : null;

          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setPrograms((prev) =>
            prev.map((program) => ({
              ...program,
              is_active: program.id === importedProgramId,
            }))
          );
          setActiveProgramId(importedProgramId);
          publishActiveProgram(normalizedImported);
          setProgramsExpanded(true);
        }

        setSharedVisible(true);

        Toast.show({
          type: "success",
          text1: "Program imported",
          text2: "The shared program, splits, and exercises were added.",
        });
      } catch (e: any) {
        Alert.alert("Accept failed", e?.message ?? "Could not accept share");
      } finally {
        setBusy(false);
      }
    },
    [fetchPendingShares, fetchSentShares, fetchPrograms, fetchProgramImports, fetchSplitCounts, fetchRecentImports, userId]
  );

  const handleDeclineShare = useCallback(
    async (shareId: string) => {
      try {
        setBusy(true);

        const { error } = await supabase.rpc("decline_program_share", {
          p_share_id: shareId,
        });

        if (error) throw error;

        await safeHaptics.notify("success");
        await Promise.all([fetchPendingShares(), fetchSentShares()]);
      } catch (e: any) {
        Alert.alert("Decline failed", e?.message ?? "Could not decline share");
      } finally {
        setBusy(false);
      }
    },
    [fetchPendingShares, fetchSentShares]
  );

  if (screenLoading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === "android"}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {tourActive && (tourStep === "profile_intro" || tourStep === "create_program") ? (
          <View style={{ marginBottom: 14 }}>
            <OnboardingBanner
              t={t}
              title="Start here"
              body="Create your first program. Then open it and add at least one split so Home has structure."
              primaryLabel="Create program"
              onPrimary={openCreateProgram}
              secondaryLabel="Skip tour"
              onSecondary={async () => {
                await stopOnboarding();
                setTourActive(false);
                setTourStep("done");
              }}
            />
          </View>
        ) : null}

        {tourActive && tourStep === "create_split" ? (
          <View style={{ marginBottom: 14 }}>
            <OnboardingBanner
              t={t}
              title="Now add a split"
              body="Open your program manager and add a split like Push, Pull, Legs, Upper, or Lower."
              primaryLabel="Open active program"
              onPrimary={() => {
                if (activeProgram) {
                  void openManageProgram(activeProgram);
                }
              }}
            />
          </View>
        ) : null}

        {tourActive && tourStep === "go_home" ? (
          <View style={{ marginBottom: 14 }}>
            <OnboardingBanner
              t={t}
              title="Nice work"
              body="Your structure is ready. Go back to Home and add your first exercise."
              primaryLabel="Go to Home"
              onPrimary={() =>
                router.push({
                  pathname: "/(tabs)",
                  params: tutorialProgramId
                    ? {
                      tutorialProgramId,
                      programId: tutorialProgramId,
                    }
                    : undefined,
                })
              }
            />
          </View>
        ) : null}

        <SectionShell t={t}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={[
                styles.compactGlowCard,
                {
                  flex: 1,
                  borderColor: glowActiveBorder,
                  backgroundColor: glowActiveBg,
                },
              ]}
            >
              <Text style={[styles.compactGlowLabel, { color: t.mutedText }]}>
                Active program
              </Text>
              <Text style={[styles.compactGlowValue, { color: t.text }]} numberOfLines={1}>
                {activeProgram?.name ?? "None"}
              </Text>
            </View>

            <View
              style={[
                styles.compactGlowCard,
                {
                  flex: 1,
                  borderColor: canSharePrograms ? glowShareBorder : t.border,
                  backgroundColor: canSharePrograms ? glowShareBg : t.cardAlt,
                },
              ]}
            >
              <Text style={[styles.compactGlowLabel, { color: t.mutedText }]}>
                Sharing
              </Text>
              <Text style={[styles.compactGlowValue, { color: t.text }]} numberOfLines={1}>
                {canSharePrograms ? `@${profile?.username}` : "Set username"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setSharedVisible(true)}
              activeOpacity={0.8}
              hitSlop={10}
              style={[getChevronButtonStyle(t), styles.sharedActivityButton]}
            >
              <Ionicons name="share-social-outline" size={18} color={t.text} />
              {sharedBadgeCount > 0 ? (
                <View style={styles.sharedBadge}>
                  <Text style={styles.sharedBadgeText}>
                    {sharedBadgeCount > 9 ? "9+" : sharedBadgeCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            <View style={[styles.statChip, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
              <Text style={[styles.statChipValue, { color: t.text }]}>{stats.totalPrograms}</Text>
              <Text style={[styles.statChipLabel, { color: t.mutedText }]}>Programs</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
              <Text style={[styles.statChipValue, { color: t.text }]}>{stats.totalSplits}</Text>
              <Text style={[styles.statChipLabel, { color: t.mutedText }]}>Splits</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
              <Text style={[styles.statChipValue, { color: t.text }]}>{stats.importedPrograms}</Text>
              <Text style={[styles.statChipLabel, { color: t.mutedText }]}>Imported</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
              <Text style={[styles.statChipValue, { color: t.text }]}>{stats.pendingShares}</Text>
              <Text style={[styles.statChipLabel, { color: t.mutedText }]}>Pending</Text>
            </View>
          </View>

          {!canSharePrograms ? (
            <TouchableOpacity
              onPress={() => router.push("/profile")}
              activeOpacity={0.85}
              style={getPrimaryCtaStyle(t)}
            >
              <Ionicons name="person-circle-outline" size={18} color="white" />
              <Text style={styles.primaryCtaText}>Set Username in Profile</Text>
            </TouchableOpacity>
          ) : null}
        </SectionShell>

        {globalImportBannerVisible ? (
          <SectionShell t={t}>
            <View
              style={{
                borderWidth: 1,
                borderColor: glowShareBorder,
                backgroundColor: glowShareBg,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 14,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: t.cardAlt,
                  borderWidth: 1,
                  borderColor: t.border,
                }}
              >
                <Ionicons name="globe-outline" size={18} color={t.text} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 15, fontWeight: "800" }}>
                  Imported from Global
                </Text>
                <Text
                  style={{
                    color: t.mutedText,
                    marginTop: 4,
                    fontSize: 13.5,
                    lineHeight: 19,
                  }}
                >
                  {importedGlobalTitle
                    ? `${importedGlobalTitle}${importedGlobalBy ? ` by @${importedGlobalBy}` : ""} was added to your Train programs.`
                    : "A global program was added to your Train programs."}
                </Text>

                {importedGlobalId ? (
                  <Text
                    style={{
                      color: t.mutedText,
                      marginTop: 6,
                      fontSize: 12.5,
                      fontWeight: "600",
                    }}
                  >
                    It is now shown under Imported programs.
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={() => setGlobalImportBannerVisible(false)}
                hitSlop={10}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={18} color={t.mutedText} />
              </TouchableOpacity>
            </View>
          </SectionShell>
        ) : null}

        <SectionShell t={t}>
          <SectionHeader
            title="Programs"
            subtitle="Tap a program to activate. Imported global programs appear here too."
            t={t}
            action={
              <TouchableOpacity
                onPress={toggleProgramsExpanded}
                activeOpacity={0.8}
                hitSlop={10}
                style={getChevronButtonStyle(t)}
              >
                <Ionicons
                  name={programsExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={t.text}
                />
              </TouchableOpacity>
            }
          />

          {programsExpanded ? (
            <>
              {programs.length > 0 ? (
                <>
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {(["all", "own", "imported"] as const).map((item) => {
                      const selected = programFilter === item;
                      return (
                        <TouchableOpacity
                          key={item}
                          onPress={() => setProgramFilter(item)}
                          activeOpacity={0.82}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 9,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: selected ? t.link : t.border,
                            backgroundColor: selected ? t.cardAlt : t.card,
                          }}
                        >
                          <Text style={{ color: t.text, fontWeight: "700", fontSize: 13 }}>
                            {item === "all" ? "All" : item === "own" ? "Own" : "Imported"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={{ gap: 10 }}>
                    {filteredPrograms.map((program) => {
                      const isActive = program.id === activeProgramId;
                      const splitCount = splitCountsByProgram[program.id] ?? 0;
                      const importedMeta = programImports[program.id];

                      return (
                        <ProgramRowCard
                          key={program.id}
                          program={program}
                          isActive={isActive}
                          splitCount={splitCount}
                          isImported={!!importedMeta}
                          importedByUsername={importedMeta?.shared_by_username ?? null}
                          busy={busy}
                          t={t}
                          onPress={() => setActiveProgram(program)}
                          onManage={() => void openManageProgram(program)}
                          onShare={() => openShareForProgram(program)}
                          onEdit={() => openRename(program, "program")}
                          onDelete={() => void deleteItem(program.id, "program")}
                        />
                      );
                    })}
                  </View>
                </>
              ) : (
                <EmptyStateCard
                  icon="albums-outline"
                  title="No programs yet"
                  message="Create your first training program to organize your splits, logs, and progress."
                  actionLabel="Create Program"
                  onAction={openCreateProgram}
                  t={t}
                />
              )}

              <TouchableOpacity
                onPress={openCreateProgram}
                disabled={busy}
                activeOpacity={0.85}
                style={getPrimaryCtaStyle(t)}
              >
                <Ionicons name="add" size={18} color="white" />
                <Text style={styles.primaryCtaText}>Create Program</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </SectionShell>
      </ScrollView>

      <FancyModalShell
        visible={modal.visible}
        onClose={closeModal}
        title={
          modal.mode === "create"
            ? modal.type === "program"
              ? "Create program"
              : "Create split"
            : modal.type === "program"
              ? "Rename program"
              : "Rename split"
        }
        subtitle={
          modal.type === "program"
            ? "Programs are your top-level training containers."
            : "Splits are the training days inside the selected program."
        }
        t={t}
        enableSwipeDismiss
        showCloseButton={false}
      >
        <TextInput
          value={modal.value}
          onChangeText={(value) => setModal((prev) => ({ ...prev, value }))}
          autoFocus
          placeholder={modal.type === "program" ? "Push Pull Legs" : "Push"}
          placeholderTextColor={t.mutedText}
          style={{
            borderWidth: 1,
            borderColor: t.inputBorder,
            backgroundColor: t.inputBg,
            color: t.text,
            borderRadius: 18,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            fontWeight: "600",
          }}
          returnKeyType="done"
          onSubmitEditing={() => void handleModalConfirm()}
        />

        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <TouchableOpacity
            onPress={closeModal}
            activeOpacity={0.85}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: t.border,
              backgroundColor: t.cardAlt,
            }}
          >
            <Text style={{ color: t.text, fontWeight: "800" }}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => void handleModalConfirm()}
            disabled={busy}
            activeOpacity={0.85}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 14,
              borderRadius: 16,
              backgroundColor: t.link,
              opacity: busy ? 0.65 : 1,
            }}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>
              {modal.mode === "create" ? "Create" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      </FancyModalShell>

      <FancyModalShell
        visible={!!manageProgram}
        onClose={closeManageProgram}
        title={manageProgram?.name ?? "Program"}
        subtitle="Add, rename, delete, or long press a split to reorder"
        t={t}
        enableSwipeDismiss
        showCloseButton={false}
      >
        {manageSplitsLoading ? (
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <ActivityIndicator size="small" color={t.text} />
          </View>
        ) : manageSplits.length === 0 ? (
          <EmptyStateCard
            icon="layers-outline"
            title="No splits yet"
            message="Add the first split for this program."
            actionLabel="Add Split"
            onAction={() => void openCreateSplit(manageProgram?.id)}
            t={t}
          />
        ) : (
          <DraggableFlatList
            data={manageSplits}
            keyExtractor={(item) => item.id}
            onDragBegin={() => void handleDragBegin()}
            onRelease={() => void handleDragRelease()}
            onDragEnd={handleSplitDragEnd}
            renderItem={renderManageSplitItem}
            getItemLayout={splitItemLayout}
            activationDistance={10}
            autoscrollThreshold={64}
            autoscrollSpeed={150}
            dragItemOverflow={false}
            nestedScrollEnabled={false}
            removeClippedSubviews={Platform.OS === "android"}
            initialNumToRender={10}
            maxToRenderPerBatch={8}
            windowSize={6}
            updateCellsBatchingPeriod={35}
            contentContainerStyle={{ paddingBottom: 4 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        {manageSplits.length > 0 ? (
          <TouchableOpacity
            onPress={() => void openCreateSplit(manageProgram?.id)}
            disabled={busy || !manageProgram?.id}
            activeOpacity={0.85}
            style={[
              getSecondaryCtaStyle(t),
              (!manageProgram?.id || busy) && { opacity: 0.55 },
            ]}
          >
            <Ionicons name="add" size={18} color={t.text} />
            <Text style={[styles.secondaryCtaText, { color: t.text }]}>Add Split</Text>
          </TouchableOpacity>
        ) : null}
      </FancyModalShell>

      <FancyModalShell
        visible={shareModalVisible}
        onClose={closeShareModal}
        title="Share program"
        subtitle={
          shareProgram
            ? `Share "${shareProgram.name}" with another user. Program structure only — no logs.`
            : "Share a program with another user."
        }
        t={t}
        enableSwipeDismiss
        showCloseButton={false}
      >
        <TextInput
          value={shareUsername}
          onChangeText={(value) => {
            setShareUsername(value);
          }}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Enter username"
          placeholderTextColor={t.mutedText}
          style={{
            borderWidth: 1,
            borderColor:
              shareSearchStatus === "found"
                ? "#30d158"
                : shareSearchStatus === "not_found"
                  ? "#ff453a"
                  : t.inputBorder,
            backgroundColor: t.inputBg,
            color: t.text,
            borderRadius: 18,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            fontWeight: "600",
          }}
        />

        <View
          style={{
            minHeight: 28,
            marginTop: 10,
            justifyContent: "center",
          }}
        >
          {shareSearchStatus === "searching" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator size="small" color={t.text} />
              <Text style={{ color: t.mutedText, fontWeight: "600" }}>
                Checking username...
              </Text>
            </View>
          ) : shareMessage ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons
                name={shareSearchStatus === "found" ? "checkmark-circle" : "close-circle"}
                size={16}
                color={shareSearchStatus === "found" ? "#30d158" : "#ff453a"}
              />
              <Text
                style={{
                  color: shareSearchStatus === "found" ? "#30d158" : "#ff453a",
                  fontWeight: "700",
                  flex: 1,
                }}
              >
                {shareMessage}
              </Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={() => void sendShare()}
          disabled={!canSubmitShare}
          activeOpacity={0.85}
          style={[
            getPrimaryCtaStyle(t),
            !canSubmitShare && { opacity: 0.55 },
          ]}
        >
          {shareBusy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={styles.primaryCtaText}>Share Program</Text>
            </>
          )}
        </TouchableOpacity>
      </FancyModalShell>

      <FancyModalShell
        visible={sharedVisible}
        onClose={() => setSharedVisible(false)}
        title="Shared activity"
        subtitle="Incoming requests, recent sent shares, and imports"
        t={t}
        enableSwipeDismiss
        showCloseButton={false}
      >
        {pendingShares.length > 0 ? (
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>
                Needs your action
              </Text>
              <View
                style={{
                  minWidth: 26,
                  height: 26,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#ff453a",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>
                  {sharedBadgeCount > 9 ? "9+" : sharedBadgeCount}
                </Text>
              </View>
            </View>

            <View style={{ gap: 10, marginBottom: 18 }}>
              {pendingShares.map((share) => {
                const tone = getStatusTone(share.status, t);
                return (
                  <View
                    key={share.id}
                    style={{
                      borderWidth: 1,
                      borderColor: tone.border,
                      backgroundColor: tone.bg,
                      borderRadius: 18,
                      padding: 14,
                    }}
                  >
                    <Text style={{ color: t.text, fontWeight: "800", fontSize: 15 }}>
                      {share.program_name}
                    </Text>
                    <Text style={{ color: t.mutedText, marginTop: 5, lineHeight: 19 }}>
                      {share.sender_username ? `@${share.sender_username}` : "Unknown user"}
                    </Text>
                    {share.created_at ? (
                      <Text style={{ color: t.mutedText, marginTop: 6, fontSize: 12.5 }}>
                        {formatRelativeTimestamp(share.created_at)}
                      </Text>
                    ) : null}

                    <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                      <TouchableOpacity
                        onPress={() => void handleAcceptShare(share.id)}
                        activeOpacity={0.85}
                        style={{
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                          paddingVertical: 12,
                          borderRadius: 14,
                          backgroundColor: "#30d158",
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "800" }}>Accept</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => void handleDeclineShare(share.id)}
                        activeOpacity={0.85}
                        style={{
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                          paddingVertical: 12,
                          borderRadius: 14,
                          backgroundColor: t.cardAlt,
                          borderWidth: 1,
                          borderColor: t.border,
                        }}
                      >
                        <Text style={{ color: t.text, fontWeight: "800" }}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <Text
          style={{
            color: t.text,
            fontWeight: "800",
            fontSize: 16,
            marginTop: pendingShares.length > 0 ? 0 : 18,
            marginBottom: 12,
          }}
        >
          Recent sent shares
        </Text>

        {sentShares.length === 0 ? (
          <EmptyStateCard
            icon="share-outline"
            title="Nothing shared yet"
            message={
              pendingShares.length > 0
                ? "Status updates for sent shares will appear here."
                : "Programs you share with other users will appear here."
            }
            t={t}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {sentShares.map((share) => {
              const tone = getStatusTone(share.status, t);
              return (
                <View
                  key={share.id}
                  style={{
                    borderWidth: 1,
                    borderColor: tone.border,
                    backgroundColor: tone.bg,
                    borderRadius: 18,
                    padding: 14,
                  }}
                >
                  <Text style={{ color: t.text, fontWeight: "800", fontSize: 15 }}>
                    {share.program_name}
                  </Text>
                  <Text style={{ color: t.mutedText, marginTop: 5, lineHeight: 19 }}>
                    {share.receiver_username ? `@${share.receiver_username}` : "Unknown user"}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: tone.text,
                        fontWeight: "700",
                        textTransform: "capitalize",
                      }}
                    >
                      {share.status}
                    </Text>
                    {share.created_at ? (
                      <Text style={{ color: t.mutedText, fontSize: 12.5 }}>
                        {formatRelativeTimestamp(share.created_at)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text
          style={{
            color: t.text,
            fontWeight: "800",
            fontSize: 16,
            marginTop: 20,
            marginBottom: 12,
          }}
        >
          Recent imports
        </Text>

        {recentImports.length === 0 ? (
          <EmptyStateCard
            icon="download-outline"
            title="No imports yet"
            message="Programs you accept and import will appear here."
            t={t}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {recentImports.map((item) => (
              <View
                key={item.id}
                style={{
                  borderWidth: 1,
                  borderColor: t.border,
                  backgroundColor: t.cardAlt,
                  borderRadius: 18,
                  padding: 14,
                }}
              >
                <Text style={{ color: t.text, fontWeight: "800", fontSize: 15 }}>
                  {item.program_name}
                </Text>
                <Text style={{ color: t.mutedText, marginTop: 5, lineHeight: 19 }}>
                  {item.shared_by_username
                    ? `Imported from @${item.shared_by_username}`
                    : "Imported from another user"}
                </Text>
                {item.created_at ? (
                  <Text style={{ color: t.mutedText, marginTop: 8, fontSize: 12.5 }}>
                    {formatRelativeTimestamp(item.created_at)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </FancyModalShell>

      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    flexGrow: 1,
  },
  primaryCtaText: {
    color: "white",
    fontWeight: "800",
    fontSize: 15,
  },
  secondaryCtaText: {
    fontWeight: "800",
    fontSize: 15,
  },
  statChip: {
    flex: 1,
    minWidth: "47%",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statChipValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  statChipLabel: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "600",
  },
  compactGlowCard: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
  },
  compactGlowLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  compactGlowValue: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: "800",
  },
  sharedActivityButton: {
    position: "relative",
    overflow: "visible",
  },
  sharedBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: "#ff453a",
    alignItems: "center",
    justifyContent: "center",
  },
  sharedBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
});
