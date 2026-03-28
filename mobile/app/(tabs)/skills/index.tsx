import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/src/theme/theme";
import SkillsSegmentedControl, {
  type SkillsTabKey,
} from "@/src/features/skills/components/SkillsSegmentedControl";
import ProgressSection from "@/src/features/skills/components/ProgressSection";
import ExploreSection from "@/src/features/skills/components/ExploreSection";
import ChallengesSection from "@/src/features/skills/components/ChallengesSection";

export default function SkillsScreen() {
  const t = useAppTheme();
  const [activeTab, setActiveTab] = useState<SkillsTabKey>("progress");

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: t.background }]}
    >
      <SkillsSegmentedControl value={activeTab} onChange={setActiveTab} />

      <View style={styles.content}>
        {activeTab === "progress" && <ProgressSection />}
        {activeTab === "explore" && <ExploreSection />}
        {activeTab === "challenges" && <ChallengesSection />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
