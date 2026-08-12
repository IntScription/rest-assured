import { DarkTheme, DefaultTheme, ThemeProvider, Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { ThemeTransitionOverlay } from "@/src/theme/ThemeTransitionOverlay";
import { supabase } from "@/src/lib/supabase";
import {
  registerForPushNotifications,
  addPushNotificationResponseListener,
} from "@/src/lib/push/registerPush";
import { useIsOnline } from "@/hooks/use-is-online";
import { useSyncOnReconnect } from "@/src/hooks/use-sync-on-reconnect";
import { initMonitoring, Sentry } from "@/src/lib/monitoring";

initMonitoring();

const APP_STORE_URL = "https://apps.apple.com/app/id6760107763";
const APP_STORE_LOOKUP_URL =
  "https://itunes.apple.com/lookup?id=6760107763&country=in";

function compareVersions(a: string, b: string) {
  const aParts = a.split(".").map((p) => Number.parseInt(p, 10) || 0);
  const bParts = b.split(".").map((p) => Number.parseInt(p, 10) || 0);
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i += 1) {
    const av = aParts[i] ?? 0;
    const bv = bParts[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }

  return 0;
}

function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [storeVersion, setStoreVersion] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [openingStore, setOpeningStore] = useState(false);

  const pushRegisteredForUserRef = useRef<string | null>(null);
  const bannerTranslateY = useRef(new Animated.Value(-140)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;

  const isOnline = useIsOnline();
  useSyncOnReconnect(isOnline);

  const currentVersion = useMemo(
    () => Application.nativeApplicationVersion ?? "0.0.0",
    []
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, loading, router, segments]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      pushRegisteredForUserRef.current = null;
      return;
    }

    if (pushRegisteredForUserRef.current === userId) return;

    let cancelled = false;

    (async () => {
      const token = await registerForPushNotifications(userId);
      if (!cancelled && token) {
        pushRegisteredForUserRef.current = userId;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let mounted = true;
    let subscription: { remove: () => void } | null = null;

    (async () => {
      const sub = await addPushNotificationResponseListener((response) => {
        const data = response?.notification?.request?.content?.data as
          | Record<string, any>
          | undefined;

        if (data?.type === "program_share") {
          router.push("/(tabs)/train");
          return;
        }

        if (data?.type === "app_update") {
          Linking.openURL(APP_STORE_URL).catch(() => {
            router.push("/(tabs)/profile");
          });
        }
      });

      if (!mounted) {
        sub?.remove?.();
        return;
      }

      subscription = sub;
    })();

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function checkForStoreUpdate() {
      if (__DEV__) {
        setShowUpdateBanner(false);
        return;
      }

      const executionEnvironment =
        (Constants as any)?.executionEnvironment ??
        (Constants as any)?.appOwnership;

      if (executionEnvironment === "expo" || executionEnvironment === "guest") {
        setShowUpdateBanner(false);
        return;
      }

      setCheckingUpdate(true);

      try {
        const response = await fetch(APP_STORE_LOOKUP_URL);
        const json = await response.json();
        const version = json?.results?.[0]?.version ?? null;

        if (!version) {
          if (!cancelled) {
            setShowUpdateBanner(false);
            setStoreVersion(null);
          }
          return;
        }

        if (!cancelled) {
          setStoreVersion(version);
          setShowUpdateBanner(compareVersions(currentVersion, version) < 0);
        }
      } catch {
        if (!cancelled) {
          setShowUpdateBanner(false);
          setStoreVersion(null);
        }
      } finally {
        if (!cancelled) {
          setCheckingUpdate(false);
        }
      }
    }

    checkForStoreUpdate();

    return () => {
      cancelled = true;
    };
  }, [currentVersion]);

  useEffect(() => {
    if (showUpdateBanner) {
      Animated.parallel([
        Animated.timing(bannerTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bannerOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(bannerTranslateY, {
        toValue: -140,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bannerOpacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [bannerOpacity, bannerTranslateY, showUpdateBanner]);

  const handleOpenStore = async () => {
    setOpeningStore(true);
    try {
      await Linking.openURL(APP_STORE_URL);
    } finally {
      setOpeningStore(false);
    }
  };

  const handleDismissBanner = () => {
    setShowUpdateBanner(false);
  };

  if (loading) return null;

  const bannerBackground = colorScheme === "dark" ? "#111827" : "#ffffff";
  const bannerBorder = colorScheme === "dark" ? "#1f2937" : "#e5e7eb";
  const primaryText = colorScheme === "dark" ? "#ffffff" : "#111827";
  const secondaryText = colorScheme === "dark" ? "#d1d5db" : "#4b5563";
  const subtleText = colorScheme === "dark" ? "#9ca3af" : "#6b7280";
  const buttonBg = colorScheme === "dark" ? "#ffffff" : "#111827";
  const buttonText = colorScheme === "dark" ? "#111827" : "#ffffff";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="auto" />

          <Animated.View
            pointerEvents={showUpdateBanner ? "auto" : "none"}
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              right: 12,
              zIndex: 1000,
              opacity: bannerOpacity,
              transform: [{ translateY: bannerTranslateY }],
            }}
          >
            <View
              style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: bannerBorder,
                backgroundColor: bannerBackground,
                paddingHorizontal: 16,
                paddingVertical: 14,
                shadowColor: "#000",
                shadowOpacity: 0.14,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
                elevation: 8,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: primaryText,
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    Update Available
                  </Text>

                  <Text
                    style={{
                      marginTop: 4,
                      color: secondaryText,
                      lineHeight: 20,
                    }}
                  >
                    A newer version of Rest Assured is available. Update for a
                    better experience.
                  </Text>

                  <Text
                    style={{
                      marginTop: 6,
                      color: subtleText,
                      fontSize: 12,
                    }}
                  >
                    Current: {currentVersion}
                    {storeVersion ? ` • App Store: ${storeVersion}` : ""}
                  </Text>
                </View>

                <Pressable
                  onPress={handleDismissBanner}
                  hitSlop={10}
                  style={{
                    paddingHorizontal: 4,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{
                      color: subtleText,
                      fontSize: 18,
                      fontWeight: "600",
                    }}
                  >
                    ×
                  </Text>
                </Pressable>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 14,
                  gap: 10,
                }}
              >
                <View style={{ minHeight: 20, justifyContent: "center" }}>
                  {checkingUpdate ? <ActivityIndicator size="small" /> : null}
                </View>

                <Pressable
                  onPress={handleOpenStore}
                  disabled={openingStore}
                  style={{
                    borderRadius: 12,
                    backgroundColor: buttonBg,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    minWidth: 128,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {openingStore ? (
                    <ActivityIndicator color={buttonText} size="small" />
                  ) : (
                    <Text
                      style={{
                        color: buttonText,
                        fontWeight: "700",
                      }}
                    >
                      Open App Store
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Animated.View>

          <ThemeTransitionOverlay />
        </View>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
