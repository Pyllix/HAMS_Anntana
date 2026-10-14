import type { ServerNotification } from "../types/TypeServerNotification";

export type NotificationStreamStatus = "CONNECTING" | "CONNECTED" | "RECONNECTING";

// ส่วนของ EventSource ที่ใช้จริง แยกไว้เพื่อให้เทสต์ส่ง fake เข้ามาได้
export interface NotificationEventSource {
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  close(): void;
}

export interface NotificationStreamOptions {
  open: () => NotificationEventSource;
  onCreated: (notification: ServerNotification) => void;
  // backend ส่ง sync_required ทุกครั้งที่ต่อสำเร็จ (รวมถึงหลัง reconnect) และ changed เมื่อสถานะอ่านเปลี่ยนจากแท็บอื่น
  onSyncRequired: () => void;
  onChanged: () => void;
  onStatusChange?: (status: NotificationStreamStatus) => void;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  cancel?: (handle: unknown) => void;
  random?: () => number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface NotificationStreamConnection {
  close: () => void;
  reconnectNow: () => void;
}

const DEFAULT_BASE_DELAY_MS = 1_000;
const DEFAULT_MAX_DELAY_MS = 30_000;

// Exponential backoff + jitter (0.5x–1x) เพื่อไม่ให้ทุกแท็บต่อกลับพร้อมกันหลัง backend restart
export function reconnectDelayMs(
  attempt: number,
  random: () => number = Math.random,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
): number {
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt));
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

export function parseCreatedNotification(raw: unknown): ServerNotification | null {
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw) as Partial<ServerNotification> | null;
    if (
      !value ||
      typeof value.id !== "string" ||
      typeof value.createdAt !== "string" ||
      typeof value.type !== "string"
    ) {
      return null;
    }
    return {
      ...value,
      readAt: value.readAt ?? null,
    } as ServerNotification;
  } catch {
    return null;
  }
}

/**
 * เปิด SSE แล้วจัดการ reconnect เอง (ปิด EventSource เดิมทุกครั้งที่ error)
 * เพราะ EventSource ของเบราว์เซอร์จะหยุด retry ถาวรเมื่อ server ตอบ non-200 และ retry ถี่โดยไม่มี backoff
 * หลัง close() จะไม่มี connection หรือ timer ค้าง และ event ที่มาช้าจะถูกทิ้ง
 */
export function createNotificationStream(
  options: NotificationStreamOptions,
): NotificationStreamConnection {
  const schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const cancel =
    options.cancel ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const random = options.random ?? Math.random;

  let source: NotificationEventSource | null = null;
  let retryHandle: unknown = null;
  let attempt = 0;
  let closed = false;

  const setStatus = (status: NotificationStreamStatus) => {
    if (!closed) options.onStatusChange?.(status);
  };

  const disposeSource = () => {
    if (!source) return;
    source.onopen = null;
    source.onerror = null;
    source.close();
    source = null;
  };

  const clearRetry = () => {
    if (retryHandle !== null) {
      cancel(retryHandle);
      retryHandle = null;
    }
  };

  const connect = () => {
    if (closed) return;
    clearRetry();
    disposeSource();
    setStatus(attempt === 0 ? "CONNECTING" : "RECONNECTING");

    let current: NotificationEventSource;
    try {
      current = options.open();
    } catch {
      scheduleReconnect();
      return;
    }
    source = current;
    const isCurrent = () => !closed && source === current;

    current.onopen = () => {
      if (!isCurrent()) return;
      attempt = 0;
      setStatus("CONNECTED");
    };
    current.onerror = () => {
      if (!isCurrent()) return;
      disposeSource();
      scheduleReconnect();
    };
    current.addEventListener("notifications.sync_required", () => {
      if (isCurrent()) options.onSyncRequired();
    });
    current.addEventListener("notifications.changed", () => {
      if (isCurrent()) options.onChanged();
    });
    current.addEventListener("notification.created", (event) => {
      if (!isCurrent()) return;
      const notification = parseCreatedNotification(event.data);
      // payload ผิดรูปแบบ: ไม่ทำให้แอปพัง แต่ให้ sync จาก REST แทน
      if (notification) options.onCreated(notification);
      else options.onSyncRequired();
    });
  };

  const scheduleReconnect = () => {
    if (closed) return;
    setStatus("RECONNECTING");
    const delay = reconnectDelayMs(
      attempt,
      random,
      options.baseDelayMs,
      options.maxDelayMs,
    );
    attempt += 1;
    retryHandle = schedule(() => {
      retryHandle = null;
      connect();
    }, delay);
  };

  connect();

  return {
    close: () => {
      if (closed) return;
      closed = true;
      clearRetry();
      disposeSource();
    },
    reconnectNow: () => {
      if (closed || source) return;
      connect();
    },
  };
}
