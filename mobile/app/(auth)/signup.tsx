"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  View,
  StyleSheet,
  Animated as RNAnimated,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { shouldShowWelcome } from "@/src/lib/welcome";
import AuthAnimatedBackground from "@/components/auth/AuthAnimatedBackground";

WebBrowser.maybeCompleteAuthSession();

function computeRedirectTo() {
  return "restassurednative://login-callback";
}

function isAuthSessionSuccess(
  res: WebBrowser.WebBrowserAuthSessionResult
): res is WebBrowser.WebBrowserAuthSessionResult & {
  type: "success";
  url: string;
} {
  return (res as any)?.type === "success" && typeof (res as any)?.url === "string";
}

async function sha256(input: string) {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
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

export default function SignupScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const authHeading = getAuthHeadingTheme(t);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  const redirectTo = useMemo(() => computeRedirectTo(), []);

  const enterAnim = useRef(new RNAnimated.Value(0)).current;
  const floatAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(enterAnim, {
      toValue: 1,
      duration: 480,
      useNativeDriver: true,
    }).start();

    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(floatAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        RNAnimated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [enterAnim, floatAnim]);

  const routeAfterAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/(tabs)");
      return;
    }

    const showWelcome = await shouldShowWelcome();

    if (showWelcome) {
      router.replace("/welcome");
    } else {
      router.replace("/(tabs)");
    }
  };

  const handleSignup = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      return Alert.alert("Error", "Please enter email and password");
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (error) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Signup Failed", error.message);
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Check your email to confirm account");
      router.replace("/(auth)/login");
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Signup Failed", String(err?.message ?? "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setOauthLoading("google");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No OAuth URL returned.");

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      const resultType = (res as any)?.type;

      if (resultType === "cancel" || resultType === "dismiss") {
        return;
      }

      if (!isAuthSessionSuccess(res)) {
        throw new Error("Google auth session did not succeed.");
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      router.replace({
        pathname: "/(auth)/callback",
        params: { authUrl: encodeURIComponent(res.url) },
      });
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Google sign up failed", String(err?.message ?? "Please try again."));
    } finally {
      setOauthLoading(null);
    }
  };

  const handleAppleSignup = async () => {
    try {
      setOauthLoading("apple");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const rawNonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const hashedNonce = await sha256(rawNonce);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error("No Apple identity token returned.");
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (error) throw error;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await routeAfterAuth();
    } catch (err: any) {
      if (err?.code === "ERR_REQUEST_CANCELED") {
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Apple sign up failed", String(err?.message ?? "Please try again."));
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <AuthAnimatedBackground
      variant="signup"
      contentContainerStyle={styles.authContent}
    >
      <RNAnimated.View
        style={{
          opacity: enterAnim,
          transform: [
            {
              translateY: enterAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
            {
              translateY: floatAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -3],
              }),
            },
          ],
        }}
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
              <Ionicons name="sparkles-outline" size={24} color={t.link} />
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
            Create Account
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
            Start logging splits, workouts, PRs, and progress notes.
          </Text>
        </View>
      </RNAnimated.View>

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
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor={t.mutedText}
          value={email}
          onChangeText={setEmail}
          style={[
            styles.input,
            {
              borderColor: t.inputBorder,
              backgroundColor: t.inputBg,
              color: t.text,
            },
          ]}
        />

        <TextInput
          placeholder="Password"
          secureTextEntry
          placeholderTextColor={t.mutedText}
          value={password}
          onChangeText={setPassword}
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
          onPress={handleSignup}
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
            <Text style={styles.primaryButtonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: t.border }]} />
          <Text style={[styles.dividerText, { color: t.mutedText }]}>OR</Text>
          <View style={[styles.divider, { backgroundColor: t.border }]} />
        </View>

        <TouchableOpacity
          onPress={handleGoogleSignup}
          disabled={!!oauthLoading || loading}
          activeOpacity={0.84}
          style={[
            styles.oauthButton,
            {
              borderColor: t.border,
              backgroundColor: t.card,
              opacity: !!oauthLoading || loading ? 0.72 : 1,
            },
          ]}
        >
          {oauthLoading === "google" ? (
            <ActivityIndicator color={t.text} />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color={t.text} />
              <Text style={[styles.oauthText, { color: t.text }]}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {Platform.OS === "ios" ? (
          <TouchableOpacity
            onPress={handleAppleSignup}
            disabled={!!oauthLoading || loading}
            activeOpacity={0.84}
            style={[
              styles.oauthButton,
              {
                borderColor: t.border,
                backgroundColor: t.card,
                opacity: !!oauthLoading || loading ? 0.72 : 1,
              },
            ]}
          >
            {oauthLoading === "apple" ? (
              <ActivityIndicator color={t.text} />
            ) : (
              <>
                <Ionicons name="logo-apple" size={18} color={t.text} />
                <Text style={[styles.oauthText, { color: t.text }]}>
                  Continue with Apple
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={() => router.push("/(auth)/login")}
          style={styles.singleFooterButton}
        >
          <Text style={[styles.footerLink, { color: t.link }]}>
            Already have an account? Login
          </Text>
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
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
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
    marginTop: 2,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    marginBottom: 14,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  oauthButton: {
    borderWidth: 1,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  oauthText: {
    fontWeight: "800",
  },
  singleFooterButton: {
    marginTop: 10,
    alignItems: "center",
  },
  footerLink: {
    fontWeight: "800",
    fontSize: 13.5,
  },
});

