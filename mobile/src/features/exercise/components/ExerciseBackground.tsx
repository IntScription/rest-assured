import React from "react";
import { Animated, StyleSheet, ViewStyle } from "react-native";

type BubbleColors = {
  primary: string;
  secondary: string;
  third: string;
};

type Props = {
  colors: BubbleColors;
  bubbleOneStyle: ViewStyle | any;
  bubbleTwoStyle: ViewStyle | any;
  bubbleThreeStyle: ViewStyle | any;
};

export default function ExerciseBackground({
  colors,
  bubbleOneStyle,
  bubbleTwoStyle,
  bubbleThreeStyle,
}: Props) {
  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.backgroundBubbleLarge,
          { backgroundColor: colors.primary },
          bubbleOneStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.backgroundBubbleMedium,
          { backgroundColor: colors.secondary },
          bubbleTwoStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.backgroundBubbleSmall,
          { backgroundColor: colors.third },
          bubbleThreeStyle,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backgroundBubbleLarge: {
    position: "absolute",
    width: 310,
    height: 310,
    borderRadius: 155,
    top: -96,
    left: -122,
  },
  backgroundBubbleMedium: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    top: 230,
    right: -140,
  },
  backgroundBubbleSmall: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: 120,
    left: -120,
  },
});
