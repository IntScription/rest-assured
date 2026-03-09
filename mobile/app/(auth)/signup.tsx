"use client";

import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";

WebBrowser.maybeCompleteAuthSession();

function computeRedirectTo() {
  return "restassurednative://login-callback";
}

function isAuthSessionSuccess(
  res: WebBrowser.WebBrowserAuthSessionResult
): res is WebBrowser.WebBrowserAuthSessionResult & { type: "success"; url: string } {
  return (res as any)?.type === "success" && typeof (res as any)?.url === "string";
}

function parseHashParams(url: string) {
  const hash = url.split("#")[1] ?? "";
  return new URLSearchParams(hash);
}

export default function SignupScreen() {
  const router = useRouter();
  const t = useAppTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  const redirectTo = useMemo(() => computeRedirectTo(), []);

  useEffect(() => { }, [redirectTo]);

  const routeAfterAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/(tabs)");
      return;
    }

    const created = new Date(user.created_at).getTime();
    const now = Date.now();
    const isNewUser = now - created < 60000;

    if (isNewUser) {
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

  const handleOAuth = async (provider: "google" | "apple") => {
    try {
      setOauthLoading(provider);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No OAuth URL returned.");

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (!isAuthSessionSuccess(res)) {
        if ((res as any)?.type === "cancel" || (res as any)?.type === "dismiss") return;
        throw new Error(`Auth session did not succeed. Result: ${JSON.stringify(res)}`);
      }

      let parsed: URL | null = null;
      try {
        parsed = new URL(res.url);
      } catch {
        parsed = null;
      }

      const code = parsed?.searchParams?.get("code") ?? null;

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await routeAfterAuth();
        return;
      }

      const hashParams = parseHashParams(res.url);
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");

      if (!access_token || !refresh_token) {
        const err = parsed?.searchParams?.get("error") ?? hashParams.get("error");
        const desc = parsed?.searchParams?.get("error_description") ?? hashParams.get("error_description");
        throw new Error(desc || err || `No code or tokens returned. Callback: ${res.url}`);
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (setSessionError) throw setSessionError;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await routeAfterAuth();
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = String(err?.message ?? "");
      Alert.alert("Sign up failed", msg || "Please try again.");
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, paddingTop: 60, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 20, color: t.text }}>Sign Up</Text>
      <Text style={{ color: t.mutedText, marginBottom: 20 }}>Create your account to start logging splits and workouts.</Text>

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
        onPress={() => handleOAuth("google")}
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
          onPress={() => handleOAuth("apple")}
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
