"use client";

import { ReactNode, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

type AuthBackgroundVariant = "login" | "signup" | "forgot" | "reset";

type Props = {
  children: ReactNode;
  variant?: AuthBackgroundVariant;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
};

const STAR_POSITIONS = [
  { top: "12%", left: "14%", size: 3 },
  { top: "18%", left: "78%", size: 2 },
  { top: "29%", left: "88%", size: 4 },
  { top: "41%", left: "10%", size: 2 },
  { top: "55%", left: "83%", size: 3 },
  { top: "68%", left: "18%", size: 4 },
  { top: "77%", left: "66%", size: 2 },
  { top: "86%", left: "39%", size: 3 },
] as const;

function getVariantPalette(variant: AuthBackgroundVariant) {
  const palettes = {
    login: {
      base: "#050712",
      baseGlow: "rgba(8,47,73,0.55)",
      orbA: "rgba(14,165,233,0.42)",
      orbB: "rgba(168,85,247,0.34)",
      orbC: "rgba(34,197,94,0.20)",
      accent: "rgba(56,189,248,0.9)",
      beam: "rgba(56,189,248,0.18)",
    },
    signup: {
      base: "#04100B",
      baseGlow: "rgba(6,78,59,0.48)",
      orbA: "rgba(34,197,94,0.38)",
      orbB: "rgba(14,165,233,0.32)",
      orbC: "rgba(168,85,247,0.24)",
      accent: "rgba(52,211,153,0.9)",
      beam: "rgba(52,211,153,0.18)",
    },
    forgot: {
      base: "#100904",
      baseGlow: "rgba(120,53,15,0.48)",
      orbA: "rgba(245,158,11,0.38)",
      orbB: "rgba(14,165,233,0.28)",
      orbC: "rgba(244,63,94,0.20)",
      accent: "rgba(251,191,36,0.9)",
      beam: "rgba(251,191,36,0.18)",
    },
    reset: {
      base: "#03100A",
      baseGlow: "rgba(20,83,45,0.48)",
      orbA: "rgba(34,197,94,0.36)",
      orbB: "rgba(14,165,233,0.28)",
      orbC: "rgba(245,158,11,0.20)",
      accent: "rgba(74,222,128,0.9)",
      beam: "rgba(74,222,128,0.18)",
    },
  };

  return palettes[variant];
}

export default function AuthAnimatedBackground({
  children,
  variant = "login",
  contentContainerStyle,
  scrollEnabled = true,
}: Props) {
  const palette = useMemo(() => getVariantPalette(variant), [variant]);

  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;
  const floatC = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    floatA.setValue(0);
    floatB.setValue(0);
    floatC.setValue(0);
    pulse.setValue(0);
    spin.setValue(0);
    shimmer.setValue(0);

    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatA, {
            toValue: 1,
            duration: 12000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatA, {
            toValue: 0,
            duration: 12000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatB, {
            toValue: 1,
            duration: 15000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatB, {
            toValue: 0,
            duration: 15000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatC, {
            toValue: 1,
            duration: 18000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatC, {
            toValue: 0,
            duration: 18000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 2600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 2600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 46000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, {
            toValue: 1,
            duration: 5200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(shimmer, {
            toValue: 0,
            duration: 5200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [floatA, floatB, floatC, pulse, spin, shimmer]);

  const spinDeg = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const reverseSpinDeg = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  return (
    <View style={[styles.root, { backgroundColor: palette.base }]}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View
          style={[
            styles.baseGlow,
            {
              backgroundColor: palette.baseGlow,
            },
          ]}
        />

        <Animated.View
          style={[
            styles.orb,
            styles.orbTop,
            {
              backgroundColor: palette.orbA,
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1],
              }),
              transform: [
                {
                  translateX: floatA.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -32],
                  }),
                },
                {
                  translateY: floatA.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 34],
                  }),
                },
                {
                  scale: floatA.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.08],
                  }),
                },
              ],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.orb,
            styles.orbMiddle,
            {
              backgroundColor: palette.orbB,
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.58, 0.9],
              }),
              transform: [
                {
                  translateX: floatB.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 36],
                  }),
                },
                {
                  translateY: floatB.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -26],
                  }),
                },
                {
                  scale: floatB.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.1],
                  }),
                },
              ],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.orb,
            styles.orbBottom,
            {
              backgroundColor: palette.orbC,
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.48, 0.82],
              }),
              transform: [
                {
                  translateX: floatC.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -24],
                  }),
                },
                {
                  translateY: floatC.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -34],
                  }),
                },
                {
                  scale: floatC.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.08],
                  }),
                },
              ],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.auroraBeam,
            {
              backgroundColor: palette.beam,
              opacity: shimmer.interpolate({
                inputRange: [0, 1],
                outputRange: [0.12, 0.34],
              }),
              transform: [
                { rotate: "-18deg" },
                {
                  translateX: shimmer.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-70, 70],
                  }),
                },
              ],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.ring,
            styles.ringLarge,
            {
              borderColor: palette.beam,
              transform: [{ rotate: spinDeg }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.ring,
            styles.ringSmall,
            {
              borderColor: "rgba(255,255,255,0.08)",
              transform: [{ rotate: reverseSpinDeg }],
            },
          ]}
        />

        <View style={styles.gridWrap}>
          {Array.from({ length: 10 }).map((_, index) => (
            <View
              key={`h-${index}`}
              style={[
                styles.gridLineHorizontal,
                {
                  top: 32 + index * 60,
                },
              ]}
            />
          ))}

          {Array.from({ length: 7 }).map((_, index) => (
            <View
              key={`v-${index}`}
              style={[
                styles.gridLineVertical,
                {
                  left: 18 + index * 64,
                },
              ]}
            />
          ))}
        </View>

        {STAR_POSITIONS.map((star, index) => (
          <Animated.View
            key={`star-${index}`}
            style={[
              styles.star,
              {
                top: star.top,
                left: star.left,
                width: star.size,
                height: star.size,
                backgroundColor: index % 2 === 0 ? palette.accent : "#fff",
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.16 + index * 0.015, 0.52 + index * 0.02],
                }),
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.45],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}

        <View style={styles.vignetteTop} />
        <View style={styles.vignetteBottom} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          scrollEnabled={scrollEnabled}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, contentContainerStyle]}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFill,
  },
  keyboardWrap: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    flexGrow: 1,
  },

  baseGlow: {
    position: "absolute",
    width: 620,
    height: 620,
    borderRadius: 999,
    top: -260,
    left: -180,
    opacity: 0.8,
  },

  orb: {
    position: "absolute",
    borderRadius: 999,
  },
  orbTop: {
    width: 330,
    height: 330,
    top: -128,
    right: -132,
  },
  orbMiddle: {
    width: 270,
    height: 270,
    top: 245,
    left: -142,
  },
  orbBottom: {
    width: 340,
    height: 340,
    bottom: -182,
    right: -150,
  },

  auroraBeam: {
    position: "absolute",
    width: 160,
    height: 760,
    top: -120,
    left: "35%",
    borderRadius: 999,
  },

  ring: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 999,
    borderStyle: "dashed",
  },
  ringLarge: {
    width: 410,
    height: 410,
    top: -148,
    left: -134,
  },
  ringSmall: {
    width: 220,
    height: 220,
    right: -64,
    bottom: 118,
  },

  gridWrap: {
    ...StyleSheet.absoluteFill,
    opacity: 0.58,
    transform: [{ rotate: "-9deg" }],
  },
  gridLineHorizontal: {
    position: "absolute",
    left: -90,
    right: -90,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.045)",
  },
  gridLineVertical: {
    position: "absolute",
    top: -140,
    bottom: -140,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  star: {
    position: "absolute",
    borderRadius: 999,
  },

  vignetteTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  vignetteBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
    backgroundColor: "rgba(0,0,0,0.26)",
  },
});
