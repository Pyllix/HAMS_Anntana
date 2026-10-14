import type { ServerNotification } from "../types/TypeServerNotification";

export const NOTIFICATION_RESOURCE_TYPE_PARAM = "notificationResourceType";
export const NOTIFICATION_RESOURCE_ID_PARAM = "notificationResourceId";
// ใช้เลือกแท็บปลายทางเท่านั้น (เช่น คำขอยืมรออนุมัติ กับ เกินกำหนดคืน ใช้ resourceType เดียวกัน)
export const NOTIFICATION_TYPE_PARAM = "notificationType";

export type NotificationTone = "danger" | "warning" | "action" | "default";

type NotificationTargetInput = Pick<ServerNotification, "resourceType" | "resourceId"> &
  Partial<Pick<ServerNotification, "type">>;

export type NotificationTargetResolver = (
  notification: NotificationTargetInput,
) => string | null;

// ค่าที่มาจาก backend อาจเป็น resourceType ใหม่ที่ FE ยังไม่รู้จัก จึงรับเป็น string แล้วตรวจเอง
function buildTarget(
  routes: Readonly<Record<string, string>>,
  { resourceType, resourceId, type: notificationType }: NotificationTargetInput,
): string | null {
  const type = String(resourceType ?? "");
  if (!Object.hasOwn(routes, type) || typeof resourceId !== "string" || !resourceId) {
    return null;
  }
  const params = new URLSearchParams({
    [NOTIFICATION_RESOURCE_TYPE_PARAM]: type,
    [NOTIFICATION_RESOURCE_ID_PARAM]: resourceId,
  });
  if (typeof notificationType === "string" && notificationType) {
    params.set(NOTIFICATION_TYPE_PARAM, notificationType);
  }
  return `${routes[type]}?${params.toString()}`;
}

const DEPARTMENT_ROUTES: Readonly<Record<string, string>> = {
  BORROW_TRANSACTION: "/borrow-request",
  BORROW_EXTENSION: "/borrow-request",
  REPAIR_JOB: "/track-status",
};

const PARCEL_ROUTES: Readonly<Record<string, string>> = {
  BORROW_TRANSACTION: "/borrow-request",
  BORROW_EXTENSION: "/borrow-request",
  REPAIR_JOB: "/parcel-repair-operations",
};

// เจ้าหน้าที่ศูนย์ไม่มีหน้า "การยืมของฉัน" แยก แจ้งเตือนฝั่งผู้ยืม (กรณียืมเอง) จึงเปิดรายละเอียดการยืมจากหน้าเดียวกัน
const ASSET_CENTER_ROUTES: Readonly<Record<string, string>> = {
  BORROW_TRANSACTION: "/borrow-return-assets_center",
  BORROW_EXTENSION: "/borrow-return-assets_center",
  REPAIR_JOB: "/track-status",
};

export const resolveDepartmentNotificationTarget: NotificationTargetResolver = (
  notification,
) => buildTarget(DEPARTMENT_ROUTES, notification);

export const resolveParcelNotificationTarget: NotificationTargetResolver = (
  notification,
) => buildTarget(PARCEL_ROUTES, notification);

export const resolveAssetCenterNotificationTarget: NotificationTargetResolver = (
  notification,
) => buildTarget(ASSET_CENTER_ROUTES, notification);

// แจ้งเตือนที่ผู้รับต้องลงมือทำ (รออนุมัติ / รอพิจารณา)
export function isActionRequiredNotification(type: string): boolean {
  return type.endsWith("_APPROVAL_REQUIRED");
}

export function notificationTone(type: string): NotificationTone {
  if (type === "BORROW_OVERDUE") return "danger";
  if (type === "BORROW_DUE_SOON") return "warning";
  if (isActionRequiredNotification(type)) return "action";
  return "default";
}

export type AssetCenterBorrowTab = "approve" | "extension";

// แท็บของหน้ายืม-คืนศูนย์ที่ควรเปิดตามแจ้งเตือน (null = คงแท็บเดิม แสดงแค่รายละเอียด)
export function assetCenterTabForNotification(
  type: string | null | undefined,
): AssetCenterBorrowTab | null {
  if (type === "BORROW_APPROVAL_REQUIRED") return "approve";
  if (type === "BORROW_EXTENSION_APPROVAL_REQUIRED") return "extension";
  return null;
}

// สถานะที่แจ้งเตือนแบบ "ต้องดำเนินการ" คาดว่า resource ยังรออยู่
const ACTION_PENDING_STATUS: Readonly<Record<string, string>> = {
  BORROW_APPROVAL_REQUIRED: "PENDING_APPROVE",
  BORROW_EXTENSION_APPROVAL_REQUIRED: "PENDING",
};

// true เมื่อแจ้งเตือนเป็นงานที่ต้องพิจารณา แต่สถานะล่าสุดจาก backend ไม่ได้รอแล้ว (เช่น คนอื่นในศูนย์อนุมัติไปแล้ว)
export function isActionAlreadyHandled(
  notificationType: string | null | undefined,
  latestStatusCode: string | null | undefined,
): boolean {
  const type = String(notificationType ?? "");
  if (!Object.hasOwn(ACTION_PENDING_STATUS, type) || !latestStatusCode) return false;
  return latestStatusCode !== ACTION_PENDING_STATUS[type];
}

// query root ของรายการที่เกี่ยวกับ resource นั้น ใช้ refresh หน้าที่เปิดอยู่เมื่อมีแจ้งเตือนใหม่
const RELATED_QUERY_ROOTS: Readonly<Record<string, readonly string[]>> = {
  BORROW_TRANSACTION: ["borrowHistory"],
  BORROW_EXTENSION: ["borrowExtensions", "borrowHistory"],
  REPAIR_JOB: ["repairsHistory"],
};

export function relatedQueryRoots(resourceType: unknown): readonly string[] {
  const type = String(resourceType ?? "");
  return Object.hasOwn(RELATED_QUERY_ROOTS, type) ? RELATED_QUERY_ROOTS[type] : [];
}

export function readNotificationResourceParams(
  searchParams: URLSearchParams,
): { resourceType: string; resourceId: string } | null {
  const resourceType = searchParams.get(NOTIFICATION_RESOURCE_TYPE_PARAM);
  const resourceId = searchParams.get(NOTIFICATION_RESOURCE_ID_PARAM);
  return resourceType && resourceId ? { resourceType, resourceId } : null;
}

export function readNotificationTypeParam(searchParams: URLSearchParams): string | null {
  return searchParams.get(NOTIFICATION_TYPE_PARAM) || null;
}

export function formatNotificationRelativeTime(
  createdAt: string,
  now: number = Date.now(),
): string {
  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) return "-";
  const diffMinutes = Math.max(0, Math.floor((now - createdTime) / 60_000));
  if (diffMinutes < 1) return "เมื่อสักครู่";
  if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).format(new Date(createdTime));
}
