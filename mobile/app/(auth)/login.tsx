"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { shouldShowWelcome } from "@/src/lib/welcome";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";

WebBrowser.maybeCompleteAuthSession();

function computeRedirectTo() {
  return "restassurednative://login-callback";
}

function isAuthSessionSuccess(
  res: WebBrowser.WebBrowserAuthSessionResult
): res is WebBrowser.WebBrowserAuthSessionResult & { type: "success"; url: string } {
  return (res as any)?.type === "success" && typeof (res as any)?.url === "string";
}

export default function LoginScreen() {
  const router = useRouter();
  const t = useAppTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  const redirectTo = useMemo(() => computeRedirectTo(), []);

  const titleAnim = useRef(new RNAnimated.Value(0)).current;
  const titleFloat = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(titleAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();

    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(titleFloat, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        RNAnimated.timing(titleFloat, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [titleAnim, titleFloat]);

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

  const handleLogin = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      return Alert.alert("Error", "Please enter email and password");
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "Login Failed",
          "Invalid login credentials. If this account was created with Google, use Continue with Google."
        );
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await routeAfterAuth();
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Login Failed", String(err?.message ?? "Please try again."));
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
      Alert.alert("Sign in failed", String(err?.message ?? "Please try again."));
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
      <RNAnimated.Text
        style={{
          fontSize: 30,
          fontWeight: "800",
          marginBottom: 8,
          color: t.text,
          opacity: titleAnim,
          transform: [
            { translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            { translateY: titleFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
          ],
        }}
      >
        Rest Assured
      </RNAnimated.Text>

      <RNAnimated.Text style={{ color: t.mutedText, marginBottom: 24, opacity: titleAnim }}>
        Track workouts, split by split. Built for speed.
      </RNAnimated.Text>

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
        onPress={handleLogin}
        disabled={loading}
        style={{ backgroundColor: t.link, padding: 14, borderRadius: 12, alignItems: "center" }}
      >
        {loading ? (
          <ActivityIndicator color={t.primaryText} />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700" }}>Login</Text>
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
        <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
          <Text style={{ color: t.link, fontWeight: "600" }}>Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")}>
          <Text style={{ color: t.link, fontWeight: "600" }}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
