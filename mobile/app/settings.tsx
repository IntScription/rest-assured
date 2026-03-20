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
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const VERSION = "1.0.2";

export default function SettingsScreen() {
  const t = useAppTheme();
  const router = useRouter();

  const [theme, setTheme] = useState<ThemePreference>("system");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [loadingDelete, setLoadingDelete] = useState(false);

  useEffect(() => {
    (async () => {
      const pref = await getThemePreference();
      setTheme(pref);
    })();
  }, []);

  const handleThemeChange = (value: ThemePreference) => {
    setTheme(value);
    setThemePreference(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const confirmLogout = () => {
    Alert.alert("Sign out?", "You can sign back in anytime.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    try {
      setLoadingDelete(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      if (confirmText !== "DELETE") {
        throw new Error('Please type "DELETE" to confirm.');
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        throw new Error("Session expired.");
      }

      if (!password) {
        throw new Error("Please enter your password.");
      }

      const { error: reauthError } =
        await supabase.auth.signInWithPassword({
          email: user.email!,
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setShowDeleteModal(false);

      Alert.alert(
        "Account Deleted",
        "Your account and all data have been permanently removed."
      );
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", err.message);
    } finally {
      setLoadingDelete(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <Text style={[styles.header, { color: t.text }]}>Settings</Text>

      {/* Appearance */}
      <View style={styles.group}>
        <Text style={[styles.groupTitle, { color: t.mutedText }]}>
          Appearance
        </Text>
        <View style={[styles.groupCard, { backgroundColor: t.card }]}>
          {["dark", "light", "system"].map((mode, index) => (
            <View key={mode}>
              <TouchableOpacity
                style={styles.row}
                onPress={() =>
                  handleThemeChange(mode as ThemePreference)
                }
              >
                <Text style={[styles.rowLabel, { color: t.text }]}>
                  {mode === "system"
                    ? Platform.OS === "ios"
                      ? "Match System"
                      : "System Default"
                    : mode.charAt(0).toUpperCase() +
                    mode.slice(1)}
                </Text>
                {theme === mode && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={t.primaryBg}
                  />
                )}
              </TouchableOpacity>
              {index !== 2 && (
                <View
                  style={[
                    styles.divider,
                    { backgroundColor: t.border },
                  ]}
                />
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Account */}
      <View style={styles.group}>
        <Text style={[styles.groupTitle, { color: t.mutedText }]}>
          Account
        </Text>
        <View style={[styles.groupCard, { backgroundColor: t.card }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={confirmLogout}
          >
            <Text style={[styles.rowLabel, { color: t.text }]}>
              Sign Out
            </Text>
          </TouchableOpacity>

          <View
            style={[styles.divider, { backgroundColor: t.border }]}
          />

          <TouchableOpacity
            style={styles.row}
            onPress={() => setShowDeleteModal(true)}
          >
            <Text style={[styles.rowLabel, { color: t.danger }]}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* About */}
      <View style={styles.group}>
        <Text style={[styles.groupTitle, { color: t.mutedText }]}>
          About
        </Text>
        <View style={[styles.groupCard, { backgroundColor: t.card }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push("/privacy")}
          >
            <Text style={[styles.rowLabel, { color: t.text }]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>

          <View
            style={[styles.divider, { backgroundColor: t.border }]}
          />

          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push("/terms")}
          >
            <Text style={[styles.rowLabel, { color: t.text }]}>
              Terms of Service
            </Text>
          </TouchableOpacity>

          <View
            style={[styles.divider, { backgroundColor: t.border }]}
          />

          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              WebBrowser.openBrowserAsync(
                "https://rest-assured-rho.vercel.app/login"
              )
            }
          >
            <Text style={[styles.rowLabel, { color: t.text }]}>
              Open Web Version
            </Text>
          </TouchableOpacity>

          <View
            style={[styles.divider, { backgroundColor: t.border }]}
          />

          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: t.text }]}>
              Version
            </Text>
            <Text style={{ color: t.mutedText }}>{VERSION}</Text>
          </View>
        </View>
      </View>

      {/* Delete Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: t.card }]}>
            <Ionicons
              name="warning-outline"
              size={32}
              color={t.danger}
              style={{ alignSelf: "center", marginBottom: 12 }}
            />

            <Text style={[styles.modalTitle, { color: t.text }]}>
              Permanently Delete Account
            </Text>

            <Text style={[styles.modalDesc, { color: t.mutedText }]}>
              This action cannot be undone. Type DELETE and enter your
              password to continue.
            </Text>

            <TextInput
              placeholder="Type DELETE"
              autoCapitalize="characters"
              value={confirmText}
              onChangeText={setConfirmText}
              style={[
                styles.input,
                {
                  borderColor:
                    confirmText &&
                      confirmText !== "DELETE"
                      ? t.danger
                      : t.border,
                  color: t.text,
                },
              ]}
              placeholderTextColor={t.mutedText}
            />

            <TextInput
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={[
                styles.input,
                { borderColor: t.border, color: t.text },
              ]}
              placeholderTextColor={t.mutedText}
            />

            <TouchableOpacity
              onPress={handleDeleteAccount}
              disabled={
                confirmText !== "DELETE" ||
                !password ||
                loadingDelete
              }
              style={[
                styles.fullDeleteButton,
                {
                  backgroundColor:
                    confirmText === "DELETE" && password
                      ? t.danger
                      : t.border,
                },
              ]}
            >
              {loadingDelete ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.fullDeleteText}>
                  Delete Account Permanently
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowDeleteModal(false)}
              style={styles.cancelTextButton}
            >
              <Text style={{ color: t.mutedText, fontSize: 16 }}>
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
  header: {
    fontSize: 32,
    fontWeight: "700",
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  group: { marginBottom: 28 },
  groupTitle: {
    fontSize: 13,
    marginLeft: 20,
    marginBottom: 6,
  },
  groupCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 16,
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: { fontSize: 16 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 22,
    padding: 22,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  modalDesc: {
    fontSize: 14,
    textAlign: "center",
    marginVertical: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  fullDeleteButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  fullDeleteText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelTextButton: {
    marginTop: 16,
    alignItems: "center",
  },
});
