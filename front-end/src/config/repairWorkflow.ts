import {
  RepairActionType,
  RepairJob,
  RepairWorkflowActor,
  RepairWorkflowStage,
} from "../Types/TypeRepairWorkflow";

export const workflowActorLabels: Record<RepairWorkflowActor, string> = {
  MAINTENANCE: "ช่างผู้รับผิดชอบ",
  SUPERVISOR: "ผู้บริหาร",
  PARCEL: "เจ้าหน้าที่พัสดุ",
  DEPARTMENT: "หน่วยงานเจ้าของครุภัณฑ์",
};

export const repairWorkflowByAction: Record<
  RepairActionType,
  RepairWorkflowStage[]
> = {
  SELF_REPAIR: [
    {
      stepNumber: 4,
      stepLabel: "ดำเนินการซ่อมและทดสอบการใช้งาน",
      actionLabel: "บันทึกผลซ่อมและทดสอบ",
      description: "บันทึกว่าช่างดำเนินการซ่อมและทดสอบการทำงานเรียบร้อยแล้ว",
      actor: "MAINTENANCE",
      nextStatus: "IN_PROGRESS",
    },
    {
      stepNumber: 5,
      stepLabel: "แล้วเสร็จ / รอตรวจรับงาน",
      actionLabel: "แจ้งซ่อมเสร็จ",
      description: "แจ้งหน่วยงานเจ้าของครุภัณฑ์ให้มาตรวจรับและรับเครื่องคืน",
      actor: "MAINTENANCE",
      nextStatus: "WAITING_DELIVERY",
    },
  ],
  WITH_PARTS: [
    {
      stepNumber: 5,
      stepLabel: "เจ้าหน้าที่พัสดุอนุมัติการเบิกอะไหล่",
      actionLabel: "อนุมัติการเบิกอะไหล่",
      description: "ตรวจสอบรายการอะไหล่ทั้งในคลังและจัดหาภายนอกก่อนอนุมัติ",
      actor: "PARCEL",
      nextStatus: "PARCEL_PROCESSING",
    },
    {
      stepNumber: 6,
      stepLabel: "ช่างรับอะไหล่และเริ่มดำเนินการซ่อม",
      actionLabel: "ยืนยันรับอะไหล่",
      description: "ยืนยันว่าช่างได้รับอะไหล่ครบถ้วนและเริ่มดำเนินการซ่อม",
      actor: "MAINTENANCE",
      nextStatus: "IN_PROGRESS",
    },
    {
      stepNumber: 7,
      stepLabel: "แล้วเสร็จ / รอตรวจรับงาน",
      actionLabel: "แจ้งซ่อมเสร็จ",
      description: "แจ้งหน่วยงานเจ้าของครุภัณฑ์ให้มาตรวจรับและรับเครื่องคืน",
      actor: "MAINTENANCE",
      nextStatus: "WAITING_DELIVERY",
    },
  ],
  INTERNAL_STOCK: [
    {
      stepNumber: 5,
      stepLabel: "อนุมัติจัดหาอะไหล่ในคลัง",
      actionLabel: "อนุมัติเบิกอะไหล่",
      description: "ตรวจสอบและอนุมัติใบขอเบิกอะไหล่ที่มีอยู่ในคลัง",
      actor: "PARCEL",
      nextStatus: "PARCEL_PROCESSING",
    },
    {
      stepNumber: 6,
      stepLabel: "พัสดุจ่ายอะไหล่ในคลัง",
      actionLabel: "บันทึกจ่ายอะไหล่",
      description: "บันทึกการจ่ายและตัดสต็อกอะไหล่ก่อนส่งมอบให้ช่าง",
      actor: "PARCEL",
      nextStatus: "IN_PROGRESS",
    },
    {
      stepNumber: 7,
      stepLabel: "ช่างรับวัสดุ / ดำเนินการซ่อม",
      actionLabel: "บันทึกซ่อมและทดสอบ",
      description: "ยืนยันว่าช่างรับอะไหล่ ประกอบ และทดสอบเครื่องเรียบร้อย",
      actor: "MAINTENANCE",
      nextStatus: "IN_PROGRESS",
    },
    {
      stepNumber: 8,
      stepLabel: "แล้วเสร็จ / รอตรวจรับงาน",
      actionLabel: "แจ้งซ่อมเสร็จ",
      description: "แจ้งหน่วยงานเจ้าของครุภัณฑ์ให้มาตรวจรับและรับเครื่องคืน",
      actor: "MAINTENANCE",
      nextStatus: "WAITING_DELIVERY",
    },
  ],
  EXTERNAL_STOCK: [
    {
      stepNumber: 5,
      stepLabel: "อนุมัติจัดหาอะไหล่นอกคลัง",
      actionLabel: "อนุมัติจัดซื้ออะไหล่",
      description:
        "อนุมัติคำขอจัดซื้อและเปลี่ยนสถานะเป็นกำลังรออะไหล่จากผู้ขาย",
      actor: "PARCEL",
      nextStatus: "WAITING_PARTS",
    },
    {
      stepNumber: 6,
      stepLabel: "พัสดุแจ้งรับอะไหล่",
      actionLabel: "บันทึกรับอะไหล่",
      description: "บันทึกว่าอะไหล่มาถึงและผ่านการตรวจรับเบื้องต้นแล้ว",
      actor: "PARCEL",
      nextStatus: "PARCEL_PROCESSING",
    },
    {
      stepNumber: 7,
      stepLabel: "ช่างรับอะไหล่ / ดำเนินการซ่อม",
      actionLabel: "บันทึกซ่อมและทดสอบ",
      description: "ยืนยันว่าช่างรับอะไหล่และดำเนินการซ่อมเรียบร้อย",
      actor: "MAINTENANCE",
      nextStatus: "IN_PROGRESS",
    },
    {
      stepNumber: 8,
      stepLabel: "แล้วเสร็จ / รอตรวจรับงาน",
      actionLabel: "แจ้งซ่อมเสร็จ",
      description: "แจ้งหน่วยงานเจ้าของครุภัณฑ์ให้มาตรวจรับและรับเครื่องคืน",
      actor: "MAINTENANCE",
      nextStatus: "WAITING_DELIVERY",
    },
  ],
  OUTSOURCE: [
    {
      stepNumber: 5,
      stepLabel: "อนุมัติส่งซ่อมบริษัทภายนอก",
      actionLabel: "อนุมัติส่งซ่อมภายนอก",
      description: "อนุมัติให้นำครุภัณฑ์ออกไปซ่อมกับบริษัทหรือตัวแทนจำหน่าย",
      actor: "PARCEL",
      nextStatus: "OUTSOURCED",
    },
    {
      stepNumber: 6,
      stepLabel: "รับเครื่องคืนจากบริษัทและทดสอบ",
      actionLabel: "ยืนยันรับเครื่องและทดสอบ",
      description:
        "ช่างผู้รับผิดชอบยืนยันว่าได้รับเครื่องกลับจากบริษัทและตรวจทดสอบการทำงานแล้ว",
      actor: "MAINTENANCE",
      nextStatus: "IN_PROGRESS",
    },
    {
      stepNumber: 7,
      stepLabel: "แล้วเสร็จ / รอตรวจรับงาน",
      actionLabel: "แจ้งซ่อมเสร็จ",
      description: "แจ้งหน่วยงานเจ้าของครุภัณฑ์ว่าเครื่องพร้อมตรวจรับและรับคืน",
      actor: "MAINTENANCE",
      nextStatus: "WAITING_DELIVERY",
    },
  ],
  UNREPAIRABLE: [
    {
      stepNumber: 5,
      stepLabel: "ช่างนำส่งครุภัณฑ์ให้พัสดุ",
      actionLabel: "ยืนยันส่งคืนให้พัสดุ",
      description:
        "ยืนยันหลังนำครุภัณฑ์ที่ไม่สามารถซ่อมได้ส่งถึงห้องพัสดุจริงแล้ว",
      actor: "MAINTENANCE",
      nextStatus: "UNREPAIRABLE",
    },
  ],
};

export function getNextWorkflowStage(
  job: RepairJob,
): RepairWorkflowStage | null {
  if (
    !job.actionType ||
    job.status?.statusCode === "WAITING_DELIVERY" ||
    job.status?.statusCode === "COMPLETED" ||
    job.status?.statusCode === "CANCELLED"
  ) {
    return null;
  }

  const completedStep =
    job.workflowStep ?? (job.actionType === "SELF_REPAIR" ? 3 : 4);
  return (
    repairWorkflowByAction[job.actionType].find(
      (stage) => stage.stepNumber > completedStep,
    ) || null
  );
}

export function getWorkflowProgress(job: RepairJob): {
  completed: number;
  total: number;
} {
  if (!job.actionType) return { completed: 0, total: 0 };
  const lastStep = job.actionType === "SELF_REPAIR" ? 6 : 8;
  return {
    completed: Math.min(job.workflowStep ?? 1, lastStep),
    total: lastStep,
  };
}
