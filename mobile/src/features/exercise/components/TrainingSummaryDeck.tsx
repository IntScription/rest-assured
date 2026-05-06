import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { CompareInsight, RecordShortcut, ThemeLike } from "../types";

type GoalSnapshot = {
  last: string;
  best: string;
  goal: string;
};

type Props = {
  t: ThemeLike;
  prItems: RecordShortcut[];
  onPressRecord?: (logId: string | null) => void;
  sessionsLabel: string;
  heaviestLabel: string;
  latestLabel: string;
  totalVolumeLabel: string;
  totalRepsLabel: string;
  bestEstimated1RMLabel: string;
  bestVolumeLabel: string;
  bodyweightRepPRLabel: string;
  workingSetsLabel: string;
  goalSnapshot: GoalSnapshot;
  compareInsight: CompareInsight;
  trendCallouts: string[];
};

type Stat = {
  label: string;
  value: string;
};

type ProgressPage = {
  key: "overview" | "strength" | "goal" | "trend";
  eyebrow: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  stats: Stat[];
  footer?: string;
  callouts?: string[];
};

function getCompareAccent(t: ThemeLike, tone: CompareInsight["tone"]) {
  if (tone === "up") return t.success ?? "#10B981";
  if (tone === "down") return t.danger ?? "#EF4444";
  if (tone === "same") return "#F59E0B";
  return t.link;
}

function Dots({
  count,
  activeIndex,
  color,
  mutedColor,
}: {
  count: number;
  activeIndex: number;
  color: string;
  mutedColor: string;
}) {
  if (count <= 1) return null;

  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: index === activeIndex ? color : mutedColor,
              opacity: index === activeIndex ? 1 : 0.35,
              width: index === activeIndex ? 14 : 5,
            },
          ]}
        />
      ))}
    </View>
  );
}

function getLoopedItems<T>(items: T[]) {
  if (items.length <= 1) return items;
  return [items[items.length - 1], ...items, items[0]];
}

function getRealIndexFromLoopedIndex(rawIndex: number, itemCount: number) {
  if (itemCount <= 1) return 0;
  if (rawIndex <= 0) return itemCount - 1;
  if (rawIndex >= itemCount + 1) return 0;
  return rawIndex - 1;
}

function statValueProps(label: string) {
  if (label === "Sessions" || label === "BW reps") {
    return {
      style: styles.statValueCompact,
      minimumFontScale: 0.82,
    };
  }

  if (label === "Heaviest") {
    return {
      style: styles.statValueHeaviest,
      minimumFontScale: 0.72,
    };
  }

  if (
    label === "Latest" ||
    label === "Last" ||
    label === "Best" ||
    label === "Goal"
  ) {
    return {
      style: styles.statValueWide,
      minimumFontScale: 0.7,
    };
  }

  return {
    style: styles.statValue,
    minimumFontScale: 0.76,
  };
}

function renderStat(t: ThemeLike, stat: Stat, style?: any) {
  const valueProps = statValueProps(stat.label);

  return (
    <View
      key={stat.label}
      style={[
        styles.progressStat,
        style,
        {
          backgroundColor: t.cardAlt,
          borderColor: t.border,
        },
      ]}
    >
      <Text
        style={[
          styles.statLabel,
          stat.label === "Sessions" && styles.statLabelCentered,
          { color: t.mutedText },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.68}
      >
        {stat.label}
      </Text>
      <Text
        style={[styles.statValue, valueProps.style, { color: t.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={valueProps.minimumFontScale}
      >
        {stat.value}
      </Text>
    </View>
  );
}

function ProgressStats({ t, page }: { t: ThemeLike; page: ProgressPage }) {
  if (page.key === "overview") {
    const sessions = page.stats.find((stat) => stat.label === "Sessions");
    const heaviest = page.stats.find((stat) => stat.label === "Heaviest");
    const latest = page.stats.find((stat) => stat.label === "Latest");

    return (
      <View style={styles.progressStatsStack}>
        <View style={styles.overviewTopStatsRow}>
          {sessions ? renderStat(t, sessions, styles.sessionMiniStat) : null}
          {heaviest ? renderStat(t, heaviest, styles.heaviestWideStat) : null}
        </View>
        {latest ? renderStat(t, latest, styles.latestFullStat) : null}
      </View>
    );
  }

  if (page.key === "strength") {
    return (
      <View style={styles.strengthGrid}>
        {page.stats.map((stat) => renderStat(t, stat, styles.strengthGridStat))}
      </View>
    );
  }

  if (page.key === "goal") {
    return (
      <View style={styles.goalStatsStack}>
        {page.stats.map((stat) => renderStat(t, stat, styles.goalWideStat))}
      </View>
    );
  }

  if (page.key === "trend") {
    const callouts = page.callouts?.length
      ? page.callouts
      : ["No trend callouts yet. Keep logging to unlock them."];

    return (
      <View style={styles.calloutStack}>
        {callouts.slice(0, 3).map((callout, index) => (
          <View
            key={`${index}-${callout}`}
            style={[
              styles.calloutMiniCard,
              { backgroundColor: t.cardAlt, borderColor: t.border },
            ]}
          >
            <View
              style={[styles.calloutNumber, { backgroundColor: page.accent }]}
            >
              <Text style={styles.calloutNumberText}>{index + 1}</Text>
            </View>
            <Text
              style={[styles.calloutMiniText, { color: t.text }]}
              numberOfLines={2}
            >
              {callout}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.progressStatsRow}>
      {page.stats.map((stat) => renderStat(t, stat))}
    </View>
  );
}

export default function TrainingSummaryDeck({
  t,
  prItems,
  sessionsLabel,
  heaviestLabel,
  latestLabel,
  totalVolumeLabel,
  totalRepsLabel,
  bestEstimated1RMLabel,
  bestVolumeLabel,
  bodyweightRepPRLabel,
  workingSetsLabel,
  goalSnapshot,
  compareInsight,
  trendCallouts,
}: Props) {
  const [prIndex, setPrIndex] = useState(0);
  const [progressIndex, setProgressIndex] = useState(0);
  const [prWidth, setPrWidth] = useState(1);
  const [progressWidth, setProgressWidth] = useState(1);

  const prScrollRef = useRef<ScrollView | null>(null);
  const progressScrollRef = useRef<ScrollView | null>(null);

  const compareAccent = getCompareAccent(t, compareInsight.tone);
  const prAccent = prItems[prIndex]?.accent ?? t.link;

  const pages = useMemo<ProgressPage[]>(
    () => [
      {
        key: "overview",
        eyebrow: "Snapshot",
        title: "Training pulse",
        icon: "pulse-outline",
        accent: t.link,
        stats: [
          { label: "Sessions", value: sessionsLabel },
          { label: "Heaviest", value: heaviestLabel },
          { label: "Latest", value: latestLabel },
        ],
      },
      {
        key: "strength",
        eyebrow: "Strength",
        title: "Output profile",
        icon: "bar-chart-outline",
        accent: "#8B5CF6",
        stats: [
          { label: "Est. 1RM", value: bestEstimated1RMLabel },
          { label: "Best volume", value: bestVolumeLabel },
          { label: "BW reps", value: bodyweightRepPRLabel },
          { label: "Sets", value: workingSetsLabel },
        ],
      },
      {
        key: "goal",
        eyebrow: "Goal check",
        title: "Last / Best / Goal",
        icon: "sparkles-outline",
        accent: compareAccent,
        stats: [
          { label: "Last", value: goalSnapshot.last },
          { label: "Best", value: goalSnapshot.best },
          { label: "Goal", value: goalSnapshot.goal },
        ],
      },
      {
        key: "trend",
        eyebrow: "Trend",
        title: "Coach callouts",
        icon: "analytics-outline",
        accent: "#10B981",
        stats: [],
        callouts: trendCallouts,
      },
    ],
    [
      bestEstimated1RMLabel,
      bestVolumeLabel,
      bodyweightRepPRLabel,
      compareAccent,
      goalSnapshot.best,
      goalSnapshot.goal,
      goalSnapshot.last,
      heaviestLabel,
      latestLabel,
      sessionsLabel,
      t.link,
      trendCallouts,
      workingSetsLabel,
    ],
  );

  const loopedPrItems = useMemo(() => getLoopedItems(prItems), [prItems]);
  const loopedPages = useMemo(() => getLoopedItems(pages), [pages]);

  useEffect(() => {
    if (prItems.length <= 1 || prWidth <= 1) return;
    requestAnimationFrame(() => {
      prScrollRef.current?.scrollTo({ x: prWidth, animated: false });
    });
  }, [prItems.length, prWidth]);

  useEffect(() => {
    if (pages.length <= 1 || progressWidth <= 1) return;
    requestAnimationFrame(() => {
      progressScrollRef.current?.scrollTo({
        x: progressWidth,
        animated: false,
      });
    });
  }, [pages.length, progressWidth]);

  const handlePrLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width > 0 && width !== prWidth) setPrWidth(width);
  };

  const handleProgressLayout = (event: LayoutChangeEvent) => {
    /**
     * Important:
     * Measure the actual ScrollView viewport, not the outer progress card.
     * The outer card has border/overflow/shadow styles, and measuring it can make
     * each slide slightly wider than the scroll viewport. That is what makes the
     * heading and stat cards look like they shift right after every swipe.
     */
    const width = Math.round(event.nativeEvent.layout.width);
    if (width > 0 && width !== progressWidth) setProgressWidth(width);
  };

  const handlePrMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (prItems.length <= 1) {
      setPrIndex(0);
      return;
    }

    const rawIndex = Math.round(
      event.nativeEvent.contentOffset.x / Math.max(1, prWidth),
    );
    const realIndex = getRealIndexFromLoopedIndex(rawIndex, prItems.length);
    setPrIndex(realIndex);

    if (rawIndex === 0) {
      requestAnimationFrame(() => {
        prScrollRef.current?.scrollTo({
          x: prWidth * prItems.length,
          animated: false,
        });
      });
    } else if (rawIndex === prItems.length + 1) {
      requestAnimationFrame(() => {
        prScrollRef.current?.scrollTo({ x: prWidth, animated: false });
      });
    }
  };

  const handleProgressMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (pages.length <= 1) {
      setProgressIndex(0);
      return;
    }

    const width = Math.max(1, progressWidth);
    const rawIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    const realIndex = getRealIndexFromLoopedIndex(rawIndex, pages.length);
    setProgressIndex(realIndex);

    /**
     * Always correct to an exact page offset after momentum.
     * This removes fractional scroll offset drift, while preserving the infinite loop.
     */
    const correctedLoopIndex =
      rawIndex === 0
        ? pages.length
        : rawIndex === pages.length + 1
          ? 1
          : rawIndex;

    requestAnimationFrame(() => {
      progressScrollRef.current?.scrollTo({
        x: correctedLoopIndex * width,
        animated: false,
      });
    });
  };

  return (
    <View style={styles.deckWrap}>
      <View
        style={[
          styles.prSquare,
          {
            backgroundColor: t.card,
            borderColor: prAccent,
            shadowColor: prAccent,
          },
        ]}
      >
        <View style={styles.prHeaderRow}>
          <View
            style={[
              styles.prHeaderIcon,
              { backgroundColor: t.cardAlt, borderColor: prAccent },
            ]}
          >
            <Ionicons name="trophy-outline" size={15} color={prAccent} />
          </View>
          <View style={styles.prHeaderCopy}>
            <Text
              style={[
                styles.eyebrow,
                styles.centerText,
                { color: t.mutedText },
              ]}
            >
              PR Board
            </Text>
          </View>
        </View>

        <ScrollView
          ref={prScrollRef}
          onLayout={handlePrLayout}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handlePrMomentumEnd}
          scrollEventThrottle={16}
          style={styles.prScroll}
          contentContainerStyle={styles.prScrollContent}
        >
          {loopedPrItems.map((item, loopIndex) => (
            <View
              key={`${item.key}-${loopIndex}`}
              style={[styles.prSlide, { width: prWidth }]}
            >
              <View style={styles.prSlideInner}>
                <View style={[styles.prDot, { backgroundColor: item.accent }]} />
                <Text
                  style={[styles.prLabel, { color: t.mutedText }]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
                <Text
                  style={[styles.prValue, { color: t.text }]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {item.value}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <Dots
          count={prItems.length}
          activeIndex={prIndex}
          color={prAccent}
          mutedColor={t.mutedText}
        />
      </View>

      <View
        style={[
          styles.progressCard,
          {
            backgroundColor: t.card,
            borderColor: pages[progressIndex]?.accent ?? t.border,
            shadowColor: pages[progressIndex]?.accent ?? t.link,
          },
        ]}
      >
        <ScrollView
          ref={progressScrollRef}
          onLayout={handleProgressLayout}
          horizontal
          pagingEnabled
          snapToInterval={progressWidth}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleProgressMomentumEnd}
          scrollEventThrottle={16}
          style={styles.progressScroll}
          contentContainerStyle={styles.progressScrollContent}
        >
          {loopedPages.map((page, loopIndex) => (
            <View
              key={`${page.key}-${loopIndex}`}
              style={[styles.progressSlide, { width: progressWidth }]}
            >
              <View style={styles.progressSlideInner}>
                <View style={styles.sectionTopRow}>
                  <View style={styles.sectionTopCopy}>
                    <Text
                      style={[
                        styles.eyebrow,
                        styles.centerText,
                        { color: t.mutedText },
                      ]}
                      numberOfLines={1}
                    >
                      {page.eyebrow}
                    </Text>
                    <Text
                      style={[
                        styles.progressTitle,
                        styles.centerText,
                        { color: t.text },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                    >
                      {page.title}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.progressIcon,
                      { backgroundColor: t.cardAlt, borderColor: t.border },
                    ]}
                  >
                    <Ionicons name={page.icon} size={16} color={page.accent} />
                  </View>
                </View>

                <ProgressStats t={t} page={page} />
              </View>
            </View>
          ))}
        </ScrollView>

        <Dots
          count={pages.length}
          activeIndex={progressIndex}
          color={pages[progressIndex]?.accent ?? t.link}
          mutedColor={t.mutedText}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deckWrap: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginBottom: 14,
  },
  prSquare: {
    width: 122,
    height: 214,
    borderWidth: 1.8,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    overflow: "hidden",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  progressCard: {
    flex: 1,
    height: 214,
    borderWidth: 1.45,
    borderRadius: 24,
    overflow: "hidden",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  sectionTopRow: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  sectionTopCopy: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 36,
    paddingRight: 36,
  },
  prHeaderRow: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 2,
  },
  prHeaderCopy: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  prHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: {
    textAlign: "center",
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  prScroll: {
    flex: 1,
    width: "100%",
    marginTop: 4,
  },
  prScrollContent: {
    alignItems: "stretch",
  },
  prSlide: {
    paddingHorizontal: 0,
    paddingBottom: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  prSlideInner: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  prDot: {
    width: 13,
    height: 13,
    borderRadius: 999,
    marginBottom: 8,
  },
  prLabel: {
    width: "100%",
    minHeight: 34,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 11.5,
    lineHeight: 14.5,
    fontWeight: "900",
    includeFontPadding: false,
  },
  prValue: {
    width: "100%",
    marginTop: 7,
    minHeight: 44,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    includeFontPadding: false,
  },
  progressScroll: {
    flex: 1,
    width: "100%",
  },
  progressScrollContent: {
    alignItems: "stretch",
  },
  progressSlide: {
    flexShrink: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    justifyContent: "center",
    alignItems: "stretch",
  },
  progressSlideInner: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 25,
    alignItems: "stretch",
    justifyContent: "flex-start",
  },
  progressTitle: {
    marginTop: 1,
    fontSize: 17.5,
    lineHeight: 21,
    fontWeight: "900",
    letterSpacing: -0.35,
  },
  progressIcon: {
    position: "absolute",
    right: 0,
    top: 1,
    width: 34,
    height: 34,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progressStatsStack: {
    width: "100%",
    marginTop: 11,
    gap: 7,
  },
  overviewTopStatsRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 7,
  },
  progressStatsRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 6,
    marginTop: 12,
  },
  progressStat: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  sessionMiniStat: {
    flex: 0,
    width: 72,
    minHeight: 54,
    paddingHorizontal: 7,
    alignItems: "center",
  },
  heaviestWideStat: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 9,
  },
  latestFullStat: {
    minHeight: 49,
    paddingHorizontal: 10,
  },
  strengthGrid: {
    width: "100%",
    marginTop: 11,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    columnGap: 7,
    rowGap: 7,
  },
  strengthGridStat: {
    flex: 0,
    width: "48.3%",
    minHeight: 49,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  goalStatsStack: {
    width: "100%",
    marginTop: 11,
    gap: 7,
  },
  goalWideStat: {
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statLabel: {
    width: "100%",
    textAlign: "center",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900",
  },
  statLabelCentered: {
    width: "100%",
    textAlign: "center",
  },
  statValue: {
    width: "100%",
    marginTop: 4,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 15,
    fontWeight: "900",
  },
  statValueCompact: {
    width: "100%",
    fontSize: 17,
    lineHeight: 19,
    textAlign: "center",
  },
  statValueHeaviest: {
    fontSize: 14,
    lineHeight: 17,
    textAlign: "center",
  },
  statValueWide: {
    fontSize: 12.8,
    lineHeight: 15,
    textAlign: "center",
  },
  calloutStack: {
    width: "100%",
    marginTop: 10,
    gap: 6,
  },
  calloutMiniCard: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  calloutNumber: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  calloutNumberText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
  calloutMiniText: {
    flex: 1,
    textAlign: "center",
    fontSize: 10.8,
    lineHeight: 13.4,
    fontWeight: "800",
  },
  footerText: {
    marginTop: 7,
    fontSize: 10.8,
    lineHeight: 14,
    fontWeight: "800",
  },
  dotsRow: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 9,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    height: 5,
    borderRadius: 999,
  },
});
