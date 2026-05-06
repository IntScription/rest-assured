import { memo } from "react";
import { FlatList, View } from "react-native";
import { ExerciseRow } from "./ExerciseRow";

export const ExerciseList = memo(function ExerciseList({
  exercises,
  latestLogsByExercise,
  logHistoryByExercise,
  uid,
  t,
  router,
  currentSplit,
  editingId,
  setEditingId,
  editValue,
  setEditValue,
  setExercisesBySplit,
}: any) {
  if (exercises.length === 0) return <View style={{ height: 100 }} />; // Prevents clipping empty states

  return (
    <FlatList
      data={exercises}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <ExerciseRow
          item={item}
          index={index}
          stackSize={exercises.length}
          latestLog={latestLogsByExercise?.[item.id] ?? null}
          logHistory={logHistoryByExercise?.[item.id] ?? []}
          uid={uid}
          t={t}
          router={router}
          currentSplit={currentSplit}
          editingId={editingId}
          setEditingId={setEditingId}
          editValue={editValue}
          setEditValue={setEditValue}
          setExercisesBySplit={setExercisesBySplit}
        />
      )}
      contentContainerStyle={{ padding: 14, paddingBottom: 18 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    />
  );
});
