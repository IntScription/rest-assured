"use client";

import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/src/theme/theme";
import AuthAnimatedBackground from "@/components/auth/AuthAnimatedBackground";

function computeResetRedirectTo() {
  return "restassurednative://reset-password";
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const authHeading = getAuthHeadingTheme(t);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const emailInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => emailInputRef.current?.focus(), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleForgot = async () => {
    if (loading) return;

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return Alert.alert("Error", "Please enter your email");
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: computeResetRedirectTo(),
      });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      Alert.alert(
        "Check your email",
        "We sent you a password reset link. Open it on this device to reset your password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthAnimatedBackground
      variant="forgot"
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
            <Ionicons name="mail-open-outline" size={24} color={t.link} />
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
          Forgot Password
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
          Enter your email and we’ll send a secure reset link to your inbox.
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
          ref={emailInputRef}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor={t.mutedText}
          value={email}
          onChangeText={setEmail}
          returnKeyType="send"
          onSubmitEditing={handleForgot}
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
          onPress={handleForgot}
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
            <Text style={styles.primaryButtonText}>Send Reset Email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(auth)/login")}
          style={styles.footerButton}
        >
          <Text style={[styles.footerLink, { color: t.link }]}>Back to Login</Text>
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
  footerButton: {
    marginTop: 16,
    alignItems: "center",
  },
  footerLink: {
    fontWeight: "800",
    fontSize: 13.5,
  },
});

