"use client";

import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useAppTheme } from "@/src/theme/theme";
import { handleAuthRedirectUrl, getInitialAuthUrl } from "@/src/lib/auth-redirect";
import { supabase } from "@/src/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const t = useAppTheme();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const finishAuth = async (url: string | null) => {
      const result = await handleAuthRedirectUrl(url);

      if (!mounted) return;

      if (!result.ok) {
        setLoading(false);
        Alert.alert("Auth Error", result.error, [
          { text: "OK", onPress: () => router.replace("/(auth)/login") },
        ]);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        router.replace("/(auth)/login");
        return;
      }

      const created = new Date(user.created_at).getTime();
      const now = Date.now();
      const isNewUser = now - created < 60000;

      setLoading(false);

      if (result.type === "signup" || isNewUser) {
        router.replace("/welcome");
      } else {
        router.replace("/(tabs)");
      }
    };

    (async () => {
      const initialUrl = await getInitialAuthUrl();
      await finishAuth(initialUrl);
    })();

    const sub = Linking.addEventListener("url", async ({ url }) => {
      await finishAuth(url);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [router]);

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
