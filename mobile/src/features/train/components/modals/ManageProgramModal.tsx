import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DraggableFlatList from "react-native-draggable-flatlist";

import FancyModalShell from "../FancyModalShell";
import { EmptyStateCard } from "../SectionShell";
import TrainSplitRow from "../TrainSplitRow";
import type { Program, Split, ThemeType } from "../../types";

const SPLIT_ROW_HEIGHT = 62;

const splitItemLayout = (_data: unknown, index: number) => ({
  length: SPLIT_ROW_HEIGHT,
  offset: SPLIT_ROW_HEIGHT * index,
  index,
});

type Props = {
  program: Program | null;
  splits: Split[];
  loading: boolean;
  busy: boolean;
  t: ThemeType;
  onClose: () => void;
  onDragEnd: (data: { data: Split[] }) => void;
  openCreateSplit: (programId: string) => void;
  openRename: (item: Split, type: "program" | "split") => void;
  deleteItem: (id: string, type: "program" | "split") => void;
};

export function ManageProgramModal({
  program,
  splits,
  loading,
  busy,
  t,
  onClose,
  onDragEnd,
  openCreateSplit,
  openRename,
  deleteItem,
}: Props) {
  const canAddSplit = !!program && !busy && !loading;

  const handleAddSplit = useCallback(() => {
    if (!program || busy || loading) return;
    openCreateSplit(program.id);
  }, [busy, loading, openCreateSplit, program]);

  const renderManageSplitItem = useCallback(
    ({ item, drag, isActive }: any) => (
      <TrainSplitRow
        item={item}
        displayOrder={item.order_index}
        isActive={isActive}
        busy={busy}
        t={t}
        onDrag={drag}
        onEditItem={(split) => openRename(split, "split")}
        onDeleteItem={(id, type) => deleteItem(id, type)}
      />
    ),
    [busy, deleteItem, openRename, t]
  );

  const footer = useMemo(() => {
    if (!program) return null;

    return (
      <TouchableOpacity
        onPress={handleAddSplit}
        disabled={!canAddSplit}
        activeOpacity={0.88}
        style={[
          styles.addSplitButton,
          {
            backgroundColor: t.link,
            opacity: canAddSplit ? 1 : 0.55,
          },
        ]}
      >
        <Ionicons name="add" size={20} color="white" />
        <Text style={styles.addSplitText}>Add Split</Text>
      </TouchableOpacity>
    );
  }, [canAddSplit, handleAddSplit, program, t.link]);

  return (
    <FancyModalShell
      visible={!!program}
      onClose={onClose}
      title={program?.name ?? "Program"}
      subtitle="Add, rename, delete, or long press a split to reorder."
      t={t}
      enableSwipeDismiss
      swipeDismissArea="sheet"
      sheetHeight="82%"
      sheetMaxHeight="90%"
      showCloseButton={false}
      contentStyle={styles.modalContent}
      footer={footer}
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={t.text} />
          <Text style={[styles.loadingText, { color: t.mutedText }]}>Loading splits...</Text>
        </View>
      ) : splits.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyStateCard
            icon="layers-outline"
            title="No splits yet"
            message="Add the first split for this program."
            t={t}
          />
        </View>
      ) : (
        <DraggableFlatList
          data={splits}
          keyExtractor={(item) => item.id}
          onDragEnd={onDragEnd}
          renderItem={renderManageSplitItem}
          getItemLayout={splitItemLayout}
          activationDistance={16}
          autoscrollThreshold={72}
          autoscrollSpeed={150}
          dragItemOverflow={false}
          nestedScrollEnabled
          removeClippedSubviews={Platform.OS === "android"}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={8}
          updateCellsBatchingPeriod={32}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </FancyModalShell>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    flex: 1,
    minHeight: 0,
  },
  loadingWrap: {
    flex: 1,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 10,
  },
  addSplitButton: {
    minHeight: 54,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 2,
  },
  addSplitText: {
    color: "white",
    fontWeight: "900",
    fontSize: 15,
  },
});
