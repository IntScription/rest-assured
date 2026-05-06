import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { REST_PRESETS } from "../constants";
import type { LogTag, SuggestionAction, ThemeLike } from "../types";
import type { CoachNextSetInsight } from "../utils/coachNextSetInsight";
import { formatDurationLabel, getLogTagLabel } from "../utils/formatters";
import SmartNextSetCard from "./SmartNextSetCard";

type QuickLoggerValue = {
  weight: string;
  reps: string;
  sets: string;
  note: string;
};

type Props = {
  t: ThemeLike;
  editingId: string | null;
  logTag: LogTag;
  onTagChange: (tag: LogTag) => void;
  lastHint: string;
  value: QuickLoggerValue;
  onChange: (field: keyof QuickLoggerValue, value: string) => void;
  currentVolume: number;
  restDuration: number;
  onRestDurationChange: (seconds: number) => void;
  weightJump: number;
  onWeightJumpChange: (step: number) => void;
  coachInsight: CoachNextSetInsight;
  suggestionActions: SuggestionAction[];
  lastLabel: string;
  bestLabel: string;
  formError: string;
  statusMsg: string;
  onSave: () => void;
  onCancelEdit: () => void;
};

export default function QuickLoggerCard({
  t,
  editingId,
  logTag,
  onTagChange,
  lastHint,
  value,
  onChange,
  currentVolume,
  restDuration,
  onRestDurationChange,
  weightJump,
  onWeightJumpChange,
  coachInsight,
  suggestionActions,
  lastLabel,
  bestLabel,
  formError,
  statusMsg,
  onSave,
  onCancelEdit,
}: Props) {
  const accent = editingId ? t.link : t.success ?? "#10B981";
  const inputBg = t.inputBg ?? t.cardAlt;
  const inputBorder = t.inputBorder ?? t.border;
  const primaryBg = t.primaryBg ?? t.link;
  const primaryText = t.primaryText ?? "#fff";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.card,
          borderColor: accent,
          shadowColor: accent,
        },
      ]}
    >
      <View style={[styles.accentGlow, { backgroundColor: accent }]} />

      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <View style={styles.titleLine}>
            <View style={[styles.iconWrap, { backgroundColor: t.cardAlt, borderColor: t.border }]}> 
              <Ionicons
                name={editingId ? "create-outline" : "flash-outline"}
                size={18}
                color={accent}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: t.mutedText }]}>Quick Logger</Text>
              <Text style={[styles.title, { color: t.text }]}> 
                {editingId ? "Editing selected log" : "Build your next set"}
              </Text>
            </View>
          </View>

          <Text style={[styles.subtitle, { color: t.mutedText }]}>{lastHint}</Text>
        </View>

        <View style={[styles.volumeBadge, { backgroundColor: t.cardAlt, borderColor: t.border }]}> 
          <Text style={[styles.volumeBadgeLabel, { color: t.mutedText }]}>Volume</Text>
          <Text style={[styles.volumeBadgeValue, { color: t.text }]}>{currentVolume}</Text>
        </View>
      </View>

      <View style={[styles.segmentShell, { backgroundColor: t.cardAlt, borderColor: t.border }]}> 
        {(["working", "warmup", "topset"] as LogTag[]).map((tag) => {
          const active = logTag === tag;
          return (
            <TouchableOpacity
              key={tag}
              onPress={() => onTagChange(tag)}
              activeOpacity={0.85}
              style={[
                styles.segmentChip,
                active && { backgroundColor: accent },
              ]}
            >
              <Text style={[styles.segmentText, { color: active ? "#fff" : t.text }]}> 
                {getLogTagLabel(tag)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <SmartNextSetCard
        t={t}
        insight={coachInsight}
        suggestionActions={suggestionActions}
        currentVolume={currentVolume}
        lastLabel={lastLabel}
        bestLabel={bestLabel}
      />

      <View style={styles.inputGrid}>
        <View style={styles.inputBlock}>
          <Text style={[styles.inputLabel, { color: t.mutedText }]}>Weight</Text>
          <TextInput
            placeholder="0"
            placeholderTextColor={t.mutedText}
            keyboardType="decimal-pad"
            value={value.weight}
            onChangeText={(text) => onChange("weight", text)}
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: t.text }]}
          />
        </View>

        <View style={styles.inputBlock}>
          <Text style={[styles.inputLabel, { color: t.mutedText }]}>Reps</Text>
          <TextInput
            placeholder="8"
            placeholderTextColor={t.mutedText}
            keyboardType="number-pad"
            value={value.reps}
            onChangeText={(text) => onChange("reps", text)}
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: t.text }]}
          />
        </View>

        <View style={styles.inputBlock}>
          <Text style={[styles.inputLabel, { color: t.mutedText }]}>Sets</Text>
          <TextInput
            placeholder="1"
            placeholderTextColor={t.mutedText}
            keyboardType="number-pad"
            value={value.sets}
            onChangeText={(text) => onChange("sets", text)}
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: t.text }]}
          />
        </View>
      </View>

      <View style={styles.noteBlock}>
        <Text style={[styles.inputLabel, { color: t.mutedText }]}>Note</Text>
        <TextInput
          placeholder="Paused, strict, top set note..."
          placeholderTextColor={t.mutedText}
          value={value.note}
          onChangeText={(text) => onChange("note", text)}
          style={[styles.noteInput, { backgroundColor: inputBg, borderColor: inputBorder, color: t.text }]}
        />
      </View>

      <View style={[styles.configPanel, { backgroundColor: t.cardAlt, borderColor: t.border }]}> 
        <View style={styles.configHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.configTitle, { color: t.text }]}>Progress setup</Text>
            <Text style={[styles.configSub, { color: t.mutedText }]}>Suggestions only fill the inputs. Review the set, then tap Add Log.</Text>
          </View>
        </View>

        <View style={styles.configGroup}>
          <Text style={[styles.configLabel, { color: t.mutedText }]}>Weight jump</Text>
          <View style={styles.chipRow}>
            {[1.25, 2.5, 5].map((step) => {
              const active = weightJump === step;
              return (
                <TouchableOpacity
                  key={step}
                  onPress={() => onWeightJumpChange(step)}
                  activeOpacity={0.85}
                  style={[
                    styles.optionChip,
                    { backgroundColor: t.card, borderColor: t.border },
                    active && { backgroundColor: primaryBg, borderColor: primaryBg },
                  ]}
                >
                  <Text style={[styles.optionChipText, { color: active ? primaryText : t.text }]}> 
                    {step} kg
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.configGroup}>
          <Text style={[styles.configLabel, { color: t.mutedText }]}>Rest timer</Text>
          <View style={styles.chipRow}>
            {REST_PRESETS.map((seconds) => {
              const active = restDuration === seconds;
              return (
                <TouchableOpacity
                  key={seconds}
                  onPress={() => onRestDurationChange(seconds)}
                  activeOpacity={0.85}
                  style={[
                    styles.optionChip,
                    { backgroundColor: t.card, borderColor: t.border },
                    active && { backgroundColor: primaryBg, borderColor: primaryBg },
                  ]}
                >
                  <Text style={[styles.optionChipText, { color: active ? primaryText : t.text }]}> 
                    {formatDurationLabel(seconds)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.footerRow}>
        {editingId ? (
          <TouchableOpacity
            onPress={onCancelEdit}
            activeOpacity={0.85}
            style={[styles.secondaryButton, { backgroundColor: t.cardAlt, borderColor: t.border }]}
          >
            <Text style={[styles.secondaryButtonText, { color: t.text }]}>Cancel</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={onSave}
          activeOpacity={0.9}
          style={[styles.saveButton, { backgroundColor: accent }]}
        >
          <Ionicons name={editingId ? "checkmark-outline" : "add-circle-outline"} size={18} color="#fff" />
          <Text style={styles.saveButtonText}>{editingId ? "Update Log" : "Add Log"}</Text>
        </TouchableOpacity>
      </View>

      {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
      {statusMsg ? <Text style={[styles.statusText, { color: t.mutedText }]}>{statusMsg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 30,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  accentGlow: {
    position: "absolute",
    top: -80,
    right: -70,
    width: 190,
    height: 190,
    borderRadius: 999,
    opacity: 0.12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  titleBlock: {
    flex: 1,
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.35,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  volumeBadge: {
    minWidth: 74,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  volumeBadgeLabel: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  volumeBadgeValue: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "900",
  },
  segmentShell: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 5,
    flexDirection: "row",
    gap: 6,
  },
  segmentChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontSize: 12.5,
    fontWeight: "900",
  },
  inputGrid: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  inputBlock: {
    flex: 1,
  },
  inputLabel: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "800",
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: "900",
  },
  noteBlock: {
    marginTop: 12,
  },
  noteInput: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "700",
  },
  configPanel: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 22,
    padding: 13,
    gap: 12,
  },
  configHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  configTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  configSub: {
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
  },
  restStatusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  restStatusText: {
    fontSize: 12,
    fontWeight: "900",
  },
  configGroup: {
    gap: 7,
  },
  configLabel: {
    fontSize: 11.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  optionChipText: {
    fontSize: 12,
    fontWeight: "900",
  },
  footerRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 0.42,
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
  },
  saveButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
  errorText: {
    marginTop: 10,
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "800",
  },
  statusText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
  },
});
