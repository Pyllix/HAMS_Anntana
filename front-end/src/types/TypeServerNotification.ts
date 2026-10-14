export type ServerNotificationType =
  | "BORROW_APPROVAL_REQUIRED"
  | "BORROW_APPROVED"
  | "REPAIR_APPROVAL_REQUIRED"
  | "REPAIR_READY_FOR_COLLECTION"
  | "BORROW_EXTENSION_APPROVAL_REQUIRED"
  | "BORROW_EXTENSION_APPROVED"
  | "BORROW_EXTENSION_REJECTED"
  | "BORROW_DUE_SOON"
  | "BORROW_OVERDUE";

export type NotificationResourceType =
  | "BORROW_TRANSACTION"
  | "BORROW_EXTENSION"
  | "REPAIR_JOB";

export interface ServerNotification {
  id: string;
  type: ServerNotificationType;
  title: string;
  message: string;
  resourceType: NotificationResourceType;
  resourceId: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ServerNotificationPage {
  data: ServerNotification[];
  meta: NotificationPageMeta;
}

export interface NotificationUnreadCount {
  count: number;
}

export interface NotificationReadAllResult {
  updatedCount: number;
  readAt: string | null;
}

