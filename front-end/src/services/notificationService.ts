import { getNextWorkflowStage } from "../config/repairWorkflow";
import type { RoleType } from "../router/roles";
import {
  RepairJob,
  RepairWorkflowActor,
  RepairWorkflowStage,
} from "../types/TypeRepairWorkflow";
import { useNotificationStore } from "../stores/useNotificationStore";
import { NotificationKind } from "../types/TypeNotification";

const roleByActor: Record<RepairWorkflowActor, RoleType> = {
  MAINTENANCE: "MAINTENANCE_STAFF",
  SUPERVISOR: "MANAGER",
  PARCEL: "PARCEL_STAFF",
  DEPARTMENT: "DEPARTMENT_STAFF",
};

export function publishWorkflowNotification(
  job: RepairJob,
  completedStage: RepairWorkflowStage,
): void {
  const nextStage = getNextWorkflowStage(job);
  const recipientRole =
    job.status?.statusCode === "WAITING_DELIVERY"
      ? "DEPARTMENT_STAFF"
      : nextStage
        ? roleByActor[nextStage.actor]
        : "MAINTENANCE_STAFF";

  useNotificationStore.getState().addNotification({
    kind: notificationKind(completedStage),
    title: notificationTitle(completedStage, nextStage),
    message: nextStage
      ? `${job.asset?.assetName || "ครุภัณฑ์"} ดำเนินการขั้นตอน “${completedStage.stepLabel}” แล้ว ขั้นตอนถัดไปคือ “${nextStage.stepLabel}”`
      : `${job.asset?.assetName || "ครุภัณฑ์"} ดำเนินการขั้นตอน “${completedStage.stepLabel}” เรียบร้อยแล้ว`,
    jobNo: job.jobNo,
    recipientRole,
    sourceRole: roleByActor[completedStage.actor],
  });
}

export function publishSpareApprovalNotificationOnce(job: RepairJob): void {
  if (job.actionType !== "WITH_PARTS" || (job.workflowStep || 0) < 5) return;
  const title = "เจ้าหน้าที่พัสดุอนุมัติการเบิกอะไหล่แล้ว";
  const store = useNotificationStore.getState();
  if (
    store.notifications.some(
      (notification) =>
        notification.jobNo === job.jobNo && notification.title === title,
    )
  ) {
    return;
  }
  store.addNotification({
    kind: "PARCEL",
    title,
    message: `${job.asset?.assetName || "ครุภัณฑ์"} ได้รับอนุมัติการเบิกอะไหล่แล้ว กรุณาตรวจสอบและดำเนินการขั้นตอนถัดไป`,
    jobNo: job.jobNo,
    recipientRole: "MAINTENANCE_STAFF",
    sourceRole: "PARCEL_STAFF",
    createdAt: job.updatedAt || new Date().toISOString(),
  });
}

export function publishOutsourceApprovalNotificationOnce(job: RepairJob): void {
  if (job.actionType !== "OUTSOURCE" || job.status?.statusCode !== "OUTSOURCED") return;
  const title = "เจ้าหน้าที่พัสดุอนุมัติส่งซ่อมภายนอกแล้ว";
  const store = useNotificationStore.getState();
  if (
    store.notifications.some(
      (notification) =>
        notification.jobNo === job.jobNo && notification.title === title,
    )
  ) {
    return;
  }
  store.addNotification({
    kind: "PARCEL",
    title,
    message: `${job.asset?.assetName || "ครุภัณฑ์"} ได้รับอนุมัติให้ส่งซ่อมกับบริษัทภายนอกแล้ว กรุณาติดตามและดำเนินการขั้นตอนถัดไป`,
    jobNo: job.jobNo,
    recipientRole: "MAINTENANCE_STAFF",
    sourceRole: "PARCEL_STAFF",
    createdAt: job.updatedAt || new Date().toISOString(),
  });
}

function notificationKind(stage: RepairWorkflowStage): NotificationKind {
  if (stage.actor === "PARCEL") return "PARCEL";
  if (stage.actor === "SUPERVISOR") return "APPROVAL";
  if (stage.nextStatus === "WAITING_DELIVERY") return "DELIVERY";
  return "WORKFLOW";
}

function notificationTitle(
  completedStage: RepairWorkflowStage,
  nextStage: RepairWorkflowStage | null,
): string {
  if (completedStage.actor === "PARCEL" && nextStage?.actor === "MAINTENANCE") {
    return "พัสดุดำเนินการเรียบร้อยแล้ว";
  }
  if (completedStage.actor === "SUPERVISOR" && nextStage?.actor === "PARCEL") {
    return "รายการได้รับการอนุมัติแล้ว";
  }
  if (completedStage.nextStatus === "WAITING_DELIVERY") {
    return "ครุภัณฑ์พร้อมตรวจรับ";
  }
  return "มีการอัปเดตงานซ่อม";
}
