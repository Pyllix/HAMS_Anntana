import { getNextWorkflowStage } from "../config/repairWorkflow";
import type { RoleType } from "../Router/roles";
import {
  RepairJob,
  RepairWorkflowActor,
  RepairWorkflowStage,
} from "../Types/TypeRepairWorkflow";
import { useNotificationStore } from "../stores/useNotificationStore";
import { NotificationKind } from "../Types/TypeNotification";

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
