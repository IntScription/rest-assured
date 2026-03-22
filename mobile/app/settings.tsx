import {
  ThemePreference,
  getThemePreference,
  setThemePreference,
} from "@/hooks/use-color-scheme";
import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { User } from "@supabase/supabase-js";
import { startOnboarding } from "@/src/lib/onboarding";

const VERSION = "1.1.0";
const APP_STORE_ID = "6760107763";
const APP_STORE_REVIEW_URL = `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`;
const APP_STORE_WEB_REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
const SUPPORT_EMAIL = "22kartiksanil@gmail.com";
const WEB_URL = "https://rest-assured-rho.vercel.app/login";

type NotificationStatus =
  | "checking"
  | "enabled"
  | "disabled"
  | "unsupported"
  | "unknown";

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

async function loadExpoDevice() {
  try {
    const mod = await import("expo-device");
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

export default function SettingsScreen() {
  const t = useAppTheme();
  const router = useRouter();

  const [theme, setTheme] = useState<ThemePreference>("system");
  const [user, setUser] = useState<User | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [openingExternal, setOpeningExternal] = useState<string | null>(null);

  const [notificationStatus, setNotificationStatus] =
    useState<NotificationStatus>("checking");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [serverPushEnabled, setServerPushEnabled] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState<string | null>(null);
  const [tutorialBusy, setTutorialBusy] = useState(false);

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
      } catch {
        setUser(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setNotificationStatus("unknown");
      setNotificationMessage("Sign in to manage notifications.");
      return;
    }

    void refreshNotificationState(user.id);
  }, [user?.id]);

  const canDelete = useMemo(() => {
    return confirmText === "DELETE" && password.trim().length > 0 && !loadingDelete;
  }, [confirmText, password, loadingDelete]);

  const closeDeleteModal = () => {
    if (loadingDelete) return;
    setShowDeleteModal(false);
    setConfirmText("");
    setPassword("");
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
      Alert.alert(
        "Could not open",
        "The review page could not be opened."
      );
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

  const handleReplayTutorial = async () => {
    try {
      setTutorialBusy(true);
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      );
      await startOnboarding();
      router.push("/welcome");
    } catch {
      Alert.alert("Could not open tutorial", "Please try again.");
    } finally {
      setTutorialBusy(false);
    }
  };

  const refreshNotificationState = async (userId: string) => {
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
      const Device = await loadExpoDevice();

      if (!Notifications?.getPermissionsAsync) {
        setNotificationStatus("unsupported");
        setNotificationMessage("Notifications are unavailable in this build.");
        return;
      }

      if (Device && Device.isDevice === false) {
        setNotificationStatus("unsupported");
        setNotificationMessage("Push notifications require a real device.");
        return;
      }

      const permissions = await Notifications.getPermissionsAsync();

      const allowed =
        permissions?.granted ||
        permissions?.ios?.status === Notifications?.IosAuthorizationStatus?.PROVISIONAL;

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
  };

  const handleEnableNotifications = async () => {
    if (!user?.id) return;

    try {
      setNotificationBusy("enable");
      await safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );

      const { registerForPushNotifications } = await import("@/src/lib/push/registerPush");
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
        Alert.alert(
          "Unavailable",
          "Local notifications are unavailable in this build."
        );
        return;
      }

      const permissions = await Notifications.getPermissionsAsync();

      const allowed =
        permissions?.granted ||
        permissions?.ios?.status === Notifications?.IosAuthorizationStatus?.PROVISIONAL;

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
          requested?.ios?.status === Notifications?.IosAuthorizationStatus?.PROVISIONAL;

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

      if (!password.trim()) {
        throw new Error("Please enter your password.");
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: currentUser.email!,
        password,
      });

      if (reauthError) throw new Error("Incorrect password.");

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
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.header, { color: t.text }]}>Settings</Text>

        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: t.mutedText }]}>Appearance</Text>
          <View style={[styles.groupCard, { backgroundColor: t.card, borderColor: t.border }]}>
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
          <View style={[styles.groupCard, { backgroundColor: t.card, borderColor: t.border }]}>
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
          <View style={[styles.groupCard, { backgroundColor: t.card, borderColor: t.border }]}>
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
          <Text style={[styles.groupTitle, { color: t.mutedText }]}>Account</Text>
          <View style={[styles.groupCard, { backgroundColor: t.card, borderColor: t.border }]}>
            {renderRow({
              label: "Sign Out",
              onPress: confirmLogout,
              icon: "log-out-outline",
            })}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: t.mutedText }]}>About</Text>
          <View style={[styles.groupCard, { backgroundColor: t.card, borderColor: t.border }]}>
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
              label: "Open Web Version",
              onPress: openWebVersion,
              showChevron: true,
              loadingKey: "web",
              icon: "globe-outline",
            })}
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            {renderRow({
              label: "Version",
              value: VERSION,
              icon: "information-circle-outline",
            })}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: t.mutedText }]}>Danger Zone</Text>
          <View style={[styles.groupCard, { backgroundColor: t.card, borderColor: t.border }]}>
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
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: t.card, borderColor: t.border }]}>
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
              This action cannot be undone. Type DELETE and enter your password to continue.
            </Text>

            <View
              style={[
                styles.warningBox,
                { backgroundColor: t.cardAlt, borderColor: t.border },
              ]}
            >
              <Text style={[styles.warningText, { color: t.mutedText }]}>
                This will remove your profile, programs, splits, exercises, and logs permanently.
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
              <Text style={{ color: loadingDelete ? t.border : t.mutedText, fontSize: 16 }}>
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
  safe: { flex: 1 },
  scrollContent: {
    paddingBottom: 36,
  },
  header: {
    fontSize: 32,
    fontWeight: "700",
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    letterSpacing: -0.5,
  },

  group: { marginBottom: 28 },
  groupTitle: {
    fontSize: 13,
    marginLeft: 20,
    marginBottom: 8,
    fontWeight: "600",
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginHorizontal: 20,
    fontWeight: "500",
  },
  groupCard: {
    borderRadius: 18,
    overflow: "hidden",
    marginHorizontal: 16,
    borderWidth: 1,
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
  inlineError: {
    fontSize: 12,
    marginBottom: 10,
    fontWeight: "600",
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
  cancelTextButton: {
    marginTop: 16,
    alignItems: "center",
  },
});

