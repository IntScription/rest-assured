"use client";

import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/theme";
import { saveRecoveryCheckin } from "@/src/features/coach/api/saveRecoveryCheckin";
import { generateCoachInsights } from "@/src/features/coach/api/generateCoachInsights";
import { generateAdjustmentSummary } from "@/src/features/coach/api/generateAdjustmentSummary";
import { generateAiCoachSummary } from "@/src/features/coach/api/generateAiCoachSummary";
import CoachBackHeader from "@/src/features/coach/components/CoachBackHeader";

export default function RecoveryScreen() {
  const t = useAppTheme();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [sleepHours, setSleepHours] = useState("");
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [sorenessLevel, setSorenessLevel] = useState<number | null>(null);
  const [stressLevel, setStressLevel] = useState<number | null>(null);
  const [motivationLevel, setMotivationLevel] = useState<number | null>(null);
  const [steps, setSteps] = useState("");
  const [restingHeartRate, setRestingHeartRate] = useState("");
  const [activeEnergyKcal, setActiveEnergyKcal] = useState("");
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

  const readinessPreview = useMemo(() => {
    if (sleepHours && Number(sleepHours) < 6.5) return "Recovery may need more attention today.";
    if (sorenessLevel != null && sorenessLevel >= 4) return "High soreness may reduce session quality.";
    if (stressLevel != null && stressLevel >= 4) return "Elevated stress may affect performance.";
    if (energyLevel != null && energyLevel >= 4 && motivationLevel != null && motivationLevel >= 4) {
      return "You look fairly ready to train.";
    }
    return "Fill this in honestly so Coach can adjust your day better.";
  }, [sleepHours, sorenessLevel, stressLevel, energyLevel, motivationLevel]);

  const handleSave = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      await saveRecoveryCheckin({
        user_id: userId,
        sleep_hours: sleepHours ? Number(sleepHours) : null,
        energy_level: energyLevel,
        soreness_level: sorenessLevel,
        stress_level: stressLevel,
        motivation_level: motivationLevel,
        steps: steps ? Number(steps) : null,
        resting_heart_rate: restingHeartRate ? Number(restingHeartRate) : null,
        active_energy_kcal: activeEnergyKcal ? Number(activeEnergyKcal) : null,
        note: note || null,
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
      Alert.alert("Could not save recovery check-in", error?.message ?? "Something went wrong.");
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
          title="Recovery Check-In"
          subtitle="Log how you feel today so Coach can tune readiness and training decisions."
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
              <Ionicons name="pulse-outline" size={20} color={t.text} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: t.text }]}>Recovery Check-In</Text>
              <Text style={[styles.heroSubtitle, { color: t.mutedText }]}>
                Log how you feel today so Coach can tune readiness, volume, and recovery decisions.
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
              {readinessPreview}
            </Text>
          </View>
        </View>

        <SectionCard title="Core recovery" icon="moon-outline" t={t}>
          <LabeledInput
            label="Sleep hours"
            value={sleepHours}
            onChangeText={setSleepHours}
            t={t}
            keyboardType="decimal-pad"
            placeholder="e.g. 7.5"
          />
        </SectionCard>

        <SectionCard title="How you feel" icon="heart-outline" t={t}>
          <ScaleSelector label="Energy" value={energyLevel} onChange={setEnergyLevel} t={t} />
          <ScaleSelector label="Soreness" value={sorenessLevel} onChange={setSorenessLevel} t={t} />
          <ScaleSelector label="Stress" value={stressLevel} onChange={setStressLevel} t={t} />
          <ScaleSelector label="Motivation" value={motivationLevel} onChange={setMotivationLevel} t={t} />
        </SectionCard>

        <SectionCard title="Health metrics" icon="stats-chart-outline" t={t}>
          <LabeledInput
            label="Steps"
            value={steps}
            onChangeText={setSteps}
            t={t}
            keyboardType="number-pad"
            placeholder="Optional"
          />
          <LabeledInput
            label="Resting heart rate"
            value={restingHeartRate}
            onChangeText={setRestingHeartRate}
            t={t}
            keyboardType="number-pad"
            placeholder="Optional"
          />
          <LabeledInput
            label="Active energy (kcal)"
            value={activeEnergyKcal}
            onChangeText={setActiveEnergyKcal}
            t={t}
            keyboardType="number-pad"
            placeholder="Optional"
          />
        </SectionCard>

        <SectionCard title="Notes" icon="document-text-outline" t={t}>
          <LabeledInput
            label="Anything affecting today?"
            value={note}
            onChangeText={setNote}
            t={t}
            multiline
            placeholder="Poor sleep, travel, soreness, low appetite, stress, etc."
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
            {loading ? "Saving..." : "Save Recovery Check-In"}
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

function ScaleSelector({
  label,
  value,
  onChange,
  t,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  t: any;
}) {
  const options = [1, 2, 3, 4, 5];

  return (
    <View style={styles.scaleWrap}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      <View style={styles.scaleRow}>
        {options.map((option) => {
          const active = value === option;

          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.scaleChip,
                {
                  backgroundColor: active ? t.primaryBg : t.cardAlt,
                  borderColor: active ? t.primaryBg : t.border,
                },
              ]}
              onPress={() => onChange(option)}
            >
              <Text
                style={[
                  styles.scaleChipText,
                  {
                    color: active ? t.primaryText : t.text,
                  },
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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

  scaleWrap: {
    marginBottom: 14,
  },
  scaleRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  scaleChip: {
    minWidth: 46,
    height: 42,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  scaleChipText: {
    fontSize: 14,
    fontWeight: "800",
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
