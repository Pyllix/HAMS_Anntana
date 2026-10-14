import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ClipboardCheck,
  Clock3,
  PackageCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import {
  getParcelNotifications,
  getParcelUnreadCount,
  markAllParcelNotificationsRead,
  markParcelNotificationRead,
  openParcelNotificationStream,
} from "../../services/parcelNotificationService";
import type {
  NotificationResourceType,
  ServerNotification,
  ServerNotificationType,
} from "../../types/TypeServerNotification";

const LIST_QUERY_KEY = "parcel-server-notifications";
const COUNT_QUERY_KEY = "parcel-server-notification-unread-count";

const notificationIcons: Record<ServerNotificationType, LucideIcon> = {
  BORROW_APPROVAL_REQUIRED: ClipboardCheck,
  BORROW_APPROVED: CheckCheck,
  REPAIR_APPROVAL_REQUIRED: Wrench,
  REPAIR_READY_FOR_COLLECTION: PackageCheck,
  BORROW_EXTENSION_APPROVAL_REQUIRED: ClipboardCheck,
  BORROW_EXTENSION_APPROVED: CheckCheck,
  BORROW_EXTENSION_REJECTED: AlertTriangle,
  BORROW_DUE_SOON: Clock3,
  BORROW_OVERDUE: AlertTriangle,
};

const notificationStyles: Record<ServerNotificationType, string> = {
  BORROW_APPROVAL_REQUIRED: "bg-blue-50 text-blue-600",
  BORROW_APPROVED: "bg-emerald-50 text-emerald-600",
  REPAIR_APPROVAL_REQUIRED: "bg-amber-50 text-amber-700",
  REPAIR_READY_FOR_COLLECTION: "bg-violet-50 text-violet-600",
  BORROW_EXTENSION_APPROVAL_REQUIRED: "bg-blue-50 text-blue-600",
  BORROW_EXTENSION_APPROVED: "bg-emerald-50 text-emerald-600",
  BORROW_EXTENSION_REJECTED: "bg-rose-50 text-rose-600",
  BORROW_DUE_SOON: "bg-amber-50 text-amber-700",
  BORROW_OVERDUE: "bg-rose-50 text-rose-600",
};

function targetPath(
  resourceType: NotificationResourceType,
  resourceId: string,
): string {
  const params = new URLSearchParams({
    notificationResourceType: resourceType,
    notificationResourceId: resourceId,
  });
  const path =
    resourceType === "REPAIR_JOB"
      ? "/parcel-repair-operations"
      : "/borrow-request";
  return `${path}?${params.toString()}`;
}

export default function ParcelNotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [streamStatus, setStreamStatus] = useState<"CONNECTED" | "RECONNECTING">(
    "CONNECTED",
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const listQueryKey = [LIST_QUERY_KEY, userId] as const;
  const countQueryKey = [COUNT_QUERY_KEY, userId] as const;

  const notificationsQuery = useQuery({
    queryKey: listQueryKey,
    queryFn: () => getParcelNotifications(1, 20),
    enabled: Boolean(userId),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
  const unreadQuery = useQuery({
    queryKey: countQueryKey,
    queryFn: getParcelUnreadCount,
    enabled: Boolean(userId),
    staleTime: 10_000,
    refetchInterval: 60_000,
  });

  const refreshNotifications = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [LIST_QUERY_KEY, userId] });
    void queryClient.invalidateQueries({ queryKey: [COUNT_QUERY_KEY, userId] });
  }, [queryClient, userId]);

  const readMutation = useMutation({
    mutationFn: markParcelNotificationRead,
    onSuccess: refreshNotifications,
  });
  const readAllMutation = useMutation({
    mutationFn: markAllParcelNotificationsRead,
    onSuccess: refreshNotifications,
  });

  useEffect(() => {
    if (!userId) return;

    const stream = openParcelNotificationStream();
    const handleSync = () => {
      setStreamStatus("CONNECTED");
      refreshNotifications();
    };
    const handleCreated = () => {
      setStreamStatus("CONNECTED");
      refreshNotifications();
    };
    const handleChanged = () => refreshNotifications();

    stream.onopen = () => setStreamStatus("CONNECTED");
    stream.onerror = () => setStreamStatus("RECONNECTING");
    stream.addEventListener("notifications.sync_required", handleSync);
    stream.addEventListener("notification.created", handleCreated);
    stream.addEventListener("notifications.changed", handleChanged);

    return () => {
      stream.removeEventListener("notifications.sync_required", handleSync);
      stream.removeEventListener("notification.created", handleCreated);
      stream.removeEventListener("notifications.changed", handleChanged);
      stream.close();
    };
  }, [refreshNotifications, userId]);

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

  const notifications = notificationsQuery.data?.data ?? [];
  const unreadCount = unreadQuery.data ?? 0;

  const handleNotificationClick = (notification: ServerNotification) => {
    if (!notification.readAt) readMutation.mutate(notification.id);
    setIsOpen(false);
    navigate(targetPath(notification.resourceType, notification.resourceId), {
      state: {
        notificationResourceType: notification.resourceType,
        notificationResourceId: notification.resourceId,
      },
    });
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-label={`การแจ้งเตือนเจ้าหน้าที่พัสดุ${unreadCount ? `ที่ยังไม่อ่าน ${unreadCount} รายการ` : ""}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-[400px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
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
                onClick={() => readAllMutation.mutate()}
                disabled={readAllMutation.isLoading}
                className="cursor-pointer text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                อ่านทั้งหมด
              </button>
            )}
          </div>

          <div className="max-h-[440px] overflow-y-auto">
            {notificationsQuery.isLoading ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                กำลังโหลดการแจ้งเตือน...
              </div>
            ) : notificationsQuery.isError ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-semibold text-rose-600">
                  โหลดการแจ้งเตือนไม่สำเร็จ
                </p>
                <button
                  type="button"
                  onClick={() => refreshNotifications()}
                  className="mt-3 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  ลองใหม่
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                  <Bell className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  ยังไม่มีการแจ้งเตือน
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  รายการที่ backend ส่งให้บัญชีนี้จะแสดงที่นี่
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <ParcelNotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[10px] text-slate-400">
            <span>แสดง 20 รายการล่าสุด</span>
            <span>
              {streamStatus === "CONNECTED"
                ? "รับการแจ้งเตือนแบบเรียลไทม์"
                : "กำลังเชื่อมต่อใหม่..."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ParcelNotificationItem({
  notification,
  onClick,
}: {
  notification: ServerNotification;
  onClick: () => void;
}) {
  const Icon = notificationIcons[notification.type] ?? Bell;
  const style = notificationStyles[notification.type] ?? "bg-slate-50 text-slate-600";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3.5 text-left transition hover:bg-slate-50 ${
        notification.readAt ? "bg-white" : "bg-emerald-50/35"
      }`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <strong className="text-xs leading-5 text-slate-900">
            {notification.title}
          </strong>
          {!notification.readAt && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          )}
        </span>
        <span className="mt-0.5 block text-[11px] leading-5 text-slate-500">
          {notification.message}
        </span>
        <span className="mt-1.5 block text-right text-[10px] text-slate-400">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </span>
    </button>
  );
}

function formatRelativeTime(createdAt: string): string {
  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) return "-";
  const diffMinutes = Math.max(
    0,
    Math.round((Date.now() - createdTime) / 60_000),
  );
  if (diffMinutes < 1) return "เมื่อสักครู่";
  if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).format(new Date(createdAt));
}

