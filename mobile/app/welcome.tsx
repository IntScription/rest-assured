import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/src/theme/theme";
import { markWelcomeSeen } from "@/src/lib/welcome";
import {
  setOnboardingStep,
  startOnboarding,
  stopOnboarding,
} from "@/src/lib/onboarding";
import { supabase } from "@/src/lib/supabase";

type WelcomeMode = "setup" | "tour_cleanup" | "good_to_go";

type WelcomeContent = {
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type SetupPoint = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const SETUP_POINTS: SetupPoint[] = [
  {
    icon: "barbell-outline",
    title: "Start in Train",
    body: "Create your program and splits first.",
  },
  {
    icon: "home-outline",
    title: "Go to Home",
    body: "Tap add exercise after the setup is ready.",
  },
  {
    icon: "create-outline",
    title: "Log your first workout",
    body: "Add the exercise, log it, then continue through the tutorial flow.",
  },
  {
    icon: "analytics-outline",
    title: "Finish on Advanced Insights",
    body: "After insights, you return here to keep or delete the tutorial program.",
  },
];

function getModeFromParam(mode?: string): WelcomeMode {
  if (mode === "tour_cleanup") return "tour_cleanup";
  if (mode === "good_to_go") return "good_to_go";
  return "setup";
}

export default function WelcomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    tutorialProgramId?: string;
  }>();
  const t = useAppTheme();

  const [loading, setLoading] = useState(false);

  const mode = useMemo(() => getModeFromParam(params?.mode), [params?.mode]);

  const tutorialProgramId = useMemo(() => {
    if (
      typeof params?.tutorialProgramId === "string" &&
      params.tutorialProgramId.trim().length > 0
    ) {
      return params.tutorialProgramId.trim();
    }
    return null;
  }, [params?.tutorialProgramId]);

  const canDeleteTutorialProgram =
    mode === "tour_cleanup" && !!tutorialProgramId;

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroLift = useRef(new Animated.Value(18)).current;
  const pulse = useRef(new Animated.Value(0.97)).current;

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroLift, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.97,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    entrance.start();
    loop.start();

    return () => {
      entrance.stop();
      loop.stop();
    };
  }, [heroFade, heroLift, pulse]);

  const handleGuidedSetup = useCallback(async () => {
    if (loading) return;

    try {
      setLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await markWelcomeSeen();
      await startOnboarding();

      router.replace("/(tabs)/train");
    } catch {
      Alert.alert("Error", "Could not start guided setup.");
    } finally {
      setLoading(false);
    }
  }, [loading, router]);

  const handleKeepTutorialProgram = useCallback(async () => {
    if (loading) return;

    try {
      setLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await markWelcomeSeen();
      await stopOnboarding();
      await setOnboardingStep("idle");

      router.replace("/(tabs)");
    } catch {
      Alert.alert("Error", "Could not finish setup.");
    } finally {
      setLoading(false);
    }
  }, [loading, router]);

  const deleteTutorialProgram = useCallback(async (programId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    const { error } = await supabase
      .from("programs")
      .delete()
      .eq("id", programId)
      .eq("user_id", user.id);

    if (error) throw error;

    const { data: programs, error: nextProgramError } = await supabase
      .from("programs")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (nextProgramError) throw nextProgramError;

    if (programs && programs.length > 0) {
      const nextProgram = programs[0];

      const { error: activateError } = await supabase
        .from("programs")
        .update({ is_active: true })
        .eq("id", nextProgram.id)
        .eq("user_id", user.id);

      if (activateError) throw activateError;
    }

    return true;
  }, []);

  const confirmDeleteProgram = useCallback(() => {
    if (!tutorialProgramId) {
      Alert.alert("Program not found", "There is no tutorial program to delete.");
      return;
    }

    Alert.alert(
      "Delete tutorial program?",
      "This will remove the tutorial program completely.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              const success = await deleteTutorialProgram(tutorialProgramId);
              if (!success) return;

              await markWelcomeSeen();
              await stopOnboarding();
              await setOnboardingStep("idle");

              router.replace("/(tabs)");
            } catch {
              Alert.alert("Delete failed", "Could not delete the program.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [deleteTutorialProgram, router, tutorialProgramId]);

  const content = useMemo<WelcomeContent>(() => {
    if (mode === "tour_cleanup") {
      return {
        badge: "Tutorial complete",
        title: "Final step",
        subtitle:
          "Keep the tutorial program if you want it, or delete it for a clean start.",
        description:
          "You finished the onboarding flow: Train → Home → Add Exercise → Log → Advanced Insights. Choose whether to keep the sample program, then continue normally.",
        icon: "checkmark-done-circle-outline",
      };
    }

    if (mode === "good_to_go") {
      return {
        badge: "All set",
        title: "You’re good to go",
        subtitle: "Everything is ready.",
        description:
          "Your onboarding is complete. Head to Home and continue using the app normally.",
        icon: "sparkles-outline",
      };
    }

    return {
      badge: "Guided setup",
      title: "Let’s set up your first flow.",
      subtitle:
        "You’ll start in Train, build the structure, then move through the actual logging flow.",
      description:
        "The onboarding starts on the Train tab. First create a program and splits. Then you go to Home, add an exercise, log it, review Advanced Insights, and finally return here to keep or delete the tutorial program.",
      icon: "barbell-outline",
    };
  }, [mode]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.heroWrap,
            {
              opacity: heroFade,
              transform: [{ translateY: heroLift }],
            },
          ]}
        >
          <Text
            style={[
              styles.badge,
              {
                backgroundColor: t.cardAlt,
                color: t.link,
                borderColor: t.border,
              },
            ]}
          >
            {content.badge}
          </Text>

          <View
            style={[
              styles.heroCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <View style={styles.heroTopRow}>
              <Animated.View
                style={[
                  styles.heroIconWrap,
                  {
                    backgroundColor: t.cardAlt,
                    borderColor: t.border,
                    transform: [{ scale: pulse }],
                  },
                ]}
              >
                <Ionicons name={content.icon} size={24} color={t.text} />
              </Animated.View>

              <View style={styles.heroGlowRow}>
                <View
                  style={[styles.heroGlow, { backgroundColor: t.success }]}
                />
                <View
                  style={[styles.heroGlowSmall, { backgroundColor: t.link }]}
                />
              </View>
            </View>

            <Text style={[styles.title, { color: t.text }]}>{content.title}</Text>

            {!!content.subtitle ? (
              <Text style={[styles.subtitle, { color: t.text }]}>
                {content.subtitle}
              </Text>
            ) : null}

            <Text style={[styles.description, { color: t.mutedText }]}>
              {content.description}
            </Text>

            {mode === "setup" ? (
              <View style={styles.featureList}>
                {SETUP_POINTS.map((point) => (
                  <View
                    key={point.title}
                    style={[
                      styles.featureCard,
                      { backgroundColor: t.cardAlt, borderColor: t.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.featureIconWrap,
                        { borderColor: t.border },
                      ]}
                    >
                      <Ionicons name={point.icon} size={16} color={t.text} />
                    </View>

                    <View style={styles.featureTextWrap}>
                      <Text style={[styles.featureTitle, { color: t.text }]}>
                        {point.title}
                      </Text>
                      <Text
                        style={[styles.featureBody, { color: t.mutedText }]}
                      >
                        {point.body}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Animated.View>

        {mode === "setup" ? (
          <>
            <View
              style={[
                styles.infoStrip,
                { backgroundColor: t.cardAlt, borderColor: t.border },
              ]}
            >
              <Ionicons name="time-outline" size={16} color={t.mutedText} />
              <Text style={[styles.infoStripText, { color: t.mutedText }]}>
                Starts in Train and walks through the full beginner flow.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { backgroundColor: t.success, opacity: loading ? 0.72 : 1 },
              ]}
              onPress={handleGuidedSetup}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color={t.primaryText} />
              ) : (
                <>
                  <Text style={[styles.primaryText, { color: t.primaryText }]}>
                    Start guided setup
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={t.primaryText}
                  />
                </>
              )}
            </TouchableOpacity>
          </>
        ) : null}

        {mode === "tour_cleanup" ? (
          <>
            <Text style={[styles.subtle, { color: t.mutedText }]}>
              {content.subtitle}
            </Text>

            {canDeleteTutorialProgram ? (
              <TouchableOpacity
                style={[styles.dangerBtn, { opacity: loading ? 0.72 : 1 }]}
                onPress={confirmDeleteProgram}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.dangerText}>Delete program</Text>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: t.cardAlt,
                  borderColor: t.border,
                  opacity: loading ? 0.72 : 1,
                },
              ]}
              onPress={handleKeepTutorialProgram}
              disabled={loading}
              activeOpacity={0.88}
            >
              <Text style={[styles.secondaryText, { color: t.text }]}>
                Keep program
              </Text>
            </TouchableOpacity>
          </>
        ) : null}

        {mode === "good_to_go" ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: t.success }]}
            onPress={() => router.replace("/(tabs)")}
            activeOpacity={0.9}
          >
            <Text style={[styles.primaryText, { color: t.primaryText }]}>
              Go to Home
            </Text>
            <Ionicons name="arrow-forward" size={16} color={t.primaryText} />
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 40,
  },
  heroWrap: {
    marginBottom: 18,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    gap: 10,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  heroIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroGlowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroGlow: {
    width: 34,
    height: 10,
    borderRadius: 999,
    opacity: 0.14,
  },
  heroGlowSmall: {
    width: 18,
    height: 10,
    borderRadius: 999,
    opacity: 0.12,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
  featureList: {
    gap: 10,
    marginTop: 8,
  },
  featureCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  featureIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  featureBody: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  infoStrip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  infoStripText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    lineHeight: 18,
  },
  subtle: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: 6,
    padding: 15,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: "700",
  },
  dangerBtn: {
    marginTop: 24,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#dc2626",
    alignItems: "center",
  },
  dangerText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
