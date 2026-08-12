import { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Polygon, Polyline } from "react-native-svg";

import type { AppTheme } from "@/src/theme/theme";
import type { SkillLog, SkillMetricType } from "@/src/features/skills/types";
import { getSkillTrendSeries } from "@/src/features/skills/utils/skill-pr";

type Props = {
  t: AppTheme;
  logs: SkillLog[];
  metricType: SkillMetricType;
};

const CHART_HEIGHT = 110;
const CHART_PADDING = 12;

function formatSkillTrendValue(metricType: SkillMetricType, value: number) {
  if (metricType === "seconds") return `${value}s`;
  if (metricType === "reps") return `${value} reps`;
  if (metricType === "attempts") return `${value} attempts`;
  return `${value}`;
}

export function SkillProgressGraphCard({ t, logs, metricType }: Props) {
  const [chartWidth, setChartWidth] = useState(0);

  const series = useMemo(() => getSkillTrendSeries(logs, metricType, 10), [logs, metricType]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };

  const { points, minLabel, maxLabel } = useMemo(() => {
    if (series.length < 2 || chartWidth <= 0) {
      return { points: [] as { x: number; y: number }[], minLabel: "", maxLabel: "" };
    }

    const values = series.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const innerWidth = chartWidth - CHART_PADDING * 2;
    const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;

    const computed = series.map((p, index) => ({
      x: CHART_PADDING + (index / (series.length - 1)) * innerWidth,
      y: CHART_PADDING + (1 - (p.value - min) / range) * innerHeight,
    }));

    return {
      points: computed,
      minLabel: formatSkillTrendValue(metricType, min),
      maxLabel: formatSkillTrendValue(metricType, max),
    };
  }, [series, chartWidth, metricType]);

  if (metricType === "milestone" || series.length < 2) {
    return null;
  }

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints =
    points.length > 0
      ? `${CHART_PADDING},${CHART_HEIGHT - CHART_PADDING} ${polylinePoints} ${
          points[points.length - 1].x
        },${CHART_HEIGHT - CHART_PADDING}`
      : "";

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.title, { color: t.text }]}>Progress</Text>

      <View style={styles.axisLabelsRow}>
        <Text style={[styles.axisLabel, { color: t.mutedText }]}>{maxLabel}</Text>
      </View>

      <View onLayout={handleLayout} style={{ height: CHART_HEIGHT }}>
        {points.length > 0 ? (
          <Svg width="100%" height={CHART_HEIGHT}>
            <Polygon points={areaPoints} fill={t.link} fillOpacity={0.12} stroke="none" />
            <Polyline points={polylinePoints} fill="none" stroke={t.link} strokeWidth={2.5} />
            {points.map((p, index) => {
              const isLast = index === points.length - 1;
              return (
                <Circle
                  key={series[index].id}
                  cx={p.x}
                  cy={p.y}
                  r={isLast ? 5 : 3}
                  fill={isLast ? "#F59E0B" : t.card}
                  stroke={t.link}
                  strokeWidth={isLast ? 0 : 2}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>

      <View style={styles.axisLabelsRow}>
        <Text style={[styles.axisLabel, { color: t.mutedText }]}>{minLabel}</Text>
      </View>

      <View style={styles.dateRow}>
        <Text style={[styles.dateLabel, { color: t.mutedText }]}>{series[0]?.dateLabel}</Text>
        <Text style={[styles.dateLabel, { color: t.mutedText }]}>{series[series.length - 1]?.dateLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
  },
  axisLabelsRow: {
    alignItems: "flex-end",
  },
  axisLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  dateLabel: {
    fontSize: 11,
  },
});
