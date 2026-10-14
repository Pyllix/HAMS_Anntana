import type {
  ServerNotification,
  ServerNotificationPage,
} from "../types/TypeServerNotification";

// รูปแบบเดียวกับ InfiniteData ของ react-query แต่ไม่ผูก import เพื่อให้เทสต์แบบ pure ได้
export interface NotificationPages {
  pages: ServerNotificationPage[];
  pageParams: unknown[];
}

// เมื่อมีรายการใหม่ถูกแทรกไว้บนสุด หน้าถัดไปที่โหลดภายหลังจะเลื่อน offset จึงอาจได้รายการซ้ำ ต้องตัดซ้ำด้วย id
export function flattenNotificationPages(
  data: NotificationPages | undefined,
): ServerNotification[] {
  if (!data) return [];
  const seen = new Set<string>();
  const result: ServerNotification[] = [];
  for (const page of data.pages) {
    for (const notification of page.data) {
      if (seen.has(notification.id)) continue;
      seen.add(notification.id);
      result.push(notification);
    }
  }
  return result;
}

export function findNotification(
  data: NotificationPages | undefined,
  id: string,
): ServerNotification | undefined {
  for (const page of data?.pages ?? []) {
    const match = page.data.find((notification) => notification.id === id);
    if (match) return match;
  }
  return undefined;
}

export function prependNotification(
  data: NotificationPages | undefined,
  notification: ServerNotification,
): NotificationPages | undefined {
  if (!data || data.pages.length === 0) return data;
  if (findNotification(data, notification.id)) return data;
  const [first, ...rest] = data.pages;
  return {
    ...data,
    pages: [
      {
        ...first,
        data: [notification, ...first.data],
        meta: { ...first.meta, total: first.meta.total + 1 },
      },
      ...rest,
    ],
  };
}

export function markNotificationReadInPages(
  data: NotificationPages | undefined,
  id: string,
  readAt: string,
): NotificationPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.map((notification) =>
        notification.id === id && !notification.readAt
          ? { ...notification, readAt }
          : notification,
      ),
    })),
  };
}

export function replaceNotificationInPages(
  data: NotificationPages | undefined,
  updated: ServerNotification,
): NotificationPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.map((notification) =>
        notification.id === updated.id ? { ...notification, ...updated } : notification,
      ),
    })),
  };
}

export function markAllReadInPages(
  data: NotificationPages | undefined,
  readAt: string,
): NotificationPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.map((notification) =>
        notification.readAt ? notification : { ...notification, readAt },
      ),
    })),
  };
}

// นับเพิ่มเฉพาะรายการใหม่ที่ยังไม่อ่านและยังไม่เคยอยู่ในรายการ (กัน event ซ้ำจาก reconnect)
export function unreadCountAfterCreated(
  count: number | undefined,
  data: NotificationPages | undefined,
  notification: ServerNotification,
): number | undefined {
  if (count === undefined) return count;
  if (notification.readAt || findNotification(data, notification.id)) return count;
  return count + 1;
}
