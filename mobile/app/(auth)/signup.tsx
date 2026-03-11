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

export default function SignupScreen() {
  const router = useRouter();
  const t = useAppTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  const redirectTo = useMemo(() => computeRedirectTo(), []);

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
        throw new Error("Auth session did not succeed.");
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(auth)/callback");
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Sign up failed", String(err?.message ?? "Please try again."));
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
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 20, color: t.text }}>
        Sign Up
      </Text>
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
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700" }}>Sign Up</Text>
        )}
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
