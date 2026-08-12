import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";

import type { ThemeType } from "@/src/features/train/types";
import type { MonthlyAiFeedback } from "../lib/monthlyReviewTypes";
import type { MonthlyTrainingStats } from "@/src/features/training-intelligence/types";
import { formatCompact } from "@/src/features/training-intelligence/metrics";

type Props = {
  visible: boolean;
  t: ThemeType;
  stats: MonthlyTrainingStats | null;
  aiFeedback?: MonthlyAiFeedback | null;
  loading?: boolean;
  onClose: () => void;
  onGenerateAiFeedback?: () => Promise<void> | void;
};

export function MonthlyReviewSheet({
  visible,
  t,
  stats,
  aiFeedback,
  loading,
  onClose,
  onGenerateAiFeedback,
}: Props) {
  const [aiBusy, setAiBusy] = useState(false);

  async function handleAi() {
    if (!onGenerateAiFeedback) return;

    setAiBusy(true);
    try {
      await onGenerateAiFeedback();
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.overlay} onPress={onClose} />

        <View style={styles.center}>
          <View style={[styles.sheet, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={styles.header}>
              <View style={[styles.iconShell, { backgroundColor: `${t.link}18`, borderColor: `${t.link}44` }]}>
                <Ionicons name="sparkles-outline" size={23} color={t.link} />
              </View>

              <View style={styles.headerCopy}>
                <Text style={[styles.kicker, { color: t.mutedText }]}>Monthly review</Text>
                <Text style={[styles.title, { color: t.text }]}>
                  Training summary
                </Text>
              </View>

              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                <Ionicons name="close" size={18} color={t.text} />
              </TouchableOpacity>
            </View>

            {loading || !stats ? (
              <View style={styles.loading}>
                <ActivityIndicator color={t.link} />
                <Text style={[styles.body, { color: t.mutedText }]}>Building your review...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.grid}>
                  <Stat t={t} label="Workouts" value={String(stats.workoutsCompleted)} />
                  <Stat t={t} label="Training days" value={String(stats.uniqueTrainingDays)} />
                  <Stat t={t} label="Volume" value={formatCompact(stats.totalVolume)} />
                  <Stat t={t} label="Score" value={`${stats.consistencyScore}%`} />
                </View>

                <Section t={t} title="Top exercises">
                  {stats.topExercises.length ? (
                    stats.topExercises.map((exercise) => (
                      <Text key={exercise.exerciseId} style={[styles.body, { color: t.mutedText }]}>
                        {exercise.name}: {formatCompact(exercise.volume)} volume
                      </Text>
                    ))
                  ) : (
                    <Text style={[styles.body, { color: t.mutedText }]}>No exercise data this month.</Text>
                  )}
                </Section>

                <Section t={t} title="Warnings">
                  {stats.warnings.length ? (
                    stats.warnings.map((warning) => (
                      <Text key={warning} style={[styles.body, { color: t.mutedText }]}>• {warning}</Text>
                    ))
                  ) : (
                    <Text style={[styles.body, { color: t.mutedText }]}>No major warnings.</Text>
                  )}
                </Section>

                <TouchableOpacity
                  onPress={handleAi}
                  disabled={aiBusy || !onGenerateAiFeedback}
                  activeOpacity={0.86}
                  style={[styles.aiBtn, { backgroundColor: t.link, opacity: aiBusy ? 0.65 : 1 }]}
                >
                  {aiBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={17} color="#fff" />
                      <Text style={styles.aiBtnText}>
                        {aiFeedback ? "Refresh AI Feedback" : "Generate AI Feedback"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {aiFeedback ? (
                  <Section t={t} title={aiFeedback.headline}>
                    <Text style={[styles.body, { color: t.mutedText }]}>
                      {aiFeedback.coachNote}
                    </Text>

                    <Text style={[styles.subTitle, { color: t.text }]}>Next month focus</Text>
                    {aiFeedback.nextMonthFocus.map((item) => (
                      <Text key={item} style={[styles.body, { color: t.mutedText }]}>• {item}</Text>
                    ))}

                    {aiFeedback.deloadSuggestion ? (
                      <>
                        <Text style={[styles.subTitle, { color: t.text }]}>Deload note</Text>
                        <Text style={[styles.body, { color: t.mutedText }]}>
                          {aiFeedback.deloadSuggestion}
                        </Text>
                      </>
                    ) : null}
                  </Section>
                ) : null}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Stat({ t, label, value }: { t: ThemeType; label: string; value: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
      <Text style={[styles.statValue, { color: t.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: t.mutedText }]}>{label}</Text>
    </View>
  );
}

function Section({
  t,
  title,
  children,
}: {
  t: ThemeType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
      <Text style={[styles.sectionTitle, { color: t.text }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.34)" },
  center: { flex: 1, justifyContent: "center", padding: 16 },
  sheet: {
    maxHeight: "90%",
    borderWidth: 1,
    borderRadius: 30,
    padding: 16,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  iconShell: { width: 50, height: 50, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  kicker: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7 },
  title: { marginTop: 3, fontSize: 22, fontWeight: "900" },
  closeBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  loading: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flexGrow: 1, flexBasis: "47%", borderRadius: 20, borderWidth: 1, padding: 14 },
  statValue: { fontSize: 24, fontWeight: "900" },
  statLabel: { marginTop: 3, fontSize: 11.5, fontWeight: "800", textTransform: "uppercase" },
  section: { marginTop: 12, borderRadius: 20, borderWidth: 1, padding: 14 },
  sectionTitle: { fontSize: 15, fontWeight: "900", marginBottom: 8 },
  subTitle: { marginTop: 12, marginBottom: 5, fontSize: 13.5, fontWeight: "900" },
  body: { fontSize: 12.8, lineHeight: 19, fontWeight: "700" },
  aiBtn: { marginTop: 12, minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  aiBtnText: { color: "#fff", fontSize: 13, fontWeight: "900" },
});
