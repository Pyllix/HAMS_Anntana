import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  ClipboardCheck,
  PackageCheck,
  Truck,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useNotificationStore } from "../../stores/useNotificationStore";
import type {
  AppNotification,
  NotificationKind,
} from "../../Types/TypeNotification";

const kindIcons: Record<NotificationKind, typeof Bell> = {
  WORKFLOW: ClipboardCheck,
  APPROVAL: CheckCheck,
  PARCEL: PackageCheck,
  DELIVERY: Truck,
};

const kindStyles: Record<NotificationKind, string> = {
  WORKFLOW: "bg-blue-50 text-blue-600",
  APPROVAL: "bg-emerald-50 text-emerald-600",
  PARCEL: "bg-amber-50 text-amber-600",
  DELIVERY: "bg-violet-50 text-violet-600",
};

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const role = useAuthStore((state) => state.role);
  const notifications = useNotificationStore((state) => state.notifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);

  const activeRole = role || "MAINTENANCE_STAFF";
  const visibleNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          notification.recipientRole === activeRole || activeRole === "ADMIN",
      ),
    [activeRole, notifications],
  );
  const unreadCount = visibleNotifications.filter(
    (notification) => !notification.isRead,
  ).length;

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-label={`การแจ้งเตือน${unreadCount ? `ที่ยังไม่อ่าน ${unreadCount} รายการ` : ""}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">การแจ้งเตือน</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {unreadCount > 0
                  ? `มี ${unreadCount} รายการที่ยังไม่ได้อ่าน`
                  : "ไม่มีรายการที่ยังไม่ได้อ่าน"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead(activeRole)}
                className="cursor-pointer text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                อ่านทั้งหมด
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {visibleNotifications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                  <Bell className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  ยังไม่มีการแจ้งเตือน
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  รายการใหม่จากขั้นตอนงานจะแสดงที่นี่
                </p>
              </div>
            ) : (
              visibleNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={() => markAsRead(notification.id)}
                />
              ))
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-center text-[10px] text-slate-400">
            ข้อมูลตัวอย่างจะแสดงเฉพาะบทบาทของผู้ใช้งานปัจจุบัน
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: () => void;
}) {
  const Icon = kindIcons[notification.kind];
  return (
    <button
      type="button"
      onClick={onRead}
      className={`flex w-full cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3.5 text-left transition hover:bg-slate-50 ${
        notification.isRead ? "bg-white" : "bg-emerald-50/35"
      }`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${kindStyles[notification.kind]}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <strong className="text-xs leading-5 text-slate-900">
            {notification.title}
          </strong>
          {!notification.isRead && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          )}
        </span>
        <span className="mt-0.5 block text-[11px] leading-5 text-slate-500">
          {notification.message}
        </span>
        <span className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-400">
          <span className="font-mono font-semibold text-slate-500">
            {notification.jobNo || "งานระบบ"}
          </span>
          <span>{formatRelativeTime(notification.createdAt)}</span>
        </span>
      </span>
    </button>
  );
}

function formatRelativeTime(createdAt: string): string {
  const diffMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000),
  );
  if (diffMinutes < 1) return "เมื่อสักครู่";
  if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
  }).format(new Date(createdAt));
}
