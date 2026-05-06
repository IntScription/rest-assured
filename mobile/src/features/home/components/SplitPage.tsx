import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated as RNAnimated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { setOnboardingStep } from "@/src/lib/onboarding";

import { SCREEN_WIDTH } from "../constants";
import { styles } from "../styles";
import type { SplitPageProps } from "../types";
import {
  sameExerciseList,
  sameLatestLog,
  sameSplit,
  sameSplitList,
  sameStringList,
} from "../utils/equality";
import { ExerciseList } from "./ExerciseList";

type AnimatedSplitPageProps = SplitPageProps & {
  carouselScrollX: RNAnimated.Value;
  virtualSplitCount: number;
};

type AnimatedDotProps = {
  splitId: string;
  dotIndex: number;
  splitCount: number;
  currentIndex: number;
  virtualSplitCount: number;
  completed: boolean;
  carouselScrollX: RNAnimated.Value;
  smooth: boolean;
  t: any;
};

const AnimatedDot = memo(function AnimatedDot({
  splitId,
  dotIndex,
  splitCount,
  currentIndex,
  virtualSplitCount,
  completed,
  carouselScrollX,
  smooth,
  t,
}: AnimatedDotProps) {
  const staticActive = dotIndex === currentIndex;

  // Keep the dot interpolation range stable across edge swipes.
  // Local previous/current/next ranges are lighter, but they recalculate right
  // when listIndex changes and can cause a one-frame dot glitch at 1 ↔ last.
  const inputRange = useMemo(
    () =>
      Array.from(
        { length: Math.max(virtualSplitCount, 2) },
        (_, virtualIndex) => virtualIndex * SCREEN_WIDTH,
      ),
    [virtualSplitCount],
  );

  const outputRange = useMemo(
    () =>
      Array.from({ length: Math.max(virtualSplitCount, 2) }, (_, virtualIndex) => {
        if (!smooth || splitCount <= 1 || virtualSplitCount <= 1) {
          return staticActive ? 1 : 0;
        }

        const realIndex = ((virtualIndex % splitCount) + splitCount) % splitCount;
        return realIndex === dotIndex ? 1 : 0;
      }),
    [smooth, splitCount, virtualSplitCount, staticActive, dotIndex],
  );

  if (!smooth || splitCount <= 1 || virtualSplitCount <= 1) {
    return (
      <View style={localStyles.dotSlot}>
        <View
          style={[
            localStyles.dotCore,
            {
              backgroundColor: completed ? t.success : staticActive ? t.text : t.border,
              opacity: staticActive || completed ? 1 : 0.82,
              transform: [
                { scaleX: staticActive ? 2 : 1 },
                { scaleY: staticActive ? 1.08 : 1 },
              ],
            },
          ]}
        />
      </View>
    );
  }

  const activeProgress = carouselScrollX.interpolate({
    inputRange,
    outputRange,
    extrapolate: "clamp",
  });

  const inactiveOpacity = completed ? 0.9 : 0.78;

  const activeOpacity = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const coreScaleX = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2],
    extrapolate: "clamp",
  });

  const coreScaleY = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
    extrapolate: "clamp",
  });

  return (
    <View key={splitId} style={localStyles.dotSlot}>
      <RNAnimated.View
        style={[
          localStyles.dotCore,
          {
            backgroundColor: completed ? t.success : t.border,
            opacity: inactiveOpacity,
          },
        ]}
      />

      <RNAnimated.View
        style={[
          localStyles.dotCore,
          localStyles.dotActiveLayer,
          {
            backgroundColor: completed ? t.success : t.text,
            opacity: activeOpacity,
            transform: [{ scaleX: coreScaleX }, { scaleY: coreScaleY }],
          },
        ]}
      />
    </View>
  );
});

function shouldKeepBodyMounted({
  index,
  listIndex,
  itemId,
  activeSplitId,
}: {
  index: number;
  listIndex: number;
  splitCount: number;
  itemId: string;
  activeSplitId?: string | null;
}) {
  const isActivePage = index === listIndex;
  const isNearbyPage = Math.abs(index - listIndex) <= 1;
  const isCurrentVisibleSplit = itemId === activeSplitId;

  return isActivePage || isNearbyPage || isCurrentVisibleSplit;
}

export const SplitPage = memo(
  function SplitPage({
    item,
    index,
    listIndex,
    t,
    currentIndex,
    splits,
    carouselScrollX,
    virtualSplitCount,
    currentSplit,
    activeSplitId,
    completedSplits,
    toggleComplete,
    tourActive,
    tourStep,
    resolvedTutorialProgramId,
    router,
    setTourStep,
    exercises,
    latestLogsByExercise,
    logHistoryByExercise,
    uid,
    editingId,
    setEditingId,
    editValue,
    setEditValue,
    setExercisesBySplit,
  }: AnimatedSplitPageProps) {
    const isActivePage = index === listIndex;
    const isCurrentVisibleSplit = item.id === activeSplitId;
    const isCompleted = completedSplits.includes(item.id);
    const splitCount = splits.length;
    const visibleSplitNumber = splitCount > 0 ? currentIndex + 1 : 0;

    /**
     * Keep the action buttons visually ready during horizontal swipes.
     * `activeSplitId` updates after the carousel settles, so using it for
     * button disabled/opacity makes Add Exercise / Mark Complete "catch up"
     * a few ms late. The handlers still use this split's own id, so the
     * actions remain safe.
     */
    const hasExercises = exercises.length > 0;
    const isCompleteDisabled = !hasExercises;

    const shouldRenderPageBody = useMemo(
      () =>
        shouldKeepBodyMounted({
          index,
          listIndex,
          splitCount,
          itemId: item.id,
          activeSplitId,
        }),
      [index, listIndex, splitCount, item.id, activeSplitId],
    );

    const smoothDotsActive = Math.abs(index - listIndex) <= 1 || item.id === activeSplitId;

    const borderScale = useRef(new RNAnimated.Value(0.85)).current;
    const borderOpacity = useRef(new RNAnimated.Value(0)).current;
    const emptyPulseLoop = useRef<RNAnimated.CompositeAnimation | null>(null);

    useEffect(() => {
      if (emptyPulseLoop.current) {
        emptyPulseLoop.current.stop();
        emptyPulseLoop.current = null;
      }

      if (exercises.length === 0 && isActivePage) {
        borderScale.setValue(0.85);
        borderOpacity.setValue(0);

        emptyPulseLoop.current = RNAnimated.loop(
          RNAnimated.sequence([
            RNAnimated.parallel([
              RNAnimated.timing(borderScale, {
                toValue: 1,
                duration: 1500,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              RNAnimated.timing(borderOpacity, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
              }),
            ]),
            RNAnimated.parallel([
              RNAnimated.timing(borderScale, {
                toValue: 0.85,
                duration: 1500,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
              }),
              RNAnimated.timing(borderOpacity, {
                toValue: 0,
                duration: 1000,
                useNativeDriver: true,
              }),
            ]),
          ]),
        );

        emptyPulseLoop.current.start();
      } else {
        borderScale.setValue(0.85);
        borderOpacity.setValue(0);
      }

      return () => {
        if (emptyPulseLoop.current) {
          emptyPulseLoop.current.stop();
          emptyPulseLoop.current = null;
        }
      };
    }, [exercises.length, isActivePage, borderScale, borderOpacity]);

    const handleAddExercise = useCallback(async () => {
      if (tourActive && tourStep === "go_home") {
        await setOnboardingStep("create_exercise");
        setTourStep("create_exercise");
      }

      router.push({
        pathname: "/exercise/new",
        params: {
          splitId: item.id,
          splitName: item.name,
          tutorialProgramId: resolvedTutorialProgramId,
          programId: resolvedTutorialProgramId,
          tourStep: tourActive && tourStep === "go_home" ? "create_exercise" : undefined,
        },
      });
    }, [
      isCurrentVisibleSplit,
      tourActive,
      tourStep,
      setTourStep,
      router,
      item.id,
      item.name,
      resolvedTutorialProgramId,
    ]);

    const handleToggleComplete = useCallback(() => {
      if (!hasExercises) return;
      void toggleComplete(item.id);
    }, [hasExercises, toggleComplete, item.id]);

    return (
      <View style={[styles.pageContainer, { flex: 1 }]}>
        <RNAnimated.View
          shouldRasterizeIOS
          renderToHardwareTextureAndroid
          style={[
            styles.topCard,
            {
              backgroundColor: t.card,
              borderColor: t.border,
            },
          ]}
        >
          <View style={localStyles.swipeHandleRow}>
            <View
              style={[
                localStyles.swipePill,
                {
                  backgroundColor: t.cardAlt,
                  borderColor: t.border,
                },
              ]}
            >
              <View
                style={[
                  localStyles.swipeIconSoft,
                  {
                    backgroundColor: t.secondaryBg,
                  },
                ]}
              >
                <Ionicons name="swap-horizontal-outline" size={14} color={t.text} />
              </View>

              <Text style={[localStyles.swipePillText, { color: t.mutedText }]}>
                Swipe split
              </Text>
            </View>

            <View style={[localStyles.countPill, { backgroundColor: t.secondaryBg }]}>
              <Text style={[localStyles.countPillText, { color: t.text }]}>
                {visibleSplitNumber}/{Math.max(splitCount, 1)}
              </Text>
            </View>
          </View>

          <Text style={[styles.splitTitle, { color: t.text }]} numberOfLines={1}>
            {item.name}
          </Text>

          {item.focus ? (
            <Text style={[styles.focus, { color: t.mutedText }]} numberOfLines={2}>
              {item.focus}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                localStyles.actionButton,
                { backgroundColor: t.primaryBg },
              ]}
              onPress={handleAddExercise}
              activeOpacity={0.82}
            >
              <Ionicons name="add-circle-outline" size={17} color={t.primaryText} />
              <Text style={[styles.primaryText, { color: t.primaryText }]}>
                Add Exercise
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                localStyles.actionButton,
                { backgroundColor: t.secondaryBg },
                isCompleted && { backgroundColor: t.success },
                isCompleteDisabled && { opacity: 0.72 },
              ]}
              onPress={handleToggleComplete}
              disabled={isCompleteDisabled}
              activeOpacity={0.82}
            >
              <Ionicons
                name={isCompleted ? "checkmark-circle" : "checkmark-circle-outline"}
                size={17}
                color={t.secondaryText}
              />
              <Text style={[styles.secondaryText, { color: t.secondaryText }]}>
                {isCompleted ? "Completed" : "Mark Complete"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={localStyles.dotArea}>
            <View style={localStyles.dotsRowSmooth}>
              {splits.map((split, dotIndex) => (
                <AnimatedDot
                  key={split.id}
                  splitId={split.id}
                  dotIndex={dotIndex}
                  splitCount={splitCount}
                  currentIndex={currentIndex}
                  virtualSplitCount={virtualSplitCount}
                  completed={completedSplits.includes(split.id)}
                  carouselScrollX={carouselScrollX}
                  smooth={smoothDotsActive}
                  t={t}
                />
              ))}
            </View>

            <Text style={[localStyles.dotHint, { color: t.mutedText }]}>
              Horizontal card · vertical dashboard below
            </Text>
          </View>
        </RNAnimated.View>

        {shouldRenderPageBody ? (
          <RNAnimated.View
            shouldRasterizeIOS
            renderToHardwareTextureAndroid
            pointerEvents={isCurrentVisibleSplit ? "auto" : "none"}
            style={[
              styles.exerciseCardWrapper,
              {
                flex: 1,
                backgroundColor: t.card,
                borderColor: t.border,
              },
            ]}
          >
            {exercises.length === 0 ? (
              <View style={localStyles.emptyStateWrap}>
                <RNAnimated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      margin: 16,
                      borderWidth: 2,
                      borderStyle: "dashed",
                      borderColor: t.border,
                      borderRadius: 24,
                      backgroundColor: t.cardAlt,
                      opacity: borderOpacity,
                      transform: [{ scale: borderScale }],
                    },
                  ]}
                />

                <View style={localStyles.emptyStateInner}>
                  <View
                    style={[
                      localStyles.emptyStateIconWrap,
                      {
                        backgroundColor: t.card,
                        borderColor: t.border,
                      },
                    ]}
                  >
                    <Ionicons name="barbell-outline" size={24} color={t.mutedText} />
                  </View>

                  <Text style={[localStyles.emptyStateTitle, { color: t.text }]}>
                    No exercises yet
                  </Text>

                  <Text style={[localStyles.emptyStateSub, { color: t.mutedText }]}>
                    Tap &quot;Add Exercise&quot; above
                  </Text>
                </View>
              </View>
            ) : (
              <ExerciseList
                exercises={exercises}
                latestLogsByExercise={latestLogsByExercise}
                logHistoryByExercise={logHistoryByExercise}
                currentSplit={currentSplit}
                uid={uid}
                t={t}
                router={router}
                editingId={editingId}
                setEditingId={setEditingId}
                editValue={editValue}
                setEditValue={setEditValue}
                setExercisesBySplit={setExercisesBySplit}
              />
            )}
          </RNAnimated.View>
        ) : (
          <View style={localStyles.inactiveBodyPlaceholder} />
        )}
      </View>
    );
  },
  (prev, next) => {
    const prevShouldRenderBody = shouldKeepBodyMounted({
      index: prev.index,
      listIndex: prev.listIndex,
      splitCount: prev.splits.length,
      itemId: prev.item.id,
      activeSplitId: prev.activeSplitId,
    });

    const nextShouldRenderBody = shouldKeepBodyMounted({
      index: next.index,
      listIndex: next.listIndex,
      splitCount: next.splits.length,
      itemId: next.item.id,
      activeSplitId: next.activeSplitId,
    });

    const prevIsActivePage = prev.index === prev.listIndex;
    const nextIsActivePage = next.index === next.listIndex;

    if (prev.t !== next.t) return false;
    if (!sameSplit(prev.item, next.item)) return false;
    if (prev.index !== next.index) return false;
    if (prevIsActivePage !== nextIsActivePage) return false;
    if (prevShouldRenderBody !== nextShouldRenderBody) return false;
    if (prev.currentIndex !== next.currentIndex) return false;
    if (prev.carouselScrollX !== next.carouselScrollX) return false;
    if (prev.virtualSplitCount !== next.virtualSplitCount) return false;
    if (prev.activeSplitId !== next.activeSplitId) return false;
    if (!sameSplitList(prev.splits, next.splits)) return false;
    if (!sameSplit(prev.currentSplit, next.currentSplit)) return false;
    if (!sameStringList(prev.completedSplits, next.completedSplits)) return false;
    if (prev.toggleComplete !== next.toggleComplete) return false;
    if (prev.tourActive !== next.tourActive) return false;
    if (prev.tourStep !== next.tourStep) return false;
    if (prev.resolvedTutorialProgramId !== next.resolvedTutorialProgramId) return false;
    if (prev.router !== next.router) return false;
    if (prev.setTourStep !== next.setTourStep) return false;

    if (!nextShouldRenderBody) return true;

    if (prev.uid !== next.uid) return false;
    if (prev.setEditingId !== next.setEditingId) return false;
    if (prev.setEditValue !== next.setEditValue) return false;
    if (prev.setExercisesBySplit !== next.setExercisesBySplit) return false;
    if (!sameExerciseList(prev.exercises, next.exercises)) return false;

    for (const exercise of next.exercises) {
      if (
        !sameLatestLog(
          prev.latestLogsByExercise[exercise.id],
          next.latestLogsByExercise[exercise.id],
        )
      ) {
        return false;
      }
    }

    const prevEditingInside = prev.exercises.some(
      (exercise) => exercise.id === prev.editingId,
    );
    const nextEditingInside = next.exercises.some(
      (exercise) => exercise.id === next.editingId,
    );

    if (prevEditingInside !== nextEditingInside) return false;
    if (nextEditingInside && prev.editValue !== next.editValue) return false;

    return true;
  },
);

const localStyles = StyleSheet.create({
  swipeHandleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  swipePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 7,
    paddingRight: 11,
    paddingVertical: 6,
  },
  swipeIconSoft: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  swipePillText: {
    marginLeft: 2,
    fontSize: 11,
    fontWeight: "900",
  },
  countPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: "900",
  },
  actionButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
  },
  dotArea: {
    marginTop: 14,
    gap: 7,
  },
  dotsRowSmooth: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 12,
  },
  dotSlot: {
    width: 18,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dotCore: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  dotActiveLayer: {
    position: "absolute",
  },
  dotHint: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyStateWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateInner: {
    alignItems: "center",
  },
  emptyStateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  emptyStateSub: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  inactiveBodyPlaceholder: {
    flex: 1,
  },
});
