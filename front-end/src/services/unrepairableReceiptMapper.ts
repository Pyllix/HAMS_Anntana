import type { UnrepairableJobDto, UnrepairableReceipt } from "../Types/TypeUnrepairableReceipt";

// Step 5 is physical handover by the mechanic in the backend UNREPAIRABLE track.
// Status alone is insufficient: diagnosis already sets UNREPAIRABLE at step 4.
export function mapUnrepairableReceipt(job: UnrepairableJobDto): UnrepairableReceipt | null {
  const handover = job.repairJobSteps?.find(
    (step) => step.stepMaster.actionType === "UNREPAIRABLE" && step.stepMaster.stepNumber === 5,
  );
  if (job.jobStatus?.code !== "UNREPAIRABLE" || !handover?.completeAt || !job.asset) return null;
  const sender = [handover.user?.firstname, handover.user?.lastname].filter(Boolean).join(" ");
  return {
    id: job.id,
    jobNo: job.jobNo,
    assetCode: job.asset.noid || "ไม่ระบุรหัส",
    assetName: job.asset.name || "ไม่ระบุชื่อครุภัณฑ์",
    model: job.asset.model || "—",
    serialNo: job.asset.serialNo || "—",
    imageUrl: job.asset.imageUrl || null,
    category: job.asset.type?.name || "ไม่ระบุหมวดหมู่",
    sender: sender || "ไม่ระบุผู้ส่งคืน",
    technicianCategory: job.techCategory?.name || "—",
    sentAt: handover.completeAt,
    reason: job.unrepairableReason || "ไม่ได้ระบุเหตุผลในระบบ",
    diagnosis: job.diagnosis || "—",
    handoverNote: handover.note || "—",
  };
}

export function receiptDate(value: string, time = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", time
    ? { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }
    : { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Bangkok" }).format(date);
}
