"use client";

import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useAppTheme } from "@/src/theme/theme";
import { handleAuthRedirectUrl, getInitialAuthUrl } from "@/src/lib/auth-redirect";
import { shouldShowWelcome } from "@/src/lib/welcome";
import { supabase } from "@/src/lib/supabase";

function hasAuthPayload(url: string | null) {
  if (!url) return false;
  return (
    url.includes("code=") ||
    url.includes("access_token=") ||
    url.includes("refresh_token=") ||
    url.includes("type=recovery") ||
    url.includes("type=signup")
  );
}

export default function AuthCallback() {
  const router = useRouter();
  const t = useAppTheme();
  const [loading, setLoading] = useState(true);
  const params = useLocalSearchParams<{ authUrl?: string }>();

  useEffect(() => {
    let mounted = true;
    let handled = false;

    const routeIntoApp = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setLoading(false);
        router.replace("/(auth)/login");
        return;
      }

      const showWelcome = await shouldShowWelcome();

      if (!mounted) return;

      setLoading(false);

      if (showWelcome) {
        router.replace("/welcome");
      } else {
        router.replace("/(tabs)");
      }
    };

    const tryFinishAuth = async (url: string | null) => {
      if (!mounted || handled || !url) return false;

      const result = await handleAuthRedirectUrl(url);

      if (!mounted || handled) return false;

      if (result.ok) {
        handled = true;
        await routeIntoApp();
        return true;
      }

      // If this URL simply doesn't contain auth data yet,
      // don't fail immediately — let fallback paths try.
      if (
        result.error === "No callback URL received." ||
        result.error === "No auth code or tokens found in callback URL."
      ) {
        return false;
      }

      handled = true;
      setLoading(false);
      Alert.alert("Auth Error", result.error, [
        { text: "OK", onPress: () => router.replace("/(auth)/login") },
      ]);
      return true;
    };

    const start = async () => {
      const passedUrl =
        typeof params.authUrl === "string" ? decodeURIComponent(params.authUrl) : null;

      // 1) Try the URL passed from login/signup
      if (hasAuthPayload(passedUrl)) {
        const done = await tryFinishAuth(passedUrl);
        if (done) return;
      }

      // 2) Try initial URL from deep link
      const initialUrl = await getInitialAuthUrl();
      if (hasAuthPayload(initialUrl)) {
        const done = await tryFinishAuth(initialUrl);
        if (done) return;
      }

      // 3) Wait briefly for a late-arriving Linking event (common on iOS)
      setTimeout(async () => {
        if (!mounted || handled) return;

        const lateUrl = await Linking.getInitialURL();
        if (hasAuthPayload(lateUrl)) {
          const done = await tryFinishAuth(lateUrl);
          if (done) return;
        }

        if (!handled) {
          setLoading(false);
          Alert.alert(
            "Auth Error",
            "No auth code or tokens found in callback URL.",
            [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
          );
        }
      }, 1200);
    };

    const sub = Linking.addEventListener("url", async ({ url }) => {
      await tryFinishAuth(url);
    });

    start();

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [router, params.authUrl]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: t.background,
      }}
    >
      {loading && <ActivityIndicator color={t.text} />}
      <Text style={{ color: t.text, marginTop: 12 }}>Signing you in…</Text>
    </View>
  );
}
