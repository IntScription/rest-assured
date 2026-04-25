import React from "react";
import { Text } from "react-native";
import CoachSectionCard from "./CoachSectionCard";
import { useAppTheme } from "@/src/theme/theme";
import type { CoachInsightRow } from "@/src/features/coach/types/coach";

type Props = {
  insight: CoachInsightRow | null;
};

export default function WeeklyReviewCard({ insight }: Props) {
  const t = useAppTheme();

  return (
    <CoachSectionCard title="Weekly Review">
      <Text style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>
        {insight?.summary ?? "No weekly review yet."}
      </Text>
    </CoachSectionCard>
  );
}
