import { create } from "zustand";
import {
  AppNotification,
  CreateNotificationInput,
} from "../Types/TypeNotification";

const initialNotifications: AppNotification[] = [
  {
    id: "notification-maintenance-001",
    kind: "PARCEL",
    title: "พัสดุจ่ายอะไหล่เรียบร้อยแล้ว",
    message: "อะไหล่สำหรับเครื่องให้สารละลายพร้อมให้ช่างรับไปดำเนินการซ่อม",
    jobNo: "JOB-2026-047",
    recipientRole: "MAINTENANCE_STAFF",
    sourceRole: "PARCEL_STAFF",
    isRead: false,
    createdAt: "2026-09-01T07:40:00.000Z",
  },
  {
    id: "notification-maintenance-002",
    kind: "PARCEL",
    title: "รับเครื่องกลับจากบริษัทแล้ว",
    message:
      "เครื่องถ่ายเอกสารถูกส่งกลับและผ่านการตรวจรับเบื้องต้น รอช่างทดสอบ",
    jobNo: "JOB-2026-044",
    recipientRole: "MAINTENANCE_STAFF",
    sourceRole: "PARCEL_STAFF",
    isRead: false,
    createdAt: "2026-09-01T06:15:00.000Z",
  },
  {
    id: "notification-maintenance-003",
    kind: "APPROVAL",
    title: "อนุมัติจัดซื้ออะไหล่แล้ว",
    message: "คำขอจัดซื้อชุดซ่อมได้รับอนุมัติและอยู่ระหว่างรอผู้ขายจัดส่ง",
    jobNo: "JOB-2026-050",
    recipientRole: "MAINTENANCE_STAFF",
    sourceRole: "MANAGER",
    isRead: true,
    createdAt: "2026-08-31T09:20:00.000Z",
  },
  {
    id: "notification-parcel-001",
    kind: "WORKFLOW",
    title: "มีคำขอเบิกอะไหล่ใหม่",
    message: "ช่างส่งคำขอเบิกอะไหล่ในคลัง กรุณาตรวจสอบและดำเนินการ",
    jobNo: "JOB-2026-047",
    recipientRole: "PARCEL_STAFF",
    sourceRole: "MAINTENANCE_STAFF",
    isRead: false,
    createdAt: "2026-09-01T05:30:00.000Z",
  },
];

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (notification: CreateNotificationInput) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: (recipientRole: AppNotification["recipientRole"]) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: initialNotifications,
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          isRead: false,
          createdAt: notification.createdAt || new Date().toISOString(),
        },
        ...state.notifications,
      ],
    })),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.id === id
          ? { ...notification, isRead: true }
          : notification,
      ),
    })),
  markAllAsRead: (recipientRole) =>
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.recipientRole === recipientRole ||
        recipientRole === "ADMIN"
          ? { ...notification, isRead: true }
          : notification,
      ),
    })),
}));
