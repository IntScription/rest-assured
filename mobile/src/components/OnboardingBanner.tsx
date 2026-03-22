import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

type Props = {
  t: any;
  title: string;
  body: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export default function OnboardingBanner({
  t,
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: Props) {
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: t.card, borderColor: t.border },
      ]}
    >
      <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      <Text style={[styles.body, { color: t.mutedText }]}>{body}</Text>

      <View style={styles.actions}>
        {secondaryLabel && onSecondary ? (
          <TouchableOpacity
            onPress={onSecondary}
            style={[
              styles.secondaryBtn,
              { backgroundColor: t.cardAlt, borderColor: t.border },
            ]}
            activeOpacity={0.85}
          >
            <Text style={{ color: t.text, fontWeight: "700" }}>
              {secondaryLabel}
            </Text>
          </TouchableOpacity>
        ) : null}

        {primaryLabel && onPrimary ? (
          <TouchableOpacity
            onPress={onPrimary}
            style={[styles.primaryBtn, { backgroundColor: t.success }]}
            activeOpacity={0.85}
          >
            <Text style={{ color: t.primaryText, fontWeight: "700" }}>
              {primaryLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
});
