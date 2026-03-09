import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/src/theme/theme";

export default function TermsOfServiceScreen() {
  const t = useAppTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <View style={styles.header}>
        <Ionicons
          name="chevron-back"
          size={22}
          color={t.text}
          onPress={() => router.back()}
        />
        <Text style={[styles.title, { color: t.text }]}>Terms of Service</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.updated, { color: t.mutedText }]}>Last updated: March 2026</Text>

        <Text style={[styles.sectionTitle, { color: t.text }]}>1. Use of Service</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>
          By using Rest Assured, you agree to use the app only for lawful purposes.
        </Text>

        <Text style={[styles.sectionTitle, { color: t.text }]}>2. Account Responsibility</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>
          You are responsible for maintaining the security of your account.
        </Text>

        <Text style={[styles.sectionTitle, { color: t.text }]}>3. Fitness Disclaimer</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>
          Rest Assured provides workout tracking tools only. We are not responsible for injuries or
          health issues resulting from exercise. Consult a medical professional before beginning any
          fitness program.
        </Text>

        <Text style={[styles.sectionTitle, { color: t.text }]}>4. Service Availability</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>
          We may modify or discontinue features at any time without notice.
        </Text>

        <Text style={[styles.sectionTitle, { color: t.text }]}>5. Limitation of Liability</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>
          We are not liable for indirect or incidental damages arising from the use of the app.
        </Text>

        <Text style={[styles.sectionTitle, { color: t.text }]}>6. Termination</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>
          We may suspend or terminate accounts that violate these terms.
        </Text>

        <Text style={[styles.sectionTitle, { color: t.text }]}>7. Governing Law</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>
          These terms are governed by applicable local laws.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: "700" },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  updated: { fontSize: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 18, marginBottom: 6 },
  paragraph: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
});

