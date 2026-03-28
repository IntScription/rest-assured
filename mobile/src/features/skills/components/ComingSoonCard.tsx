import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/src/theme/theme";

type Props = {
  title: string;
  description: string;
};

export default function ComingSoonCard({ title, description }: Props) {
  const t = useAppTheme();

  return (
    <SafeAreaView style={[styles.wrap, { backgroundColor: t.background }]} edges={["top"]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: t.card,
            borderColor: t.border,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: t.cardAlt }]}>
          <Ionicons name="time-outline" size={22} color={t.text} />
        </View>

        <Text style={[styles.title, { color: t.text }]}>{title}</Text>
        <Text style={[styles.description, { color: t.mutedText }]}>{description}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  description: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
});
