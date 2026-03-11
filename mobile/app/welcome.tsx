import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { AppTheme, useAppTheme } from "@/src/theme/theme";
import { markWelcomeSeen } from "@/src/lib/welcome";

export default function WelcomeScreen() {
  const router = useRouter();
  const t = useAppTheme();

  const goToApp = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await markWelcomeSeen();
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.badge, { backgroundColor: t.cardAlt, color: t.link, borderColor: t.border }]}>
          Welcome to Rest Assured
        </Text>
        <Text style={[styles.title, { color: t.text }]}>Log smarter. Progress faster.</Text>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Step
            icon="home-outline"
            title="Today tab"
            body="Swipe between your program splits and log exercises for each day. Tap a card to drill into an exercise."
            theme={t}
          />
          <Step
            icon="person-outline"
            title="Profile & programs"
            body="Create programs, add splits, and drag to reorder them. This shapes what you see on the home screen."
            theme={t}
          />
          <Step
            icon="barbell-outline"
            title="Exercise logs"
            body="Inside an exercise, track sets, reps, weight and volume. Use this to see progress over time."
            theme={t}
          />
          <Step
            icon="settings-outline"
            title="Settings"
            body="Switch themes, see app version, and manage your account from the Settings tab."
            theme={t}
          />
        </View>

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: t.success }]} onPress={goToApp}>
          <Text style={[styles.primaryText, { color: t.primaryText }]}>Got it, take me in</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

type StepProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  theme: AppTheme;
};

function Step({ icon, title, body, theme }: StepProps) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepIconWrap, { backgroundColor: theme.cardAlt, borderColor: theme.border }]}>
        <Ionicons name={icon} size={20} color={theme.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stepTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.stepBody, { color: theme.mutedText }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 12,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
  },
  card: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },
  step: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
  },
  stepIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    borderWidth: 1,
  },
  stepTitle: { fontSize: 15, fontWeight: "600" },
  stepBody: { fontSize: 13, marginTop: 2 },
  primaryBtn: {
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
