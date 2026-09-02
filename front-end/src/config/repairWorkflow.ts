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
      stepLabel: "พัสดุรับเครื่องกลับจากบริษัท",
      actionLabel: "บันทึกรับเครื่องกลับ",
      description: "บันทึกการรับเครื่องคืนจากบริษัทและการตรวจรับเบื้องต้น",
      actor: "PARCEL",
      nextStatus: "PARCEL_PROCESSING",
    },
    {
      stepNumber: 7,
      stepLabel: "ช่างรับเครื่องและทดสอบ",
      actionLabel: "บันทึกผลทดสอบเครื่อง",
      description: "บันทึกผล Test Run, QC หรือการสอบเทียบโดยช่างโรงพยาบาล",
      actor: "MAINTENANCE",
      nextStatus: "IN_PROGRESS",
    },
    {
      stepNumber: 8,
      stepLabel: "แล้วเสร็จ / รอตรวจรับงาน",
      actionLabel: "แจ้งพร้อมส่งมอบ",
      description: "แจ้งหน่วยงานเจ้าของครุภัณฑ์ว่าเครื่องพร้อมรับคืน",
      actor: "MAINTENANCE",
      nextStatus: "WAITING_DELIVERY",
    },
  ],
  PURCHASE_REPLACEMENT: [
    {
      stepNumber: 5,
      stepLabel: "พัสดุตรวจสอบและเสนอความเห็น",
      actionLabel: "บันทึกผลตรวจสอบ",
      description:
        "พัสดุตรวจสอบรายละเอียดแทงชำรุดและเสนอความเห็นก่อนส่งผู้บริหาร",
      actor: "PARCEL",
      nextStatus: "PARCEL_PROCESSING",
    },
    {
      stepNumber: 6,
      stepLabel: "ผู้บริหารอนุมัติการจัดซื้อเครื่องทดแทน",
      actionLabel: "อนุมัติซื้อทดแทน",
      description: "ผู้บริหารพิจารณาและอนุมัติการจัดซื้อเครื่องใหม่ทดแทน",
      actor: "SUPERVISOR",
      nextStatus: "PARCEL_PROCESSING",
    },
    {
      stepNumber: 7,
      stepLabel: "พัสดุรับเครื่องใหม่เข้าคลัง",
      actionLabel: "บันทึกรับเครื่องใหม่",
      description: "บันทึกการตรวจรับและขึ้นทะเบียนเครื่องทดแทนเข้าระบบ",
      actor: "PARCEL",
      nextStatus: "PARCEL_PROCESSING",
    },
    {
      stepNumber: 8,
      stepLabel: "ช่างรับเครื่องใหม่และเตรียมส่งมอบ",
      actionLabel: "ตั้งค่าและทดสอบเครื่องใหม่",
      description: "บันทึกผลการตั้งค่า ทดสอบ และเตรียมครุภัณฑ์ใหม่ก่อนส่งมอบ",
      actor: "MAINTENANCE",
      nextStatus: "IN_PROGRESS",
    },
    {
      stepNumber: 9,
      stepLabel: "แล้วเสร็จ / รอตรวจรับงาน",
      actionLabel: "แจ้งพร้อมส่งมอบ",
      description: "แจ้งหน่วยงานเจ้าของครุภัณฑ์ให้ตรวจรับเครื่องทดแทน",
      actor: "MAINTENANCE",
      nextStatus: "WAITING_DELIVERY",
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
  const lastStep =
    job.actionType === "SELF_REPAIR"
      ? 6
      : job.actionType === "PURCHASE_REPLACEMENT"
        ? 10
        : 9;
  return {
    completed: Math.min(job.workflowStep ?? 1, lastStep),
    total: lastStep,
  };
}
