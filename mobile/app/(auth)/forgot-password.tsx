"use client";

import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { supabase } from "@/src/lib/supabase";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/src/theme/theme";

function computeResetRedirectTo() {
  return "restassurednative://reset-password";
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgot = async () => {
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
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: t.background }}>
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 32, color: t.text }}>
        Forgot Password
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
          marginBottom: 24,
          color: t.text,
        }}
      />

      <TouchableOpacity
        onPress={handleForgot}
        disabled={loading}
        style={{ backgroundColor: t.link, padding: 14, borderRadius: 12, alignItems: "center" }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700" }}>Send Reset Email</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/login")} style={{ marginTop: 16 }}>
        <Text style={{ color: t.link, fontWeight: "600" }}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}
