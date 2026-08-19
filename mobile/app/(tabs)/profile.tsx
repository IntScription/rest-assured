import {
  ThemePreference,
  getThemePreference,
  setThemePreference,
} from "@/hooks/use-color-scheme";
import {
  setOnboardingStep,
  startOnboarding,
  stopOnboarding,
} from "@/src/lib/onboarding";
import { supabase } from "@/src/lib/supabase";
import { exportLogsAsCsv } from "@/src/features/profile/utils/exportLogs";
import { useAppTheme } from "@/src/theme/theme";
import { useCustomTabBarBottomPadding } from "@/components/navigation/CustomTabBar";
import { Ionicons } from "@expo/vector-icons";
import type { User } from "@supabase/supabase-js";
import { BlurView } from "expo-blur";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const VERSION = "1.1.4";
const APP_STORE_ID = "6760107763";
const APP_STORE_REVIEW_URL = `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`;
const APP_STORE_WEB_REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
const SUPPORT_EMAIL = "22kartiksanil@gmail.com";
const WEB_URL = "https://rest-assured-rho.vercel.app/login";
const GITHUB_REPO_URL = "https://github.com/IntScription/rest-assured";
const MAX_BIO_LENGTH = 160;
const AVATAR_BUCKET = "avatars";

type NotificationStatus =
  | "checking"
  | "enabled"
  | "disabled"
  | "unsupported"
  | "unknown";

type UsernameAvailabilityState = "idle" | "available" | "unavailable";

type ProfileRow = {
  id: string;
  username: string | null;
  bio: string | null;
  avatar_url?: string | null;
  expo_push_token?: string | null;
};

async function safeHaptic(fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
  } catch { }
}

async function loadExpoNotifications() {
  try {
    const mod = await import("expo-notifications");
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

async function loadExpoStoreReview() {
  try {
    const mod = await import("expo-store-review");
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

async function loadExpoWebBrowser() {
  try {
    const mod = await import("expo-web-browser");
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

async function loadExpoImagePicker() {
  try {
    const mod = await import("expo-image-picker");
    return mod;
  } catch {
    return null;
  }
}

function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

function getInitials(username: string | null, user: User | null) {
  const raw = username || user?.user_metadata?.username || user?.email || "U";
  return String(raw).slice(0, 2).toUpperCase();
}

function validateUsername(username: string) {
  if (!username) return "Username is required.";
  if (username.length < 3) return "Username must be at least 3 characters.";
  if (username.length > 20) return "Username must be 20 characters or less.";
  if (!/^[a-z0-9_]+$/.test(username)) {
    return "Use only lowercase letters, numbers, and underscores.";
  }
  return null;
}

function getAvatarFileExtension(uri: string) {
  const cleanUri = uri.split("?")[0] || uri;
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return (match?.[1] || "jpg").toLowerCase();
}

function getAvatarMimeType(ext: string) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  return "image/jpeg";
}

function isDarkHexColor(color?: string) {
  if (!color?.startsWith("#")) return false;

  const raw = color.replace("#", "");
  const hex = raw.length === 3 ? raw.split("").map((ch) => ch + ch).join("") : raw;
  const value = Number.parseInt(hex.slice(0, 6), 16);

  if (Number.isNaN(value)) return false;

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return 0.299 * r + 0.587 * g + 0.114 * b < 150;
}

function getProfileScreenPalette(background: string) {
  const isDark = isDarkHexColor(background);

  return {
    base: isDark ? "#080B14" : "#EEF2F7",
    glowPrimary: isDark ? "rgba(14,165,233,0.17)" : "rgba(14,116,144,0.14)",
    glowSecondary: isDark ? "rgba(168,85,247,0.13)" : "rgba(124,58,237,0.11)",
    glowWarm: isDark ? "rgba(245,158,11,0.09)" : "rgba(217,119,6,0.10)",
  };
}

export default function ProfileScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const bottomPadding = useCustomTabBarBottomPadding(26);
  const screenPalette = useMemo(() => getProfileScreenPalette(t.background), [t.background]);

  const backgroundFloatA = useRef(new Animated.Value(0)).current;
  const backgroundFloatB = useRef(new Animated.Value(0)).current;
  const backgroundFloatC = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    backgroundFloatA.setValue(0);
    backgroundFloatB.setValue(0);
    backgroundFloatC.setValue(0);

    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(backgroundFloatA, {
            toValue: 1,
            duration: 21000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(backgroundFloatA, {
            toValue: 0,
            duration: 21000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(backgroundFloatB, {
            toValue: 1,
            duration: 25000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(backgroundFloatB, {
            toValue: 0,
            duration: 25000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(backgroundFloatC, {
            toValue: 1,
            duration: 29000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(backgroundFloatC, {
            toValue: 0,
            duration: 29000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [backgroundFloatA, backgroundFloatB, backgroundFloatC]);

  const profileGlowTopMotion = {
    transform: [
      {
        translateX: backgroundFloatA.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -20],
        }),
      },
      {
        translateY: backgroundFloatA.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 22],
        }),
      },
      {
        scale: backgroundFloatA.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.05],
        }),
      },
    ],
  };

  const profileGlowMidMotion = {
    transform: [
      {
        translateX: backgroundFloatB.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 26],
        }),
      },
      {
        translateY: backgroundFloatB.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -18],
        }),
      },
      {
        scale: backgroundFloatB.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.055],
        }),
      },
    ],
  };

  const profileGlowBottomMotion = {
    transform: [
      {
        translateX: backgroundFloatC.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -22],
        }),
      },
      {
        translateY: backgroundFloatC.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -24],
        }),
      },
      {
        scale: backgroundFloatC.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.045],
        }),
      },
    ],
  };

  const [theme, setTheme] = useState<ThemePreference>("system");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);

  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [openingExternal, setOpeningExternal] = useState<string | null>(null);
  const [exportingData, setExportingData] = useState(false);

  const [notificationStatus, setNotificationStatus] =
    useState<NotificationStatus>("checking");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [serverPushEnabled, setServerPushEnabled] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState<string | null>(null);
  const [tutorialBusy, setTutorialBusy] = useState(false);

  const [usernameInput, setUsernameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [usernameAvailability, setUsernameAvailability] =
    useState<UsernameAvailabilityState>("idle");
  const [usernameAvailabilityMessage, setUsernameAvailabilityMessage] =
    useState("");

  const usernameCheckRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const pref = await getThemePreference();
        setTheme(pref);
      } catch { }

      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        setUser(currentUser ?? null);

        if (currentUser?.id) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, username, bio, avatar_url")
            .eq("id", currentUser.id)
            .maybeSingle();

          setProfile((profileData as ProfileRow | null) ?? null);
        }
      } catch {
        setUser(null);
        setProfile(null);
      }
    })();
  }, []);

  const normalizedCurrentUsername = normalizeUsername(profile?.username ?? "");

  const checkUsernameAvailability = useCallback(
    async (rawUsername: string) => {
      const username = normalizeUsername(rawUsername);

      if (!username) {
        setUsernameAvailability("idle");
        setUsernameAvailabilityMessage("");
        return { ok: false, message: "" };
      }

      const validationError = validateUsername(username);
      if (validationError) {
        setUsernameAvailability("unavailable");
        setUsernameAvailabilityMessage(validationError);
        return { ok: false, message: validationError };
      }

      if (username === normalizedCurrentUsername) {
        setUsernameAvailability("available");
        setUsernameAvailabilityMessage("This is your current username.");
        return { ok: true, message: "This is your current username." };
      }

      const requestId = ++usernameCheckRef.current;
      setCheckingUsername(true);

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username")
          .eq("username", username)
          .maybeSingle();

        if (requestId !== usernameCheckRef.current) {
          return { ok: false, message: "Checking canceled." };
        }

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data && data.id !== user?.id) {
          setUsernameAvailability("unavailable");
          setUsernameAvailabilityMessage("Username is not available.");
          return { ok: false, message: "Username is not available." };
        }

        setUsernameAvailability("available");
        setUsernameAvailabilityMessage("Username is available.");
        return { ok: true, message: "Username is available." };
      } catch (err: any) {
        const message = err?.message || "Could not check username.";
        if (requestId === usernameCheckRef.current) {
          setUsernameAvailability("unavailable");
          setUsernameAvailabilityMessage(message);
        }
        return { ok: false, message };
      } finally {
        if (requestId === usernameCheckRef.current) {
          setCheckingUsername(false);
        }
      }
    },
    [normalizedCurrentUsername, user?.id]
  );

  const refreshNotificationState = useCallback(async (userId: string) => {
    try {
      setNotificationStatus("checking");
      setNotificationMessage("");

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("expo_push_token")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        setNotificationStatus("unknown");
        setNotificationMessage("Could not read your saved notification settings.");
        return;
      }

      setServerPushEnabled(!!profileData?.expo_push_token);

      const Notifications = await loadExpoNotifications();

      if (!Notifications?.getPermissionsAsync) {
        setNotificationStatus("unsupported");
        setNotificationMessage("Notifications are unavailable in this build.");
        return;
      }

      const permissions = await Notifications.getPermissionsAsync();

      const allowed =
        permissions?.granted ||
        permissions?.ios?.status ===
        Notifications?.IosAuthorizationStatus?.PROVISIONAL;

      if (allowed && profileData?.expo_push_token) {
        setNotificationStatus("enabled");
        setNotificationMessage("Push notifications are enabled for this device.");
      } else if (allowed && !profileData?.expo_push_token) {
        setNotificationStatus("disabled");
        setNotificationMessage("System permission is on, but server delivery is off.");
      } else {
        setNotificationStatus("disabled");
        setNotificationMessage("Notifications are not enabled yet.");
      }
    } catch (err: any) {
      setNotificationStatus("unknown");
      setNotificationMessage(err?.message || "Could not check notification status.");
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setNotificationStatus("unknown");
      setNotificationMessage("Sign in to manage notifications.");
      return;
    }

    void refreshNotificationState(user.id);
  }, [user?.id, refreshNotificationState]);

  useEffect(() => {
    if (!showProfileModal) return;

    const normalized = normalizeUsername(usernameInput);

    if (!normalized) {
      setCheckingUsername(false);
      setUsernameAvailability("idle");
      setUsernameAvailabilityMessage("");
      return;
    }

    const validationError = validateUsername(normalized);
    if (validationError) {
      setCheckingUsername(false);
      setUsernameAvailability("unavailable");
      setUsernameAvailabilityMessage(validationError);
      return;
    }

    const timer = setTimeout(() => {
      void checkUsernameAvailability(normalized);
    }, 320);

    return () => clearTimeout(timer);
  }, [usernameInput, showProfileModal, checkUsernameAvailability]);

  // Google/Apple sign-in accounts have no password identity, so they can
  // never satisfy a password re-auth check — only require one when the
  // account actually has an "email" (password-based) identity.
  const hasPasswordIdentity = useMemo(
    () => user?.identities?.some((identity) => identity.provider === "email") ?? false,
    [user]
  );

  const canDelete = useMemo(() => {
    if (loadingDelete || confirmText !== "DELETE") return false;
    return hasPasswordIdentity ? password.trim().length > 0 : true;
  }, [confirmText, password, loadingDelete, hasPasswordIdentity]);

  const avatarInitials = getInitials(profile?.username ?? null, user);
  const usernameDisplay = profile?.username ? `@${profile.username}` : "No username yet";
  const usernameExists = !!profile?.username;
  const trimmedBio = profile?.bio?.trim() ?? "";
  const profileCardBioDisplay = trimmedBio || "Add a short bio in edit profile.";
  const hasAvatar = !!profile?.avatar_url;
  const canUseNativeImagePicker = Constants.isDevice === true;

  const closeDeleteModal = () => {
    if (loadingDelete) return;
    setShowDeleteModal(false);
    setConfirmText("");
    setPassword("");
  };

  const openProfileEditor = () => {
    setUsernameInput(profile?.username ?? "");
    setBioInput(profile?.bio ?? "");
    setProfileError(null);
    setProfileSuccess(null);
    setCheckingUsername(false);
    setUsernameAvailability("idle");
    setUsernameAvailabilityMessage("");
    setShowProfileModal(true);
  };

  const closeProfileEditor = () => {
    if (profileBusy || avatarBusy) return;
    setShowProfileModal(false);
    setProfileError(null);
    setProfileSuccess(null);
    setCheckingUsername(false);
    setUsernameAvailability("idle");
    setUsernameAvailabilityMessage("");
  };

  const openAvatarPreview = async () => {
    await safeHaptic(() =>
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    );
    setShowAvatarPreview(true);
  };

  const saveProfileRow = async (payload: {
    username: string | null;
    bio: string | null;
    avatar_url?: string | null;
  }) => {
    if (!user?.id) throw new Error("No user found.");

    const basePayload = {
      id: user.id,
      username: payload.username,
      bio: payload.bio,
      ...(payload.avatar_url !== undefined ? { avatar_url: payload.avatar_url } : {}),
    };

    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update(basePayload)
      .eq("id", user.id)
      .select("id, username, bio, avatar_url")
      .maybeSingle();

    if (updateError) throw updateError;

    if (updated) {
      return updated as ProfileRow;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert(basePayload)
      .select("id, username, bio, avatar_url")
      .single();

    if (insertError) throw insertError;

    return inserted as ProfileRow;
  };

  const handlePickAvatar = async () => {
    if (!user?.id) return;

    if (!canUseNativeImagePicker) {
      Alert.alert(
        "Unavailable on simulator",
        "Avatar image picking is enabled only on a real device."
      );
      return;
    }

    const ImagePicker = await loadExpoImagePicker();

    if (!ImagePicker?.requestMediaLibraryPermissionsAsync) {
      Alert.alert(
        "Image picker unavailable",
        "The image picker module is not available in this build."
      );
      return;
    }

    try {
      setAvatarBusy(true);
      setProfileError(null);
      setProfileSuccess(null);

      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Allow photo library access to choose an avatar."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const ext = getAvatarFileExtension(asset.uri);
      const contentType = getAvatarMimeType(ext);
      const filePath = `${user.id}/avatar.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, blob, {
          contentType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

      const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const data = await saveProfileRow({
        username: profile?.username ?? null,
        bio: profile?.bio ?? null,
        avatar_url: avatarUrl,
      });

      setProfile(data ?? null);
      setProfileSuccess("Avatar updated.");

      await safeHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      );
    } catch (err: any) {
      const message =
        err?.message ||
        "Could not update avatar. Make sure your avatar storage bucket is set up.";
      setProfileError(message);
      Alert.alert("Could not update avatar", message);
      await safeHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    const normalized = normalizeUsername(usernameInput);
    const nextBio = bioInput.trim();
    const validationError = validateUsername(normalized);

    setProfileError(null);
    setProfileSuccess(null);

    if (validationError) {
      setUsernameAvailability("unavailable");
      setUsernameAvailabilityMessage(validationError);
      setProfileError(validationError);
      return;
    }

    try {
      setProfileBusy(true);

      if (normalized !== normalizedCurrentUsername) {
        const availability = await checkUsernameAvailability(normalized);
        if (!availability.ok) {
          setProfileError(availability.message);
          return;
        }
      } else {
        setUsernameAvailability("available");
        setUsernameAvailabilityMessage("This is your current username.");
      }

      const data = await saveProfileRow({
        username: normalized,
        bio: nextBio || null,
        avatar_url: profile?.avatar_url ?? null,
      });

      setProfile(data ?? null);
      setUsernameInput(data?.username ?? "");
      setBioInput(data?.bio ?? "");
      setProfileSuccess("Profile updated.");

      await safeHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      );

      setTimeout(() => {
        setShowProfileModal(false);
      }, 350);
    } catch (err: any) {
      setProfileError(err?.message || "Could not update profile.");
      await safeHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      );
    } finally {
      setProfileBusy(false);
    }
  };

  const handleDeleteUsername = async () => {
    if (!user?.id || !profile?.username) return;

    Alert.alert(
      "Delete username?",
      "This only removes your username. You can set a new one later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setProfileBusy(true);
              setProfileError(null);
              setProfileSuccess(null);
              setCheckingUsername(false);
              setUsernameAvailability("idle");
              setUsernameAvailabilityMessage("");

              const { data, error } = await supabase
                .from("profiles")
                .update({ username: null })
                .eq("id", user.id)
                .select("id, username, bio, avatar_url")
                .single();

              if (error) throw error;

              setProfile((data as ProfileRow) ?? null);
              setUsernameInput("");
              setProfileSuccess("Username deleted.");

              await safeHaptic(() =>
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              );
            } catch (err: any) {
              setProfileError(err?.message || "Could not delete username.");
            } finally {
              setProfileBusy(false);
            }
          },
        },
      ]
    );
  };

  const handleThemeChange = async (value: ThemePreference) => {
    try {
      setTheme(value);
      await setThemePreference(value);
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );
    } catch {
      Alert.alert("Could not update theme", "Please try again.");
    }
  };

  const openRateAndReview = async () => {
    try {
      setOpeningExternal("review");
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );

      if (Platform.OS === "ios") {
        const StoreReview = await loadExpoStoreReview();

        if (StoreReview?.isAvailableAsync && StoreReview?.requestReview) {
          try {
            const available = await StoreReview.isAvailableAsync();
            if (available) {
              await StoreReview.requestReview();
              return;
            }
          } catch { }
        }
      }

      try {
        await Linking.openURL(APP_STORE_REVIEW_URL);
      } catch {
        await Linking.openURL(APP_STORE_WEB_REVIEW_URL);
      }
    } catch {
      Alert.alert("Could not open", "The review page could not be opened.");
    } finally {
      setOpeningExternal(null);
    }
  };

  const openSupportEmail = async () => {
    const subject = encodeURIComponent("Rest Assured Support");
    const body = encodeURIComponent(
      `Hi,\n\nI need help with Rest Assured.\n\nVersion: ${VERSION}\nDevice: ${Platform.OS}\n\n`
    );

    const mailUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    try {
      setOpeningExternal("support");
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );

      const supported = await Linking.canOpenURL(mailUrl);

      if (!supported) {
        Alert.alert(
          "Mail app not available",
          `No mail app is configured on this device.\n\nYou can contact us at:\n${SUPPORT_EMAIL}`
        );
        return;
      }

      await Linking.openURL(mailUrl);
    } catch {
      Alert.alert(
        "Could not open mail",
        `Please email us manually at:\n${SUPPORT_EMAIL}`
      );
    } finally {
      setOpeningExternal(null);
    }
  };

  const openReportProblem = async () => {
    const subject = encodeURIComponent("Rest Assured Bug Report");
    const body = encodeURIComponent(
      `Hi,\n\nI found a problem in Rest Assured.\n\nVersion: ${VERSION}\nDevice: ${Platform.OS}\n\nWhat happened:\n\nExpected:\n\n`
    );

    const mailUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    try {
      setOpeningExternal("report");
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );

      const supported = await Linking.canOpenURL(mailUrl);

      if (!supported) {
        Alert.alert(
          "Mail app not available",
          `No mail app is configured on this device.\n\nYou can report the issue at:\n${SUPPORT_EMAIL}`
        );
        return;
      }

      await Linking.openURL(mailUrl);
    } catch {
      Alert.alert(
        "Could not open mail",
        `Please report the issue manually at:\n${SUPPORT_EMAIL}`
      );
    } finally {
      setOpeningExternal(null);
    }
  };

  const openWebVersion = async () => {
    try {
      setOpeningExternal("web");
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );

      const WebBrowser = await loadExpoWebBrowser();

      if (WebBrowser?.openBrowserAsync) {
        await WebBrowser.openBrowserAsync(WEB_URL);
        return;
      }

      await Linking.openURL(WEB_URL);
    } catch {
      Alert.alert("Could not open", "The web version could not be opened.");
    } finally {
      setOpeningExternal(null);
    }
  };

  const openGithub = async () => {
    try {
      setOpeningExternal("github");
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );

      const WebBrowser = await loadExpoWebBrowser();

      if (WebBrowser?.openBrowserAsync) {
        await WebBrowser.openBrowserAsync(GITHUB_REPO_URL);
        return;
      }

      await Linking.openURL(GITHUB_REPO_URL);
    } catch {
      Alert.alert("Could not open", "GitHub could not be opened.");
    } finally {
      setOpeningExternal(null);
    }
  };

  const handleReplayTutorial = async () => {
    try {
      setTutorialBusy(true);
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      );

      // Clear any half-finished previous tour state, then start from
      // the first Train onboarding step again. This keeps Replay Tutorial
      // from reopening Welcome with an old step like "done" or "go_home".
      await stopOnboarding();
      await setOnboardingStep("create_program");
      await startOnboarding();

      router.replace({
        pathname: "/welcome",
        params: { mode: "setup", replay: "1" },
      });
    } catch {
      Alert.alert("Could not open tutorial", "Please try again.");
    } finally {
      setTutorialBusy(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (!user?.id) return;

    try {
      setNotificationBusy("enable");
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );

      const { registerForPushNotifications } = await import(
        "@/src/lib/push/registerPush"
      );
      const token = await registerForPushNotifications(user.id);

      if (!token) {
        Alert.alert(
          "Notifications not enabled",
          "This device or build could not register for push notifications right now."
        );
        await refreshNotificationState(user.id);
        return;
      }

      await refreshNotificationState(user.id);
      Alert.alert("Enabled", "Push notifications are now enabled.");
    } catch (err: any) {
      Alert.alert("Could not enable", err?.message || "Please try again.");
    } finally {
      setNotificationBusy(null);
    }
  };

  const handleDisableNotifications = async () => {
    if (!user?.id) return;

    try {
      setNotificationBusy("disable");
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );

      const { error } = await supabase
        .from("profiles")
        .update({ expo_push_token: null })
        .eq("id", user.id);

      if (error) throw error;

      await refreshNotificationState(user.id);
      Alert.alert(
        "Server delivery turned off",
        "This app will stop sending push notifications to this device unless you enable them again."
      );
    } catch (err: any) {
      Alert.alert("Could not update", err?.message || "Please try again.");
    } finally {
      setNotificationBusy(null);
    }
  };

  const handleTestNotification = async () => {
    try {
      setNotificationBusy("test");
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );

      const Notifications = await loadExpoNotifications();

      if (!Notifications?.getPermissionsAsync || !Notifications?.scheduleNotificationAsync) {
        Alert.alert("Unavailable", "Local notifications are unavailable in this build.");
        return;
      }

      const permissions = await Notifications.getPermissionsAsync();

      const allowed =
        permissions?.granted ||
        permissions?.ios?.status ===
        Notifications?.IosAuthorizationStatus?.PROVISIONAL;

      if (!allowed) {
        const requested = await Notifications.requestPermissionsAsync?.({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });

        const requestedAllowed =
          requested?.granted ||
          requested?.ios?.status ===
          Notifications?.IosAuthorizationStatus?.PROVISIONAL;

        if (!requestedAllowed) {
          Alert.alert(
            "Permission needed",
            "Enable notifications first before sending a test notification."
          );
          return;
        }
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Rest Assured",
          body: "Your test notification is working.",
          data: { type: "settings_test" },
        },
        trigger: null,
      });

      Alert.alert("Sent", "A local test notification was sent.");

      if (user?.id) {
        await refreshNotificationState(user.id);
      }
    } catch (err: any) {
      Alert.alert("Could not send test", err?.message || "Please try again.");
    } finally {
      setNotificationBusy(null);
    }
  };

  const openDeviceNotificationSettings = async () => {
    try {
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );
      await Linking.openSettings();
    } catch {
      Alert.alert("Could not open", "System settings could not be opened.");
    }
  };

  const handleExportData = async () => {
    if (exportingData || !user) return;

    try {
      setExportingData(true);
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );

      await exportLogsAsCsv(user.id);
    } catch (err: any) {
      await safeHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      );
      Alert.alert("Export failed", err?.message || "Something went wrong.");
    } finally {
      setExportingData(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert("Sign out?", "You can sign back in anytime.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await safeHaptic(() =>
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          );
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    try {
      setLoadingDelete(true);
      await safeHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      );

      if (confirmText !== "DELETE") {
        throw new Error('Please type "DELETE" to confirm.');
      }

      const {
        data: { user: currentUser },
        error,
      } = await supabase.auth.getUser();

      if (error || !currentUser) {
        throw new Error("Session expired.");
      }

      const currentHasPasswordIdentity = currentUser.identities?.some(
        (identity) => identity.provider === "email"
      );

      if (currentHasPasswordIdentity) {
        if (!password.trim()) {
          throw new Error("Please enter your password.");
        }

        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: currentUser.email!,
          password,
        });

        if (reauthError) throw new Error("Incorrect password.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Authentication failed.");
      }

      const response = await fetch(
        "https://rest-assured-rho.vercel.app/api/delete-user",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Delete failed.");
      }

      await supabase.auth.signOut();

      await safeHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      );

      setShowDeleteModal(false);
      setConfirmText("");
      setPassword("");

      Alert.alert(
        "Account Deleted",
        "Your account and all data have been permanently removed."
      );
    } catch (err: any) {
      await safeHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      );
      Alert.alert("Error", err?.message || "Something went wrong.");
    } finally {
      setLoadingDelete(false);
    }
  };

  const renderChevron = () => (
    <Ionicons name="chevron-forward" size={18} color={t.mutedText} />
  );

  const getNotificationValue = () => {
    if (notificationStatus === "checking") return "Checking";
    if (notificationStatus === "enabled") return "Enabled";
    if (notificationStatus === "disabled") return "Off";
    if (notificationStatus === "unsupported") return "Unavailable";
    return "Unknown";
  };

  const renderAvatarContent = ({
    size,
    textSize,
    borderColor,
    showInnerBorder = true,
  }: {
    size: number;
    textSize: number;
    borderColor: string;
    showInnerBorder?: boolean;
  }) => {
    if (hasAvatar && profile?.avatar_url) {
      return (
        <Image
          source={{ uri: profile.avatar_url }}
          style={[
            styles.avatarImage,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: showInnerBorder ? 1.5 : 0,
              borderColor,
            },
          ]}
          resizeMode="cover"
        />
      );
    }

    return (
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: t.cardAlt,
            borderWidth: showInnerBorder ? 1.5 : 0,
            borderColor,
          },
        ]}
      >
        <Text style={[styles.avatarText, { color: t.text, fontSize: textSize }]}>
          {avatarInitials}
        </Text>
      </View>
    );
  };

  const renderRow = ({
    label,
    onPress,
    danger = false,
    value,
    showChevron = false,
    loadingKey,
    selected = false,
    icon,
  }: {
    label: string;
    onPress?: () => void;
    danger?: boolean;
    value?: string;
    showChevron?: boolean;
    loadingKey?: string;
    selected?: boolean;
    icon?: keyof typeof Ionicons.glyphMap;
  }) => {
    const isBusy = loadingKey
      ? openingExternal === loadingKey ||
      notificationBusy === loadingKey ||
      (loadingKey === "tutorial" && tutorialBusy)
      : false;

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        disabled={!onPress || isBusy}
        onPress={onPress}
        style={[styles.row, selected && { backgroundColor: t.cardAlt }]}
      >
        <View style={styles.rowLeft}>
          {icon ? (
            <View style={[styles.iconWrap, { backgroundColor: t.cardAlt }]}>
              <Ionicons
                name={icon}
                size={16}
                color={danger ? t.danger : t.text}
              />
            </View>
          ) : null}

          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.rowLabel,
                { color: danger ? t.danger : t.text },
                selected && { fontWeight: "700" },
              ]}
            >
              {label}
            </Text>

            {loadingKey === "tutorial" ? (
              <Text style={[styles.rowSubtext, { color: t.mutedText }]}>
                Revisit the guided setup and onboarding flow.
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.rowRight}>
          {isBusy ? (
            <ActivityIndicator size="small" color={t.mutedText} />
          ) : value ? (
            <Text style={[styles.valueText, { color: t.mutedText }]}>{value}</Text>
          ) : null}

          {showChevron ? renderChevron() : null}

          {!showChevron && selected ? (
            <Ionicons name="checkmark" size={18} color={t.primaryBg} />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: screenPalette.base }]}
      edges={["top"]}
    >
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <Animated.View
          style={[
            styles.backgroundGlow,
            styles.profileGlowTop,
            { backgroundColor: screenPalette.glowPrimary },
            profileGlowTopMotion,
          ]}
        />
        <Animated.View
          style={[
            styles.backgroundGlow,
            styles.profileGlowMid,
            { backgroundColor: screenPalette.glowSecondary },
            profileGlowMidMotion,
          ]}
        />
        <Animated.View
          style={[
            styles.backgroundGlow,
            styles.profileGlowBottom,
            { backgroundColor: screenPalette.glowWarm },
            profileGlowBottomMotion,
          ]}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPadding },
        ]}
        removeClippedSubviews={Platform.OS === "android"}
      >
        <Text style={[styles.header, { color: t.text }]}>Profile</Text>

        <View style={styles.group}>
          <View
            style={[
              styles.usernameCard,
              {
                backgroundColor: t.card,
                borderColor: t.border,
              },
            ]}
          >

            <Pressable
              onPress={() => {
                void openAvatarPreview();
              }}
              hitSlop={8}
              style={styles.avatarPressableOnly}
            >
              <View
                style={[
                  styles.avatarRing,
                  {
                    backgroundColor: t.cardAlt,
                    borderColor: t.link,
                    shadowColor: t.link,
                  },
                ]}
              >
                {renderAvatarContent({
                  size: 76,
                  textSize: 24,
                  borderColor: t.link,
                })}
              </View>
            </Pressable>

            <View style={styles.usernameContent}>
              <View style={styles.usernameTopRow}>
                <View style={styles.usernameTextBlock}>
                  <Text
                    style={[styles.usernameValue, { color: t.text }]}
                    numberOfLines={1}
                  >
                    {usernameDisplay}
                  </Text>

                  {!!trimmedBio ? (
                    <Text
                      style={[styles.usernameBioStandalone, { color: t.mutedText }]}
                      numberOfLines={3}
                    >
                      {profileCardBioDisplay}
                    </Text>
                  ) : (
                    <Text
                      style={[styles.usernameBioPlaceholder, { color: t.mutedText }]}
                      numberOfLines={2}
                    >
                      {profileCardBioDisplay}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openProfileEditor}
              hitSlop={8}
              style={[
                styles.editChip,
                {
                  backgroundColor: t.cardAlt,
                  borderColor: t.border,
                },
              ]}
            >
              <Ionicons name="create-outline" size={15} color={t.text} />
              <Text style={{ color: t.text, fontSize: 13, fontWeight: "800" }}>
                {usernameExists ? "Edit" : "Set"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: t.mutedText }]}>Appearance</Text>
          <View
            style={[
              styles.groupCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            {renderRow({
              label: Platform.OS === "ios" ? "Match System" : "System Default",
              onPress: () => handleThemeChange("system"),
              selected: theme === "system",
              icon: "phone-portrait-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Light",
              onPress: () => handleThemeChange("light"),
              selected: theme === "light",
              icon: "sunny-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Dark",
              onPress: () => handleThemeChange("dark"),
              selected: theme === "dark",
              icon: "moon-outline",
            })}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: t.mutedText }]}>Notifications</Text>
          <View
            style={[
              styles.groupCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            {renderRow({
              label: "Status",
              value: getNotificationValue(),
              icon: "notifications-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Enable Notifications",
              onPress: handleEnableNotifications,
              loadingKey: "enable",
              icon: "checkmark-circle-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Turn Off Server Delivery",
              onPress: handleDisableNotifications,
              loadingKey: "disable",
              icon: "notifications-off-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Send Test Notification",
              onPress: handleTestNotification,
              loadingKey: "test",
              icon: "paper-plane-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Open Device Notification Settings",
              onPress: openDeviceNotificationSettings,
              showChevron: true,
              icon: "settings-outline",
            })}
          </View>

          <Text style={[styles.helperText, { color: t.mutedText }]}>
            {notificationMessage ||
              (serverPushEnabled
                ? "Push notifications are linked to this device."
                : "Enable notifications to receive reminders and updates.")}
          </Text>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: t.mutedText }]}>Support</Text>
          <View
            style={[
              styles.groupCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            {renderRow({
              label: "Replay Tutorial",
              onPress: handleReplayTutorial,
              showChevron: true,
              loadingKey: "tutorial",
              icon: "play-circle-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Rate & Review",
              onPress: openRateAndReview,
              showChevron: true,
              loadingKey: "review",
              icon: "star-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Contact Support",
              onPress: openSupportEmail,
              showChevron: true,
              loadingKey: "support",
              icon: "mail-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Report a Problem",
              onPress: openReportProblem,
              showChevron: true,
              loadingKey: "report",
              icon: "bug-outline",
            })}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: t.mutedText }]}>About</Text>
          <View
            style={[
              styles.groupCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            {renderRow({
              label: "About Rest Assured",
              onPress: () => {
                setShowAboutModal(true);
              },
              showChevron: true,
              icon: "information-circle-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Open Web Version",
              onPress: openWebVersion,
              showChevron: true,
              loadingKey: "web",
              icon: "globe-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "View Source Code",
              onPress: openGithub,
              showChevron: true,
              loadingKey: "github",
              icon: "logo-github",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Privacy Policy",
              onPress: () => {
                void safeHaptic(() =>
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                );
                router.push("/privacy");
              },
              showChevron: true,
              icon: "shield-checkmark-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Terms of Service",
              onPress: () => {
                void safeHaptic(() =>
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                );
                router.push("/terms");
              },
              showChevron: true,
              icon: "document-text-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Version",
              value: VERSION,
              icon: "code-slash-outline",
            })}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: t.mutedText }]}>Account</Text>
          <View
            style={[
              styles.groupCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            {renderRow({
              label: exportingData ? "Preparing export..." : "Export My Data",
              onPress: exportingData ? undefined : handleExportData,
              icon: "download-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Sign Out",
              onPress: confirmLogout,
              icon: "log-out-outline",
            })}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: t.mutedText }]}>Danger Zone</Text>
          <View
            style={[
              styles.groupCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            {renderRow({
              label: "Delete Account",
              onPress: () => {
                void safeHaptic(() =>
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                );
                setShowDeleteModal(true);
              },
              danger: true,
              icon: "trash-outline",
            })}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showProfileModal}
        transparent
        animationType="fade"
        onRequestClose={closeProfileEditor}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: t.text }]}>
              {usernameExists ? "Edit Profile" : "Set Profile"}
            </Text>

            <Text style={[styles.modalDesc, { color: t.mutedText }]}>
              Choose a username, add a bio, and manage your avatar.
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePickAvatar}
              disabled={avatarBusy}
              style={[
                styles.avatarPickerButton,
                {
                  backgroundColor: t.cardAlt,
                  borderColor: t.border,
                  opacity: avatarBusy ? 0.7 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.modalAvatarRing,
                  {
                    backgroundColor: t.background,
                    borderColor: t.link,
                  },
                ]}
              >
                {renderAvatarContent({
                  size: 64,
                  textSize: 22,
                  borderColor: t.link,
                })}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.avatarPickerTitle, { color: t.text }]}>
                  {hasAvatar ? "Change avatar" : "Choose avatar"}
                </Text>
                <Text style={[styles.avatarPickerSubtitle, { color: t.mutedText }]}>
                  {canUseNativeImagePicker
                    ? "Pick an image from your gallery."
                    : "Available only on a real device, not the simulator."}
                </Text>
              </View>

              {avatarBusy ? (
                <ActivityIndicator size="small" color={t.mutedText} />
              ) : (
                <Ionicons
                  name={
                    canUseNativeImagePicker
                      ? "image-outline"
                      : "phone-portrait-outline"
                  }
                  size={18}
                  color={t.mutedText}
                />
              )}
            </TouchableOpacity>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              value={usernameInput}
              onChangeText={(value) => {
                setUsernameInput(value);
                setProfileError(null);
                setProfileSuccess(null);
              }}
              placeholder="username"
              placeholderTextColor={t.mutedText}
              style={[
                styles.input,
                {
                  borderColor:
                    usernameAvailability === "available"
                      ? "#30d158"
                      : usernameAvailability === "unavailable"
                        ? t.danger
                        : t.border,
                  color: t.text,
                  backgroundColor: t.background,
                },
              ]}
            />

            <View style={styles.feedbackRow}>
              {checkingUsername ? (
                <>
                  <ActivityIndicator size="small" color={t.mutedText} />
                  <Text style={[styles.feedbackText, { color: t.mutedText }]}>
                    Checking username...
                  </Text>
                </>
              ) : usernameAvailabilityMessage ? (
                <>
                  <Ionicons
                    name={
                      usernameAvailability === "available"
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={usernameAvailability === "available" ? "#30d158" : t.danger}
                  />
                  <Text
                    style={[
                      styles.feedbackText,
                      {
                        color:
                          usernameAvailability === "available" ? "#30d158" : t.danger,
                      },
                    ]}
                  >
                    {usernameAvailabilityMessage}
                  </Text>
                </>
              ) : (
                <Text style={[styles.feedbackText, { color: t.mutedText }]}>
                  Use 3–20 lowercase letters, numbers, or underscores.
                </Text>
              )}
            </View>

            <TextInput
              value={bioInput}
              onChangeText={(value) => {
                setBioInput(value.slice(0, MAX_BIO_LENGTH));
                setProfileError(null);
                setProfileSuccess(null);
              }}
              multiline
              textAlignVertical="top"
              placeholder="Bio (optional)"
              placeholderTextColor={t.mutedText}
              style={[
                styles.input,
                styles.bioInput,
                {
                  borderColor: t.border,
                  color: t.text,
                  backgroundColor: t.background,
                },
              ]}
            />

            <Text style={[styles.helperTextInline, { color: t.mutedText }]}>
              Bio is optional. Maximum {MAX_BIO_LENGTH} characters.
            </Text>

            {profileError ? (
              <Text style={[styles.inlineError, { color: t.danger }]}>
                {profileError}
              </Text>
            ) : null}

            {profileSuccess ? (
              <Text style={[styles.successText, { color: "#30d158" }]}>
                {profileSuccess}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={profileBusy || checkingUsername}
              activeOpacity={0.86}
              style={[
                styles.fullDeleteButton,
                {
                  backgroundColor: t.link,
                  opacity: profileBusy || checkingUsername ? 0.7 : 1,
                },
              ]}
            >
              {profileBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.fullDeleteText}>Save Profile</Text>
              )}
            </TouchableOpacity>

            {usernameExists ? (
              <TouchableOpacity
                onPress={handleDeleteUsername}
                disabled={profileBusy}
                activeOpacity={0.82}
                style={[
                  styles.secondaryButton,
                  { borderColor: t.danger, backgroundColor: t.cardAlt },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: t.danger }]}>
                  Delete Username
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={closeProfileEditor}
              disabled={profileBusy || avatarBusy}
              activeOpacity={0.82}
              style={styles.cancelTextButton}
            >
              <Text
                style={{
                  color: profileBusy || avatarBusy ? t.border : t.mutedText,
                  fontSize: 16,
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAvatarPreview}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowAvatarPreview(false)}
      >
        <Pressable
          style={styles.previewOverlay}
          onPress={() => setShowAvatarPreview(false)}
        >
          <BlurView intensity={46} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.previewTint} />

          <View pointerEvents="none" style={styles.previewContentWrap}>
            <View
              style={[
                styles.previewAvatarShell,
                {
                  borderColor: t.link,
                  backgroundColor: "rgba(255,255,255,0.06)",
                },
              ]}
            >
              {renderAvatarContent({
                size: 220,
                textSize: 64,
                borderColor: t.link,
                showInnerBorder: false,
              })}
            </View>

            <Text style={[styles.previewUsername, { color: "#fff" }]}>
              {usernameDisplay}
            </Text>

            {!!trimmedBio ? (
              <Text style={[styles.previewBio, { color: "rgba(255,255,255,0.84)" }]}>
                {trimmedBio}
              </Text>
            ) : null}

            <Text style={styles.previewCloseHint}>Tap anywhere to close</Text>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showAboutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <View style={styles.aboutHeader}>
              <Image
                source={require("@/assets/images/rest-assured.png")}
                style={styles.aboutAppIcon}
                resizeMode="cover"
              />
            </View>

            <Text style={[styles.modalTitle, { color: t.text }]}>
              Rest Assured
            </Text>

            <Text style={[styles.aboutVersion, { color: t.mutedText }]}>
              Version {VERSION}
            </Text>

            <Text style={[styles.aboutBody, { color: t.mutedText }]}>
              Rest Assured is a health and fitness tracking app designed to make
              logging workouts, organizing routines, and reviewing progress feel
              simple and consistent.
            </Text>

            <Text style={[styles.aboutBody, { color: t.mutedText }]}>
              It gives you a focused experience across mobile and web, so your
              training history, structure, and progress stay easy to access wherever
              you use it.
            </Text>

            <TouchableOpacity
              onPress={() => setShowAboutModal(false)}
              activeOpacity={0.82}
              style={[styles.aboutCloseButton, { backgroundColor: t.cardAlt }]}
            >
              <Text style={[styles.aboutCloseText, { color: t.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Ionicons
              name="warning-outline"
              size={34}
              color={t.danger}
              style={styles.modalIcon}
            />

            <Text style={[styles.modalTitle, { color: t.text }]}>
              Permanently Delete Account
            </Text>

            <Text style={[styles.modalDesc, { color: t.mutedText }]}>
              {hasPasswordIdentity
                ? "This action cannot be undone. Type DELETE and enter your password to continue."
                : "This action cannot be undone. Type DELETE to continue."}
            </Text>

            <View
              style={[
                styles.warningBox,
                { backgroundColor: t.cardAlt, borderColor: t.border },
              ]}
            >
              <Text style={[styles.warningText, { color: t.mutedText }]}>
                This will remove your profile, programs, splits, exercises, and logs
                permanently.
              </Text>
            </View>

            <TextInput
              placeholder="Type DELETE"
              autoCapitalize="characters"
              value={confirmText}
              onChangeText={setConfirmText}
              editable={!loadingDelete}
              style={[
                styles.input,
                {
                  borderColor:
                    confirmText && confirmText !== "DELETE" ? t.danger : t.border,
                  color: t.text,
                  backgroundColor: t.background,
                },
              ]}
              placeholderTextColor={t.mutedText}
            />

            {hasPasswordIdentity ? (
              <TextInput
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!loadingDelete}
                style={[
                  styles.input,
                  {
                    borderColor: t.border,
                    color: t.text,
                    backgroundColor: t.background,
                  },
                ]}
                placeholderTextColor={t.mutedText}
              />
            ) : null}

            {confirmText.length > 0 && confirmText !== "DELETE" ? (
              <Text style={[styles.inlineError, { color: t.danger }]}>
                You must type DELETE exactly.
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={handleDeleteAccount}
              disabled={!canDelete}
              activeOpacity={0.86}
              style={[
                styles.fullDeleteButton,
                {
                  backgroundColor: canDelete ? t.danger : t.border,
                },
              ]}
            >
              {loadingDelete ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.fullDeleteText}>Delete Account Permanently</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={closeDeleteModal}
              disabled={loadingDelete}
              activeOpacity={0.82}
              style={styles.cancelTextButton}
            >
              <Text
                style={{
                  color: loadingDelete ? t.border : t.mutedText,
                  fontSize: 16,
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    overflow: "hidden",
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFill,
  },
  backgroundGlow: {
    position: "absolute",
    borderRadius: 999,
  },
  profileGlowTop: {
    width: 260,
    height: 260,
    top: -96,
    right: -100,
  },
  profileGlowMid: {
    width: 220,
    height: 220,
    top: 340,
    left: -122,
  },
  profileGlowBottom: {
    width: 280,
    height: 280,
    bottom: -150,
    right: -120,
  },
  scrollContent: {
    paddingTop: 2,
  },
  header: {
    fontSize: 32,
    fontWeight: "700",
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 16,
    letterSpacing: -0.5,
  },

  group: {
    marginBottom: 28,
  },
  groupTitle: {
    fontSize: 13,
    marginLeft: 20,
    marginBottom: 8,
    fontWeight: "600",
  },

  usernameCard: {
    marginHorizontal: 16,
    borderRadius: 28,
    borderWidth: 1,
    padding: 16,
    paddingRight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    position: "relative",
    overflow: "hidden",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  avatarPressableOnly: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRing: {
    width: 86,
    height: 86,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {},
  avatarText: {
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  usernameContent: {
    flex: 1,
    minWidth: 0,
  },
  usernameTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  usernameTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  usernameValue: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.45,
    paddingRight: 4,
  },
  usernameBioStandalone: {
    fontSize: 14.5,
    lineHeight: 21,
    marginTop: 10,
    fontWeight: "600",
  },
  usernameBioPlaceholder: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    fontWeight: "600",
  },
  editChip: {
    position: "absolute",
    right: 16,
    top: "50%",
    height: 36,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transform: [{ translateY: -18 }],
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },

  helperText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginHorizontal: 20,
    fontWeight: "500",
  },
  helperTextInline: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
    textAlign: "center",
    fontWeight: "500",
  },

  groupCard: {
    borderRadius: 22,
    overflow: "hidden",
    marginHorizontal: 16,
    borderWidth: 1,
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  row: {
    minHeight: 58,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabel: {
    fontSize: 16,
  },
  rowSubtext: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
    fontWeight: "500",
  },
  valueText: {
    fontSize: 14,
    fontWeight: "600",
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 58,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
  },
  modalIcon: {
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  modalDesc: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 14,
    lineHeight: 20,
  },

  avatarPickerButton: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  modalAvatarRing: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarPickerTitle: {
    fontSize: 15.5,
    fontWeight: "700",
  },
  avatarPickerSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
    fontWeight: "500",
  },

  warningBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
  },
  bioInput: {
    minHeight: 108,
    textAlignVertical: "top",
  },
  inlineError: {
    fontSize: 12,
    marginBottom: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  successText: {
    fontSize: 12,
    marginBottom: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 24,
    marginBottom: 10,
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  fullDeleteButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  fullDeleteText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  cancelTextButton: {
    marginTop: 16,
    alignItems: "center",
  },

  previewOverlay: {
    flex: 1,
  },
  previewTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  previewContentWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 30,
  },
  previewAvatarShell: {
    width: 250,
    height: 250,
    borderRadius: 999,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  previewUsername: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  previewBio: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  previewCloseHint: {
    marginTop: 16,
    color: "rgba(255,255,255,0.74)",
    fontSize: 12.5,
    fontWeight: "600",
  },

  aboutHeader: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  aboutAppIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  aboutVersion: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    fontWeight: "600",
  },
  aboutBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
  },
  aboutCloseButton: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  aboutCloseText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
