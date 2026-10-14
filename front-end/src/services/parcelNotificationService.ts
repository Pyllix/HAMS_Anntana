import { API_BASE_PATH, apiClient } from "./apiClient";
import type {
  NotificationReadAllResult,
  NotificationUnreadCount,
  ServerNotification,
  ServerNotificationPage,
} from "../types/TypeServerNotification";

const NOTIFICATION_PATH = "/notifications";

export async function getParcelNotifications(
  page = 1,
  limit = 20,
): Promise<ServerNotificationPage> {
  const response = await apiClient.get<ServerNotificationPage>(
    NOTIFICATION_PATH,
    { params: { page, limit } },
  );
  return response.data;
}

export async function getParcelUnreadCount(): Promise<number> {
  const response = await apiClient.get<NotificationUnreadCount>(
    `${NOTIFICATION_PATH}/unread-count`,
  );
  return response.data.count;
}

export async function markParcelNotificationRead(
  notificationId: string,
): Promise<ServerNotification> {
  const response = await apiClient.patch<ServerNotification>(
    `${NOTIFICATION_PATH}/${encodeURIComponent(notificationId)}/read`,
    {},
  );
  return response.data;
}

export async function markAllParcelNotificationsRead(): Promise<NotificationReadAllResult> {
  const response = await apiClient.patch<NotificationReadAllResult>(
    `${NOTIFICATION_PATH}/read-all`,
    {},
  );
  return response.data;
}

export function openParcelNotificationStream(): EventSource {
  return new EventSource(`${API_BASE_PATH}${NOTIFICATION_PATH}/stream`, {
    withCredentials: true,
  });
}

