import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import FancyModalShell from "../FancyModalShell";
import type { ThemeType } from "../../types";

type Mode = "create" | "rename";
type ItemType = "program" | "split";

type Props = {
  visible: boolean;
  mode: Mode;
  type: ItemType;
  initialValue: string;
  busy: boolean;
  t: ThemeType;
  onClose: () => void;
  onConfirm: (val: string) => void;
};

export function CreateEditModal({
  visible,
  mode,
  type,
  initialValue,
  busy,
  t,
  onClose,
  onConfirm,
}: Props) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [initialValue, visible]);

  const copy = useMemo(() => {
    const isProgram = type === "program";
    const item = isProgram ? "program" : "split";

    return {
      title: `${mode === "create" ? "Create" : "Rename"} ${item}`,
      subtitle: isProgram
        ? "Programs are your top-level training containers."
        : "Splits are the training days inside the program.",
      placeholder: isProgram ? "Push Pull Legs" : "Push",
      actionLabel: mode === "create" ? "Create" : "Save",
    };
  }, [mode, type]);

  const trimmedValue = value.trim();
  const canSubmit = trimmedValue.length > 0 && !busy;

  const close = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  const submit = useCallback(() => {
    if (!canSubmit) return;
    onConfirm(trimmedValue);
  }, [canSubmit, onConfirm, trimmedValue]);

  return (
    <FancyModalShell
      visible={visible}
      onClose={close}
      title={copy.title}
      subtitle={copy.subtitle}
      t={t}
      enableSwipeDismiss={false}
      showDragHandle={false}
      showCloseButton={false}
      sheetMaxHeight="46%"
      contentStyle={styles.content}
      footer={
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={close}
            activeOpacity={0.85}
            disabled={busy}
            style={[
              styles.secondaryButton,
              {
                borderColor: t.border,
                backgroundColor: t.cardAlt,
                opacity: busy ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.secondaryText, { color: t.text }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={submit}
            disabled={!canSubmit}
            activeOpacity={0.85}
            style={[
              styles.primaryButton,
              {
                backgroundColor: t.link,
                opacity: canSubmit ? 1 : 0.55,
              },
            ]}
          >
            <Text style={styles.primaryText}>{copy.actionLabel}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <TextInput
        value={value}
        onChangeText={setValue}
        autoFocus
        editable={!busy}
        maxLength={42}
        selectTextOnFocus={mode === "rename"}
        placeholder={copy.placeholder}
        placeholderTextColor={t.mutedText}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={submit}
        style={[
          styles.input,
          {
            borderColor: t.inputBorder,
            backgroundColor: t.inputBg,
            color: t.text,
          },
        ]}
      />

      <Text style={[styles.helperText, { color: t.mutedText }]}>
        {trimmedValue.length}/42 characters
      </Text>
    </FancyModalShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 0,
  },
  input: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "700",
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  secondaryText: {
    fontWeight: "800",
  },
  primaryText: {
    color: "white",
    fontWeight: "900",
  },
});
