import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { DARK_THEME, LIGHT_THEME } from "./theme";

/**
 * Individual screens re-theme instantly (see setThemePreference), which is
 * correct for responsiveness but reads as an abrupt snap across the whole
 * app. This masks that snap with a same-tick opaque cover in the new
 * theme's background, then fades it out — a cross-dissolve without having
 * to animate every color in every component.
 */
export function ThemeTransitionOverlay() {
  const scheme = useColorScheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const [overlayColor, setOverlayColor] = useState(
    scheme === "dark" ? DARK_THEME.background : LIGHT_THEME.background
  );
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    setOverlayColor(scheme === "dark" ? DARK_THEME.background : LIGHT_THEME.background);
    opacity.setValue(1);
    Animated.timing(opacity, {
      toValue: 0,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [scheme, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: overlayColor, opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 2000,
  },
});
