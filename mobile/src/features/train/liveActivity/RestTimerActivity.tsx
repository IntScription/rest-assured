import { createLiveActivity } from "expo-widgets";
import { HStack, Image, Text, VStack } from "@expo/ui/swift-ui";
import { padding } from "@expo/ui/swift-ui/modifiers";

export type RestTimerActivityProps = {
  secondsRemaining: number;
  totalSeconds: number;
  exerciseName?: string;
};

function formatClock(seconds: number) {
  const clamped = Math.max(0, Math.round(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const RestTimerActivityView = (props: RestTimerActivityProps) => {
  "widget";

  const label = props.exerciseName ?? "Rest Timer";
  const clock = formatClock(props.secondsRemaining);

  return {
    banner: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <HStack>
          <Image systemName="timer" />
          <Text>{label}</Text>
        </HStack>
        <Text>{clock}</Text>
      </VStack>
    ),
    compactLeading: <Image systemName="timer" />,
    compactTrailing: <Text>{clock}</Text>,
    minimal: <Image systemName="timer" />,
    expandedLeading: <Image systemName="timer" />,
    expandedTrailing: <Text>{clock}</Text>,
    expandedCenter: <Text>{label}</Text>,
  };
};

export default createLiveActivity("RestTimerActivity", RestTimerActivityView);
