import { memo, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Polygon, Polyline } from "react-native-svg";

import type { LogRow, ThemeLike, TrendMetric, TrendView } from "../types";
import { formatTrendMetricValue, getTrendSeries } from "../utils/trendLogic";

type Props = {
  t: ThemeLike;
  logs: LogRow[];
  metric: TrendMetric;
  onMetricChange: (metric: TrendMetric) => void;
  view: TrendView;
  onViewChange: (view: TrendView) => void;
  onOpenFullInsights?: () => void;
};

const METRICS: { key: TrendMetric; label: string }[] = [
  { key: "volume", label: "Volume" },
  { key: "weight", label: "Weight" },
  { key: "reps", label: "Reps" },
  { key: "rpe", label: "RPE" },
];

const CHART_HEIGHT = 120;
const CHART_PADDING = 12;

function ProgressGraphCard({ t, logs, metric, onMetricChange, view, onViewChange, onOpenFullInsights }: Props) {
  const [chartWidth, setChartWidth] = useState(0);

  const series = useMemo(() => getTrendSeries(logs, metric, 10), [logs, metric]);

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
      minLabel: formatTrendMetricValue(metric, min),
      maxLabel: formatTrendMetricValue(metric, max),
    };
  }, [series, chartWidth, metric]);

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints =
    points.length > 0
      ? `${CHART_PADDING},${CHART_HEIGHT - CHART_PADDING} ${polylinePoints} ${
          points[points.length - 1].x
        },${CHART_HEIGHT - CHART_PADDING}`
      : "";

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: t.text }]}>Progress</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={view === "graph" ? "Switch to list view" : "Switch to graph view"}
          onPress={() => onViewChange(view === "graph" ? "list" : "graph")}
          style={[styles.viewToggle, { borderColor: t.border, backgroundColor: t.cardAlt }]}
        >
          <Ionicons name={view === "graph" ? "list-outline" : "analytics-outline"} size={16} color={t.mutedText} />
        </TouchableOpacity>
      </View>

      <View style={styles.metricRow}>
        {METRICS.map((option) => {
          const active = metric === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => onMetricChange(option.key)}
              style={[
                styles.metricPill,
                {
                  backgroundColor: active ? t.link : t.cardAlt,
                  borderColor: active ? t.link : t.border,
                },
              ]}
            >
              <Text style={[styles.metricPillText, { color: active ? "#fff" : t.mutedText }]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {series.length < 2 ? (
        <Text style={[styles.emptyText, { color: t.mutedText }]}>
          Log a couple more sets to see your {metric} trend.
        </Text>
      ) : view === "list" ? (
        <View style={styles.listWrap}>
          {[...series].reverse().map((point) => (
            <View key={point.id} style={styles.listRow}>
              <Text style={[styles.listDate, { color: t.mutedText }]}>{point.dateLabel}</Text>
              <Text style={[styles.listValue, { color: t.text }]}>{formatTrendMetricValue(metric, point.value)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View>
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
      )}

      {onOpenFullInsights ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="View full insights"
          onPress={onOpenFullInsights}
          style={styles.fullInsightsLink}
        >
          <Text style={[styles.fullInsightsLinkText, { color: t.link }]}>View full insights</Text>
          <Ionicons name="chevron-forward" size={13} color={t.link} />
        </TouchableOpacity>
      ) : null}
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
  },
  viewToggle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  metricRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  metricPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  metricPillText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 16,
    fontSize: 12.5,
    lineHeight: 18,
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
  listWrap: {
    marginTop: 10,
    gap: 6,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  listDate: {
    fontSize: 12.5,
  },
  listValue: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  fullInsightsLink: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  fullInsightsLinkText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
});

export default memo(ProgressGraphCard);
