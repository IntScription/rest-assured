"use client";

import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { handleAuthRedirectUrl, getInitialAuthUrl } from "@/src/lib/auth-redirect";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const t = useAppTheme();

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
      <View style={{ flex: 1, backgroundColor: t.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={t.text} />
        <Text style={{ color: t.mutedText, marginTop: 12 }}>Preparing reset screen…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.background, justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 16, color: t.text }}>
        Reset Password
      </Text>

      <TextInput
        placeholder="New Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholderTextColor={t.mutedText}
        style={{
          borderWidth: 1,
          borderColor: t.inputBorder,
          backgroundColor: t.inputBg,
          color: t.text,
          padding: 12,
          borderRadius: 10,
          marginBottom: 24,
        }}
      />

      <TouchableOpacity
        onPress={handleReset}
        style={{
          backgroundColor: t.primaryBg,
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        }}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={t.primaryText} />
        ) : (
          <Text style={{ color: t.primaryText, fontWeight: "700" }}>Reset Password</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
