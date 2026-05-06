import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { saveMeasurements } from "@/src/features/coach/api/saveMeasurements";
import { generateCoachInsights } from "@/src/features/coach/api/generateCoachInsights";
import { generateAdjustmentSummary } from "@/src/features/coach/api/generateAdjustmentSummary";
import { generateAiCoachSummary } from "@/src/features/coach/api/generateAiCoachSummary";
import CoachBackHeader from "@/src/features/coach/components/CoachBackHeader";

export default function MeasurementsScreen() {
  const t = useAppTheme();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [weightKg, setWeightKg] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [leftArmCm, setLeftArmCm] = useState("");
  const [rightArmCm, setRightArmCm] = useState("");
  const [leftThighCm, setLeftThighCm] = useState("");
  const [rightThighCm, setRightThighCm] = useState("");
  const [hipsCm, setHipsCm] = useState("");
  const [shouldersCm, setShouldersCm] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setUserId(data.session?.user?.id ?? null);
    })();
    return () => {
      active = false;
    };
  }, []);

  const bodyCompPreview = useMemo(() => {
    if (weightKg && waistCm) {
      return "Good baseline for body composition and waist trend tracking.";
    }
    if (weightKg) {
      return "Weight alone is useful, but waist and body fat make Coach much smarter.";
    }
    return "Add at least weight for the strongest progress tracking.";
  }, [weightKg, waistCm]);

  const handleSave = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      await saveMeasurements({
        user_id: userId,
        weight_kg: weightKg ? Number(weightKg) : null,
        waist_cm: waistCm ? Number(waistCm) : null,
        chest_cm: chestCm ? Number(chestCm) : null,
        left_arm_cm: leftArmCm ? Number(leftArmCm) : null,
        right_arm_cm: rightArmCm ? Number(rightArmCm) : null,
        left_thigh_cm: leftThighCm ? Number(leftThighCm) : null,
        right_thigh_cm: rightThighCm ? Number(rightThighCm) : null,
        hips_cm: hipsCm ? Number(hipsCm) : null,
        shoulders_cm: shouldersCm ? Number(shouldersCm) : null,
        body_fat_percent: bodyFatPercent ? Number(bodyFatPercent) : null,
        note: note || null,
        source: "manual",
      });

      await generateCoachInsights(userId);
      await generateAdjustmentSummary(userId);

      try {
        await generateAiCoachSummary(userId);
      } catch {
        // hosted AI optional
      }

      router.replace("/coach");
    } catch (error: any) {
      Alert.alert("Could not save measurements", error?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <CoachBackHeader
          title="Measurements"
          subtitle="Track physique changes for smarter insights."
          t={t}
        />

        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: t.cardAlt,
              borderColor: t.border,
            },
          ]}
        >
          <View style={styles.heroHeaderRow}>
            <View style={[styles.heroIconWrap, { backgroundColor: t.card }]}>
              <Ionicons name="resize-outline" size={20} color={t.text} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: t.text }]}>Measurements</Text>
              <Text style={[styles.heroSubtitle, { color: t.mutedText }]}>
                Track body changes so Coach can read progress beyond just workout numbers.
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.previewStrip,
              {
                backgroundColor: t.card,
                borderColor: t.border,
              },
            ]}
          >
            <Ionicons name="analytics-outline" size={16} color={t.text} />
            <Text style={[styles.previewText, { color: t.text }]}>
              {bodyCompPreview}
            </Text>
          </View>
        </View>

        <SectionCard title="Core metrics" icon="barbell-outline" t={t}>
          <LabeledInput
            label="Weight (kg)"
            value={weightKg}
            onChangeText={setWeightKg}
            t={t}
            keyboardType="decimal-pad"
            placeholder="e.g. 72.4"
          />
          <LabeledInput
            label="Body fat %"
            value={bodyFatPercent}
            onChangeText={setBodyFatPercent}
            t={t}
            keyboardType="decimal-pad"
            placeholder="Optional"
          />
          <LabeledInput
            label="Waist (cm)"
            value={waistCm}
            onChangeText={setWaistCm}
            t={t}
            keyboardType="decimal-pad"
            placeholder="Important for physique tracking"
          />
        </SectionCard>

        <SectionCard title="Upper body" icon="body-outline" t={t}>
          <LabeledInput
            label="Chest (cm)"
            value={chestCm}
            onChangeText={setChestCm}
            t={t}
            keyboardType="decimal-pad"
            placeholder="Optional"
          />
          <LabeledInput
            label="Left arm (cm)"
            value={leftArmCm}
            onChangeText={setLeftArmCm}
            t={t}
            keyboardType="decimal-pad"
            placeholder="Optional"
          />
          <LabeledInput
            label="Right arm (cm)"
            value={rightArmCm}
            onChangeText={setRightArmCm}
            t={t}
            keyboardType="decimal-pad"
            placeholder="Optional"
          />
          <LabeledInput
            label="Shoulders (cm)"
            value={shouldersCm}
            onChangeText={setShouldersCm}
            t={t}
            keyboardType="decimal-pad"
            placeholder="Optional"
          />
        </SectionCard>

        <SectionCard title="Lower body" icon="walk-outline" t={t}>
          <LabeledInput
            label="Hips (cm)"
            value={hipsCm}
            onChangeText={setHipsCm}
            t={t}
            keyboardType="decimal-pad"
            placeholder="Optional"
          />
          <LabeledInput
            label="Left thigh (cm)"
            value={leftThighCm}
            onChangeText={setLeftThighCm}
            t={t}
            keyboardType="decimal-pad"
            placeholder="Optional"
          />
          <LabeledInput
            label="Right thigh (cm)"
            value={rightThighCm}
            onChangeText={setRightThighCm}
            t={t}
            keyboardType="decimal-pad"
            placeholder="Optional"
          />
        </SectionCard>

        <SectionCard title="Notes" icon="document-text-outline" t={t}>
          <LabeledInput
            label="Context"
            value={note}
            onChangeText={setNote}
            t={t}
            multiline
            placeholder="Morning weight, fasted, post-workout, pump, bloating, etc."
          />
        </SectionCard>

        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: t.primaryBg,
              opacity: loading ? 0.7 : 1,
            },
          ]}
          onPress={handleSave}
          disabled={loading}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={t.primaryText}
            style={styles.saveButtonIcon}
          />
          <Text style={[styles.saveButtonText, { color: t.primaryText }]}>
            {loading ? "Saving..." : "Save Measurements"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard({
  title,
  icon,
  t,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  t: any;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: t.card,
          borderColor: t.border,
        },
      ]}
    >
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: t.cardAlt }]}>
          <Ionicons name={icon} size={16} color={t.text} />
        </View>
        <Text style={[styles.sectionTitle, { color: t.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  t,
  keyboardType,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  t: any;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={styles.inputWrap}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={t.mutedText}
        style={[
          styles.input,
          {
            color: t.text,
            borderColor: t.border,
            backgroundColor: t.cardAlt,
            height: multiline ? 96 : 48,
            textAlignVertical: multiline ? "top" : "center",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    padding: 16,
    paddingBottom: 36,
  },

  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  heroHeaderRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  heroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  previewStrip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },

  sectionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },

  inputWrap: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },

  saveButton: {
    marginTop: 4,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
});
