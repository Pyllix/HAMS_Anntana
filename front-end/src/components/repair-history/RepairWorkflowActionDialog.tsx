import { useEffect } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { workflowActorLabels } from "../../config/repairWorkflow";
import { RepairJob, RepairWorkflowStage } from "../../Types/TypeRepairWorkflow";

interface RepairWorkflowActionDialogProps {
  job: RepairJob | null;
  stage: RepairWorkflowStage | null;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function RepairWorkflowActionDialog({
  job,
  stage,
  isLoading,
  error,
  onClose,
  onConfirm,
}: RepairWorkflowActionDialogProps) {
  useEffect(() => {
    if (!job || !stage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [job, stage, isLoading, onClose]);

  if (!job || !stage) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-xs sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]">
        <header className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                ยืนยันการอัปเดตขั้นตอน
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                ตรวจสอบข้อมูลก่อนเปลี่ยนสถานะของงานซ่อม
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="ปิดหน้าต่าง"
            disabled={isLoading}
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-wait"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="font-mono text-xs font-bold text-emerald-600">
              {job.jobNo}
            </p>
            <h3 className="mt-1 font-bold text-slate-900">
              {job.asset?.assetName || "ไม่ระบุครุภัณฑ์"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {job.symptom}
            </p>
          </section>

          <section>
            <p className="text-xs font-semibold text-slate-500">
              ขั้นตอนที่จะบันทึก
            </p>
            <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  {stage.stepNumber}
                </span>
                <div>
                  <h3 className="font-bold text-emerald-950">
                    {stage.stepLabel}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    {stage.description}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <UserRound className="h-4 w-4" /> ผู้รับผิดชอบขั้นตอน
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {workflowActorLabels[stage.actor]}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5">
              <p className="text-xs text-slate-500">สถานะหลังดำเนินการ</p>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span>{job.status?.statusName || "สถานะปัจจุบัน"}</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
                <span className="text-emerald-700">
                  {statusLabel(stage.nextStatus)}
                </span>
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                ตรวจสอบก่อนยืนยัน
              </h3>
            </div>
            <div className="mt-3 grid gap-2.5 text-xs leading-5 text-slate-600 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="block font-semibold text-slate-800">
                  งานที่ดำเนินการ
                </span>
                {stage.stepLabel}
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="block font-semibold text-slate-800">
                  ผู้รับผิดชอบ
                </span>
                {workflowActorLabels[stage.actor]}
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="block font-semibold text-slate-800">
                  การบันทึกประวัติ
                </span>
                ขั้นตอนที่ {stage.stepNumber} พร้อมวันและเวลาที่ดำเนินการ
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ระบบตัวอย่างจะอัปเดต Mock Data และแสดงงานถัดไปทันที
            ข้อมูลจะกลับเป็นค่าเริ่มต้นเมื่อรีเฟรชหน้า
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="h-10 cursor-pointer rounded-lg bg-slate-100 px-5 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:cursor-wait"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="h-10 cursor-pointer rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            {isLoading ? "กำลังอัปเดต..." : stage.actionLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

function statusLabel(status: RepairWorkflowStage["nextStatus"]): string {
  const labels: Record<RepairWorkflowStage["nextStatus"], string> = {
    WAITING_HANDOVER: "รอรับเครื่องจากหน่วยงาน",
    PENDING_ASSIGN: "รอมอบหมายงาน",
    IN_PROGRESS: "กำลังดำเนินการ",
    WAITING_PARTS: "สั่งซื้อ / รออะไหล่",
    PARCEL_PROCESSING: "พัสดุกำลังดำเนินการ",
    OUTSOURCED: "ส่งซ่อมบริษัทภายนอก",
    UNREPAIRABLE: "ชำรุด / เสนอซื้อทดแทน",
    WAITING_DELIVERY: "เสร็จแล้วรอรับคืน",
    COMPLETED: "ส่งคืน / ปิดงานแล้ว",
    CANCELLED: "ยกเลิกงานซ่อม",
  };
  return labels[status];
}
