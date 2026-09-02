import type { RoleType } from "../Router/roles";

export type NotificationKind = "WORKFLOW" | "APPROVAL" | "PARCEL" | "DELIVERY";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  jobNo?: string;
  recipientRole: RoleType;
  sourceRole?: RoleType;
  isRead: boolean;
  createdAt: string;
}

export type CreateNotificationInput = Omit<
  AppNotification,
  "id" | "isRead" | "createdAt"
> & {
  createdAt?: string;
};
