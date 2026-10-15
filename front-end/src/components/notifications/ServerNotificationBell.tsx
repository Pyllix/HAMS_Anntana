import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ClipboardCheck,
  Clock3,
  Loader2,
  PackageCheck,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useServerNotifications } from "../../hooks/useServerNotifications";
import {
  formatNotificationRelativeTime,
  notificationTone,
  type NotificationTargetResolver,
  type NotificationTone,
} from "../../services/notificationTargets";
import type { ServerNotification } from "../../types/TypeServerNotification";

const notificationIcons: Record<string, LucideIcon> = {
  BORROW_APPROVAL_REQUIRED: ClipboardCheck,
  BORROW_APPROVED: CheckCheck,
  REPAIR_APPROVAL_REQUIRED: Wrench,
  REPAIR_READY_FOR_COLLECTION: PackageCheck,
  REPAIR_UNREPAIRABLE_RECEIVED: PackageCheck,
  BORROW_EXTENSION_APPROVAL_REQUIRED: ClipboardCheck,
  BORROW_EXTENSION_APPROVED: CheckCheck,
  BORROW_EXTENSION_REJECTED: XCircle,
  BORROW_DUE_SOON: Clock3,
  BORROW_OVERDUE: AlertTriangle,
};

const notificationStyles: Record<string, string> = {
  BORROW_APPROVAL_REQUIRED: "bg-blue-50 text-blue-600",
  BORROW_APPROVED: "bg-emerald-50 text-emerald-600",
  REPAIR_APPROVAL_REQUIRED: "bg-amber-50 text-amber-700",
  REPAIR_READY_FOR_COLLECTION: "bg-violet-50 text-violet-600",
  REPAIR_UNREPAIRABLE_RECEIVED: "bg-amber-50 text-amber-700",
  BORROW_EXTENSION_APPROVAL_REQUIRED: "bg-blue-50 text-blue-600",
  BORROW_EXTENSION_APPROVED: "bg-emerald-50 text-emerald-600",
  BORROW_EXTENSION_REJECTED: "bg-rose-50 text-rose-600",
  BORROW_DUE_SOON: "bg-yellow-100 text-yellow-700",
  BORROW_OVERDUE: "bg-rose-100 text-rose-600",
};

// แจ้งเตือนเชิงเตือน: เกินกำหนด = แดง, ใกล้กำหนด = เหลือง, ต้องดำเนินการ = น้ำเงิน (แยกจากสถานะอ่าน/ยังไม่อ่าน)
const toneRowStyles: Record<NotificationTone, { unread: string; read: string }> = {
  danger: {
    unread: "border-l-4 border-l-rose-500 bg-rose-50",
    read: "border-l-4 border-l-rose-200 bg-white",
  },
  warning: {
    unread: "border-l-4 border-l-yellow-400 bg-yellow-50",
    read: "border-l-4 border-l-yellow-200 bg-white",
  },
  action: {
    unread: "border-l-4 border-l-blue-500 bg-blue-50/60",
    read: "border-l-4 border-l-blue-200 bg-white",
  },
  default: {
    unread: "border-l-4 border-l-emerald-500 bg-emerald-50/40",
    read: "border-l-4 border-l-transparent bg-white",
  },
};

const toneLabels: Partial<Record<NotificationTone, { text: string; className: string }>> = {
  danger: { text: "เกินกำหนด", className: "bg-rose-600 text-white" },
  warning: { text: "ใกล้กำหนด", className: "bg-yellow-400 text-yellow-950" },
  action: { text: "ต้องดำเนินการ", className: "bg-blue-600 text-white" },
};

interface ServerNotificationBellProps {
  resolveTarget: NotificationTargetResolver;
  ariaLabel?: string;
}

export default function ServerNotificationBell({
  resolveTarget,
  ariaLabel = "การแจ้งเตือน",
}: ServerNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading,
    isError,
    retry,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    markRead,
    markAllRead,
    isMarkingAllRead,
    actionError,
    streamStatus,
  } = useServerNotifications();

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
    // อัปเดตเวลาแบบ relative ระหว่างเปิด panel
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearInterval(clock);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const togglePanel = () => {
    setNow(Date.now());
    setIsOpen((open) => !open);
  };

  const handleNotificationClick = (notification: ServerNotification) => {
    if (!notification.readAt) markRead(notification.id);
    let target: string | null = null;
    try {
      target = resolveTarget(notification);
    } catch {
      target = null;
    }
    // resourceType ที่ไม่รู้จัก: ทำเครื่องหมายว่าอ่านแล้วอย่างเดียว ไม่นำทาง
    if (!target) return;
    setIsOpen(false);
    navigate(target);
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-label={`${ariaLabel}${unreadCount ? ` ยังไม่อ่าน ${unreadCount} รายการ` : ""}`}
        aria-expanded={isOpen}
        onClick={togglePanel}
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
                onClick={markAllRead}
                disabled={isMarkingAllRead}
                className="cursor-pointer text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMarkingAllRead ? "กำลังบันทึก..." : "อ่านทั้งหมด"}
              </button>
            )}
          </div>

          {actionError && (
            <p
              role="alert"
              className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-[11px] font-medium text-rose-700"
            >
              {actionError}
            </p>
          )}

          <div className="max-h-[440px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังโหลดการแจ้งเตือน...
              </div>
            ) : isError && notifications.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p role="alert" className="text-sm font-semibold text-rose-600">
                  โหลดการแจ้งเตือนไม่สำเร็จ
                </p>
                <button
                  type="button"
                  onClick={retry}
                  className="mt-3 cursor-pointer text-xs font-semibold text-emerald-700 hover:text-emerald-800"
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
                  การแจ้งเตือนของบัญชีนี้จะแสดงที่นี่
                </p>
              </div>
            ) : (
              <>
                {notifications.map((notification) => (
                  <ServerNotificationItem
                    key={notification.id}
                    notification={notification}
                    now={now}
                    onClick={() => handleNotificationClick(notification)}
                  />
                ))}
                {hasNextPage && (
                  <button
                    type="button"
                    onClick={fetchNextPage}
                    disabled={isFetchingNextPage}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 px-4 py-3 text-xs font-semibold text-emerald-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isFetchingNextPage && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {isFetchingNextPage ? "กำลังโหลด..." : "โหลดเพิ่ม"}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[10px] text-slate-400">
            <span>แสดง {notifications.length} รายการ</span>
            <span>
              {streamStatus === "CONNECTED"
                ? "รับการแจ้งเตือนแบบเรียลไทม์"
                : "กำลังเชื่อมต่อ..."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ServerNotificationItem({
  notification,
  now,
  onClick,
}: {
  notification: ServerNotification;
  now: number;
  onClick: () => void;
}) {
  const Icon = notificationIcons[notification.type] ?? Bell;
  const iconStyle = notificationStyles[notification.type] ?? "bg-slate-50 text-slate-600";
  const tone = notificationTone(notification.type);
  const isRead = Boolean(notification.readAt);
  const toneLabel = toneLabels[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3.5 text-left transition hover:bg-slate-100/70 ${
        isRead ? toneRowStyles[tone].read : toneRowStyles[tone].unread
      }`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconStyle} ${isRead ? "opacity-60" : ""}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span
            className={`text-xs leading-5 ${isRead ? "font-medium text-slate-500" : "font-bold text-slate-900"}`}
          >
            {toneLabel && (
              <span
                className={`mr-1.5 inline-block rounded px-1.5 py-px text-[10px] font-bold ${toneLabel.className}`}
              >
                {toneLabel.text}
              </span>
            )}
            {notification.title}
          </span>
          {!isRead && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500">
              <span className="sr-only">ยังไม่อ่าน</span>
            </span>
          )}
        </span>
        <span
          className={`mt-0.5 block text-[11px] leading-5 ${isRead ? "text-slate-400" : "text-slate-600"}`}
        >
          {notification.message}
        </span>
        <span className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-400">
          <span>{isRead ? "อ่านแล้ว" : "ยังไม่อ่าน"}</span>
          <time dateTime={notification.createdAt}>
            {formatNotificationRelativeTime(notification.createdAt, now)}
          </time>
        </span>
      </span>
    </button>
  );
}
