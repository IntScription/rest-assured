import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { useAppleHealthSync } from "@/src/features/coach/health/useAppleHealthSync";
import { saveCoachProfile } from "@/src/features/coach/api/saveCoachProfile";
import { saveMeasurements } from "@/src/features/coach/api/saveMeasurements";
import { generateCoachInsights } from "@/src/features/coach/api/generateCoachInsights";
import { generateProgramDraft } from "@/src/features/coach/api/generateProgramDraft";
import { generateAdjustmentSummary } from "@/src/features/coach/api/generateAdjustmentSummary";
import { generateAiCoachSummary } from "@/src/features/coach/api/generateAiCoachSummary";
import CoachBackHeader from "@/src/features/coach/components/CoachBackHeader";

const SEX_OPTIONS = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
] as const;

const GOAL_OPTIONS = [
  { label: "Hypertrophy", value: "hypertrophy" },
  { label: "Strength", value: "strength" },
  { label: "Skill", value: "skill" },
  { label: "Fat loss", value: "fat_loss" },
  { label: "General fitness", value: "general_fitness" },
] as const;


const TRAINING_STYLE_OPTIONS = [
  { label: "Calisthenics", value: "calisthenics" },
  { label: "Weighted cali", value: "weighted_calisthenics" },
  { label: "Gym", value: "gym" },
  { label: "Hybrid", value: "hybrid" },
  { label: "Bodyweight", value: "bodyweight" },
] as const;

const EXPERIENCE_OPTIONS = [
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
] as const;

const ACTIVITY_OPTIONS = [
  { label: "Sedentary", value: "sedentary" },
  { label: "Light", value: "light" },
  { label: "Moderate", value: "moderate" },
  { label: "Active", value: "active" },
  { label: "Very active", value: "very_active" },
] as const;

export default function CoachOnboardingScreen() {
  const t = useAppTheme();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);

  const { loading: healthLoading, lastSnapshot, syncNow } = useAppleHealthSync();

  const [age, setAge] = useState("");
  const [sex, setSex] = useState<(typeof SEX_OPTIONS)[number]["value"]>("male");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [goal, setGoal] = useState<(typeof GOAL_OPTIONS)[number]["value"]>("strength");
  const [trainingStyle, setTrainingStyle] =
    useState<(typeof TRAINING_STYLE_OPTIONS)[number]["value"]>("weighted_calisthenics");
  const [experienceLevel, setExperienceLevel] =
    useState<(typeof EXPERIENCE_OPTIONS)[number]["value"]>("beginner");
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState("4");
  const [activityLevel, setActivityLevel] =
    useState<(typeof ACTIVITY_OPTIONS)[number]["value"]>("moderate");
  const [injuryNotes, setInjuryNotes] = useState("");
  const [equipmentNotes, setEquipmentNotes] = useState("");

  const [waistCm, setWaistCm] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [leftArmCm, setLeftArmCm] = useState("");
  const [rightArmCm, setRightArmCm] = useState("");
  const [leftThighCm, setLeftThighCm] = useState("");
  const [rightThighCm, setRightThighCm] = useState("");
  const [hipsCm, setHipsCm] = useState("");
  const [shouldersCm, setShouldersCm] = useState("");

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

  const canSubmit = useMemo(() => {
    return age.trim() && heightCm.trim() && weightKg.trim() && trainingDaysPerWeek.trim();
  }, [age, heightCm, weightKg, trainingDaysPerWeek]);

  const summaryText = useMemo(() => {
    if (healthConnected) {
      return "Coach will use your profile, measurements, and Apple Health data for more accurate recommendations.";
    }
    if (waistCm || chestCm || leftArmCm || rightArmCm || leftThighCm || rightThighCm || hipsCm || shouldersCm) {
      return "Nice. You’ve added body measurements, which makes Coach better at tracking change.";
    }
    return "Finish the essentials first. Measurements and Apple Health make Coach smarter, but they’re optional.";
  }, [
    healthConnected,
    waistCm,
    chestCm,
    leftArmCm,
    rightArmCm,
    leftThighCm,
    rightThighCm,
    hipsCm,
    shouldersCm,
  ]);

  const handleConnectAppleHealth = async () => {
    if (!userId) return;

    try {
      const snapshot = await syncNow(userId, 7);
      setHealthConnected(true);

      if (!weightKg && snapshot.body_mass_kg != null) {
        setWeightKg(String(snapshot.body_mass_kg));
      }

      Alert.alert(
        "Apple Health connected",
        "Coach can now use recent health data to improve recommendations."
      );
    } catch (error: any) {
      Alert.alert(
        "Apple Health connection failed",
        error?.message ?? "Could not connect Apple Health."
      );
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    if (!canSubmit) {
      Alert.alert("Missing fields", "Please fill the required basics first.");
      return;
    }

    try {
      setLoading(true);

      await saveCoachProfile({
        user_id: userId,
        age: Number(age),
        sex,
        height_cm: Number(heightCm),
        weight_kg: Number(weightKg),
        goal,
        training_style: trainingStyle,
        experience_level: experienceLevel,
        training_days_per_week: Number(trainingDaysPerWeek),
        activity_level: activityLevel,
        injury_notes: injuryNotes || null,
        equipment_notes: equipmentNotes || null,
        apple_health_connected: healthConnected,
        onboarding_completed: true,
        onboarding_step: "complete",
      });

      const hasAnyMeasurement =
        waistCm || chestCm || leftArmCm || rightArmCm || leftThighCm || rightThighCm || hipsCm || shouldersCm;

      await saveMeasurements({
        user_id: userId,
        weight_kg: Number(weightKg),
        waist_cm: waistCm ? Number(waistCm) : null,
        chest_cm: chestCm ? Number(chestCm) : null,
        left_arm_cm: leftArmCm ? Number(leftArmCm) : null,
        right_arm_cm: rightArmCm ? Number(rightArmCm) : null,
        left_thigh_cm: leftThighCm ? Number(leftThighCm) : null,
        right_thigh_cm: rightThighCm ? Number(rightThighCm) : null,
        hips_cm: hipsCm ? Number(hipsCm) : null,
        shoulders_cm: shouldersCm ? Number(shouldersCm) : null,
        note: hasAnyMeasurement
          ? "Initial coach onboarding measurements"
          : "Initial coach onboarding weight",
        source: "manual",
      });

      await generateCoachInsights(userId);
      await generateProgramDraft(userId);
      await generateAdjustmentSummary(userId);

      try {
        await generateAiCoachSummary(userId);
      } catch {
        // optional hosted AI
      }

      router.replace("/coach");
    } catch (error: any) {
      Alert.alert("Could not save Coach setup", error?.message ?? "Something went wrong.");
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CoachBackHeader
          title="Coach Setup"
          subtitle="Set your baseline for personalized coaching."
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
              <Ionicons name="sparkles-outline" size={20} color={t.text} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: t.text }]}>Coach Setup</Text>
              <Text style={[styles.heroSubtitle, { color: t.mutedText }]}>
                Build your baseline so Coach can personalize training, recovery,
                progression, and health sync more accurately.
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
            <Ionicons name="sparkles-outline" size={16} color={t.text} />
            <Text style={[styles.previewText, { color: t.text }]}>
              {summaryText}
            </Text>
          </View>
        </View>

        <SectionCard title="Required basics" icon="person-outline" t={t}>
          <LabeledInput
            label="Age"
            value={age}
            onChangeText={setAge}
            t={t}
            keyboardType="number-pad"
            placeholder="e.g. 24"
          />
          <LabeledInput
            label="Height (cm)"
            value={heightCm}
            onChangeText={setHeightCm}
            t={t}
            keyboardType="decimal-pad"
            placeholder="e.g. 175"
          />
          <LabeledInput
            label="Weight (kg)"
            value={weightKg}
            onChangeText={setWeightKg}
            t={t}
            keyboardType="decimal-pad"
            placeholder="e.g. 72.5"
          />
          <LabeledInput
            label="Training days per week"
            value={trainingDaysPerWeek}
            onChangeText={setTrainingDaysPerWeek}
            t={t}
            keyboardType="number-pad"
            placeholder="e.g. 4"
          />

          <ChipSelector
            label="Sex"
            value={sex}
            options={SEX_OPTIONS}
            onChange={setSex}
            t={t}
          />

          <ChipSelector
            label="Goal"
            value={goal}
            options={GOAL_OPTIONS}
            onChange={setGoal}
            t={t}
          />

          <ChipSelector
            label="Training style"
            value={trainingStyle}
            options={TRAINING_STYLE_OPTIONS}
            onChange={setTrainingStyle}
            t={t}
          />

          <ChipSelector
            label="Experience level"
            value={experienceLevel}
            options={EXPERIENCE_OPTIONS}
            onChange={setExperienceLevel}
            t={t}
          />

          <ChipSelector
            label="Activity level"
            value={activityLevel}
            options={ACTIVITY_OPTIONS}
            onChange={setActivityLevel}
            t={t}
          />
        </SectionCard>

        <SectionCard title="Optional body measurements" icon="resize-outline" t={t}>
          <LabeledInput
            label="Waist (cm)"
            value={waistCm}
            onChangeText={setWaistCm}
            t={t}
            keyboardType="decimal-pad"
            placeholder="Optional but very useful"
          />
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
          <LabeledInput
            label="Hips (cm)"
            value={hipsCm}
            onChangeText={setHipsCm}
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

        <SectionCard title="Apple Health" icon="heart-outline" t={t}>
          <View style={styles.healthRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.healthTitle, { color: t.text }]}>
                Connect Apple Health
              </Text>
              <Text style={[styles.healthText, { color: t.mutedText }]}>
                Import steps, sleep, resting heart rate, active energy, and body mass
                to improve coaching accuracy.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.healthButton,
                {
                  backgroundColor: healthConnected ? t.card : t.primaryBg,
                  borderColor: t.border,
                  opacity: healthLoading ? 0.8 : 1,
                },
              ]}
              onPress={handleConnectAppleHealth}
              disabled={healthLoading}
            >
              <Text
                style={[
                  styles.healthButtonText,
                  { color: healthConnected ? t.text : t.primaryText },
                ]}
              >
                {healthLoading ? "Syncing..." : healthConnected ? "Connected" : "Connect"}
              </Text>
            </TouchableOpacity>
          </View>

          {lastSnapshot ? (
            <View
              style={[
                styles.snapshotCard,
                {
                  backgroundColor: t.cardAlt,
                  borderColor: t.border,
                },
              ]}
            >
              <SnapshotRow label="Steps" value={lastSnapshot.steps} t={t} />
              <SnapshotRow label="Sleep (min)" value={lastSnapshot.sleep_minutes} t={t} />
              <SnapshotRow label="Resting HR" value={lastSnapshot.resting_heart_rate} t={t} />
              <SnapshotRow label="Weight (kg)" value={lastSnapshot.body_mass_kg} t={t} />
            </View>
          ) : null}
        </SectionCard>

        <SectionCard title="Notes" icon="document-text-outline" t={t}>
          <LabeledInput
            label="Injuries / limitations"
            value={injuryNotes}
            onChangeText={setInjuryNotes}
            t={t}
            multiline
            placeholder="Any pain, restrictions, recovery issues, or current concerns"
          />
          <LabeledInput
            label="Equipment notes"
            value={equipmentNotes}
            onChangeText={setEquipmentNotes}
            t={t}
            multiline
            placeholder="Gym setup, home setup, bars, dumbbells, cables, machines, etc."
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
            {loading ? "Saving..." : "Complete Coach Setup"}
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
  children: ReactNode;
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

function ChipSelector({
  label,
  value,
  options,
  onChange,
  t,
}: {
  label: string;
  value: string;
  options: readonly { label: string; value: string }[];
  onChange: (value: any) => void;
  t: any;
}) {
  return (
    <View style={styles.chipSection}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const active = value === option.value;

          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? t.primaryBg : t.cardAlt,
                  borderColor: active ? t.primaryBg : t.border,
                },
              ]}
              onPress={() => onChange(option.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: active ? t.primaryText : t.text,
                  },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function SnapshotRow({
  label,
  value,
  t,
}: {
  label: string;
  value: number | null;
  t: any;
}) {
  return (
    <View style={styles.snapshotRow}>
      <Text style={[styles.snapshotLabel, { color: t.mutedText }]}>{label}</Text>
      <Text style={[styles.snapshotValue, { color: t.text }]}>{value ?? "--"}</Text>
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

  chipSection: {
    marginBottom: 12,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
  },

  healthRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  healthTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  healthText: {
    fontSize: 13,
    lineHeight: 18,
  },
  healthButton: {
    minWidth: 108,
    height: 44,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  healthButtonText: {
    fontSize: 14,
    fontWeight: "800",
  },

  snapshotCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  snapshotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  snapshotLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  snapshotValue: {
    fontSize: 13,
    fontWeight: "700",
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
