import { useCallback, useRef, useState } from "react";
import { Animated } from "react-native";

type AchievementToast = {
  id: string;
  name: string;
};

export function useAchievementUnlocks() {
  const [toast, setToast] = useState<AchievementToast | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  const showToast = useCallback(
    (payload: AchievementToast) => {
      setToast(payload);
      opacity.setValue(0);
      translateY.setValue(12);

      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(2000),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 12,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setToast(null);
      });
    },
    [opacity, translateY]
  );

  return {
    toast,
    showToast,
    animatedStyle: {
      opacity,
      transform: [{ translateY }],
    },
  };
}
