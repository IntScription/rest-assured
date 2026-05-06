"use client";

import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import AuthAnimatedBackground from "@/components/auth/AuthAnimatedBackground";

type AuthRedirectResult =
  | { ok: true }
  | { ok: false; error: string };

async function getInitialAuthUrl() {
  return await Linking.getInitialURL();
}

function getUrlParams(url: string) {
  const hashPart = url.includes("#") ? url.split("#")[1] : "";
  const queryPart = url.includes("?") ? url.split("?")[1]?.split("#")[0] ?? "" : "";
  const source = hashPart || queryPart;

  return new URLSearchParams(source);
}

async function handleAuthRedirectUrl(url: string | null): Promise<AuthRedirectResult> {
  if (!url) return { ok: true };

  const params = getUrlParams(url);

  const error =
    params.get("error_description") ||
    params.get("error") ||
    "";

  if (error) {
    return { ok: false, error };
  }

  const code = params.get("code") ?? "";
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return { ok: false, error: exchangeError.message };
    }

    return { ok: true };
  }

  const accessToken = params.get("access_token") ?? "";
  const refreshToken = params.get("refresh_token") ?? "";

  if (!accessToken || !refreshToken) {
    return { ok: true };
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError) {
    return { ok: false, error: sessionError.message };
  }

  return { ok: true };
}

function isDarkHex(color?: string) {
  if (!color?.startsWith("#")) return false;

  const raw = color.replace("#", "");
  const hex =
    raw.length === 3 ? raw.split("").map((ch) => ch + ch).join("") : raw;

  const value = Number.parseInt(hex.slice(0, 6), 16);
  if (Number.isNaN(value)) return false;

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return 0.299 * r + 0.587 * g + 0.114 * b < 150;
}

function getAuthHeadingTheme(t: any) {
  const isDark =
    isDarkHex(t.background) ||
    isDarkHex(t.card) ||
    t.text === "#ffffff" ||
    t.text === "#FFFFFF";

  return {
    title: isDark ? "#FFFFFF" : "#020617",
    subtitle: isDark ? "rgba(241,245,249,0.92)" : "#1E293B",
    panelBg: isDark ? "rgba(2,6,23,0.34)" : "rgba(255,255,255,0.76)",
    panelBorder: isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)",
    shadow: isDark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.95)",
  };
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const authHeading = getAuthHeadingTheme(t);

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(true);

  useEffect(() => {
    let mounted = true;

    const prepare = async (url: string | null) => {
      const result = await handleAuthRedirectUrl(url);

      if (!mounted) return;

      if (!result.ok) {
        setPreparing(false);
        Alert.alert("Error", result.error);
        return;
      }

      setPreparing(false);
    };

    (async () => {
      const initialUrl = await getInitialAuthUrl();
      await prepare(initialUrl);
    })();

    const sub = Linking.addEventListener("url", async ({ url }) => {
      await prepare(url);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const handleReset = async () => {
    const trimmedPassword = password.trim();

    if (!trimmedPassword) {
      Alert.alert("Error", "Please enter a new password");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: trimmedPassword,
      });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      Alert.alert("Success", "Password updated!", [
        {
          text: "OK",
          onPress: () => router.replace("/(auth)/login"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (preparing) {
    return (
      <AuthAnimatedBackground
        variant="reset"
        scrollEnabled={false}
        contentContainerStyle={styles.loadingContent}
      >
        <ActivityIndicator color={t.text} />
        <Text style={[styles.loadingText, { color: t.mutedText }]}>
          Preparing reset screen…
        </Text>
      </AuthAnimatedBackground>
    );
  }

  return (
    <AuthAnimatedBackground
      variant="reset"
      contentContainerStyle={styles.authContent}
    >
      <View
        style={[
          styles.headingBlock,
          {
            backgroundColor: authHeading.panelBg,
            borderColor: authHeading.panelBorder,
          },
        ]}
      >
        <View style={styles.brandRow}>
          <View
            style={[
              styles.brandIcon,
              {
                backgroundColor: t.card,
                borderColor: t.border,
              },
            ]}
          >
            <Ionicons name="lock-closed-outline" size={24} color={t.link} />
          </View>
        </View>

        <Text
          style={[
            styles.title,
            styles.readableText,
            {
              color: authHeading.title,
              textShadowColor: authHeading.shadow,
            },
          ]}
        >
          Reset Password
        </Text>

        <Text
          style={[
            styles.subtitle,
            styles.readableText,
            {
              color: authHeading.subtitle,
              textShadowColor: authHeading.shadow,
            },
          ]}
        >
          Choose a new password and you’ll be ready to sign back in.
        </Text>
      </View>

      <View
        style={[
          styles.panel,
          {
            backgroundColor: t.card,
            borderColor: t.border,
          },
        ]}
      >
        <TextInput
          placeholder="New Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholderTextColor={t.mutedText}
          style={[
            styles.input,
            {
              borderColor: t.inputBorder,
              backgroundColor: t.inputBg,
              color: t.text,
            },
          ]}
        />

        <TouchableOpacity
          onPress={handleReset}
          disabled={loading}
          activeOpacity={0.86}
          style={[
            styles.primaryButton,
            {
              backgroundColor: t.link,
              opacity: loading ? 0.72 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Reset Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </AuthAnimatedBackground>
  );
}

const styles = StyleSheet.create({
  authContent: {
    justifyContent: "center",
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  loadingContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontWeight: "600",
  },

  headingBlock: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    marginBottom: 24,
    alignItems: "center",
  },
  brandRow: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  brandIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  readableText: {
    textAlign: "center",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  panel: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  input: {
    borderWidth: 1,
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    fontSize: 15,
    fontWeight: "600",
  },
  primaryButton: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
});

