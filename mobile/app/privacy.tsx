import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/src/theme/theme";

export default function PrivacyPolicyScreen() {
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
        <Text style={[styles.title, { color: t.text }]}>Privacy Policy</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.updated, { color: t.mutedText }]}>Last updated: March 2026</Text>

        <Text style={[styles.sectionTitle, { color: t.text }]}>1. Information We Collect</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>
          When you use Rest Assured, we may collect:
        </Text>
        <View style={styles.list}>
          {[
            "Name",
            "Email address (via Google or Apple login)",
            "Workout and exercise data you create",
            "Basic usage analytics to improve the app",
          ].map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={[styles.bullet, { color: t.mutedText }]}>•</Text>
              <Text style={[styles.listText, { color: t.text }]}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: t.text }]}>2. How We Use Your Information</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>We use your information to:</Text>
        <View style={styles.list}>
          {[
            "Provide authentication and account access",
            "Store and display your workout data",
            "Improve app features and performance",
            "Respond to support inquiries",
          ].map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={[styles.bullet, { color: t.mutedText }]}>•</Text>
              <Text style={[styles.listText, { color: t.text }]}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: t.text }]}>3. Third-Party Services</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>
          We use third-party services for authentication and database management. These services may
          process your data according to their own privacy policies.
        </Text>

        <Text style={[styles.sectionTitle, { color: t.text }]}>4. Data Security</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>
          We implement reasonable measures to protect your information. However, no system is
          completely secure.
        </Text>

        <Text style={[styles.sectionTitle, { color: t.text }]}>5. Data Deletion</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>
          You may request deletion of your account data from within the app or by contacting:
        </Text>
        <Text style={[styles.paragraph, { color: t.text, fontWeight: "700" }]}>
          support@restassuredapp.com
        </Text>

        <Text style={[styles.sectionTitle, { color: t.text }]}>6. Changes to This Policy</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>
          We may update this Privacy Policy from time to time. Updates will be reflected on this
          page.
        </Text>

        <Text style={[styles.sectionTitle, { color: t.text }]}>7. Contact</Text>
        <Text style={[styles.paragraph, { color: t.text }]}>
          If you have questions, contact:
        </Text>
        <Text style={[styles.paragraph, { color: t.text, fontWeight: "700" }]}>
          support@restassuredapp.com
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
  list: { marginTop: 4, marginBottom: 8 },
  listItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 2 },
  bullet: { marginRight: 6, marginTop: 2 },
  listText: { flex: 1, fontSize: 14, lineHeight: 20 },
});

