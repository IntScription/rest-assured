import { Platform } from "react-native";
import { supabase } from "@/src/lib/supabase";

let notificationHandlerConfigured = false;

type NotificationsModule = typeof import("expo-notifications");
type DeviceModule = typeof import("expo-device");
type ConstantsModule = typeof import("expo-constants").default;

async function getDeviceModule(): Promise<DeviceModule | null> {
  try {
    const mod = await import("expo-device");
    return mod;
  } catch (error) {
    console.log("expo-device unavailable:", error);
    return null;
  }
}

async function getConstantsModule(): Promise<ConstantsModule | null> {
  try {
    const mod = await import("expo-constants");
    return mod.default;
  } catch (error) {
    console.log("expo-constants unavailable:", error);
    return null;
  }
}

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  try {
    const mod = await import("expo-notifications");
    return mod;
  } catch (error) {
    console.log("expo-notifications unavailable:", error);
    return null;
  }
}

async function ensureNotificationHandler(Notifications?: NotificationsModule | null) {
  if (notificationHandlerConfigured) return true;

  const notifications = Notifications ?? (await getNotificationsModule());
  if (!notifications) return false;

  if (typeof notifications.setNotificationHandler !== "function") {
    console.log("setNotificationHandler is unavailable.");
    return false;
  }

  try {
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    notificationHandlerConfigured = true;
    return true;
  } catch (error) {
    console.log("Failed to configure notification handler:", error);
    return false;
  }
}

export async function registerForPushNotifications(userId: string) {
  const [Device, Constants, Notifications] = await Promise.all([
    getDeviceModule(),
    getConstantsModule(),
    getNotificationsModule(),
  ]);

  if (!Device || !Constants || !Notifications) {
    console.log("Push notification modules are unavailable.");
    return null;
  }

  await ensureNotificationHandler(Notifications);

  if (!Device.isDevice) {
    console.log("Push notifications require a real device.");
    return null;
  }

  if (
    Platform.OS === "android" &&
    typeof Notifications.setNotificationChannelAsync === "function"
  ) {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance?.MAX ?? 5,
      });
    } catch (error) {
      console.log("Failed to set Android notification channel:", error);
      return null;
    }
  }

  let finalStatus: string;

  try {
    if (typeof Notifications.getPermissionsAsync !== "function") {
      console.log("getPermissionsAsync is unavailable.");
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      if (typeof Notifications.requestPermissionsAsync !== "function") {
        console.log("requestPermissionsAsync is unavailable.");
        return null;
      }

      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
  } catch (error) {
    console.log("Failed to get/request notification permissions:", error);
    return null;
  }

  if (finalStatus !== "granted") {
    console.log("Notification permission not granted.");
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.log("Project ID not found.");
    return null;
  }

  try {
    if (typeof Notifications.getExpoPushTokenAsync !== "function") {
      console.log("getExpoPushTokenAsync is unavailable.");
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    const { error } = await supabase
      .from("profiles")
      .update({ expo_push_token: token })
      .eq("id", userId);

    if (error) {
      console.log("Failed to save expo push token:", error);
      return null;
    }

    return token;
  } catch (error) {
    console.log("Failed to get Expo push token:", error);
    return null;
  }
}

export async function addPushNotificationResponseListener(
  onResponse: (response: any) => void
) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    console.log("expo-notifications unavailable.");
    return null;
  }

  await ensureNotificationHandler(Notifications);

  if (typeof Notifications.addNotificationResponseReceivedListener !== "function") {
    console.log("addNotificationResponseReceivedListener is unavailable.");
    return null;
  }

  try {
    return Notifications.addNotificationResponseReceivedListener(onResponse);
  } catch (error) {
    console.log("Failed to add notification response listener:", error);
    return null;
  }
}
