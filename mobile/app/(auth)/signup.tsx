"use client";

import { useMemo, useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  View,
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

WebBrowser.maybeCompleteAuthSession();

function computeRedirectTo() {
  return "restassurednative://login-callback";
}

function isAuthSessionSuccess(
  res: WebBrowser.WebBrowserAuthSessionResult
): res is WebBrowser.WebBrowserAuthSessionResult & { type: "success"; url: string } {
  return (res as any)?.type === "success" && typeof (res as any)?.url === "string";
}

async function sha256(input: string) {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

export default function SignupScreen() {
  const router = useRouter();
  const t = useAppTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  const redirectTo = useMemo(() => computeRedirectTo(), []);

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
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: 24,
        paddingTop: 60,
        paddingBottom: 40,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 20, color: t.text }}>Sign Up</Text>
      <Text style={{ color: t.mutedText, marginBottom: 20 }}>
        Create your account to start logging splits and workouts.
      </Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor={t.mutedText}
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: t.inputBorder,
          backgroundColor: t.inputBg,
          padding: 12,
          borderRadius: 10,
          marginBottom: 16,
          color: t.text,
        }}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        placeholderTextColor={t.mutedText}
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: t.inputBorder,
          backgroundColor: t.inputBg,
          padding: 12,
          borderRadius: 10,
          marginBottom: 24,
          color: t.text,
        }}
      />

      <TouchableOpacity
        onPress={handleSignup}
        disabled={loading}
        style={{ backgroundColor: t.link, padding: 14, borderRadius: 12, alignItems: "center" }}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Sign Up</Text>}
      </TouchableOpacity>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, marginBottom: 14 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
        <Text style={{ color: t.mutedText, fontSize: 12, fontWeight: "600" }}>OR</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
      </View>

      <TouchableOpacity
        onPress={handleGoogleSignup}
        disabled={!!oauthLoading || loading}
        style={{
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.card,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        {oauthLoading === "google" ? (
          <ActivityIndicator color={t.text} />
        ) : (
          <>
            <Ionicons name="logo-google" size={18} color={t.text} />
            <Text style={{ color: t.text, fontWeight: "700" }}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>

      {Platform.OS === "ios" && (
        <TouchableOpacity
          onPress={handleAppleSignup}
          disabled={!!oauthLoading || loading}
          style={{
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.card,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {oauthLoading === "apple" ? (
            <ActivityIndicator color={t.text} />
          ) : (
            <>
              <Ionicons name="logo-apple" size={18} color={t.text} />
              <Text style={{ color: t.text, fontWeight: "700" }}>Continue with Apple</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
        <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
          <Text style={{ color: t.link, fontWeight: "600" }}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
