import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getBusinessToken } from "./auth";

const API = (process.env.EXPO_PUBLIC_API_URL || "https://admin.ecalisgan.com").replace(/\/$/, "");

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerBusinessPush() {
  if (Platform.OS === "web") return false;

  const token = getBusinessToken();
  if (!token) return false;

  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Çalışkan Business",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;

  const expoToken = (
    await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
  ).data;

  const response = await fetch(`${API}/api/push/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      app: "business",
      expoToken,
      platform: Platform.OS,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "Bildirim cihaz kaydı başarısız");
  }

  return true;
}

export function listenBusinessNotificationPress(
  handler: (type: string, data: Record<string, unknown>) => void,
) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
    const type = typeof data.type === "string" ? data.type : "";
    handler(type, data);
  });
}
