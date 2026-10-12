import { useEffect } from "react";
import {
  ClipboardList,
  FileCheck2,
  Package,
  Printer,
  X,
} from "lucide-react";
import type { MaintenanceDocumentType } from "../../types/TypeMaintenanceReport";
import type { RepairJob } from "../../types/TypeRepairWorkflow";
import { hasRequestedSpareParts } from "../../services/maintenanceReportPrintService";

interface MaintenancePrintDialogProps {
  job: RepairJob | null;
  onClose: () => void;
  onPrint: (
    type: Exclude<MaintenanceDocumentType, "PERIOD_REPORT">,
    job: RepairJob,
  ) => void;
}

const documentOptions = [
  {
    type: "WORK_ORDER" as const,
    title: "ใบงานซ่อมครุภัณฑ์",
    description:
      "ข้อมูลใบงาน อาการที่แจ้ง ผลประเมิน และพื้นที่ลงนามของผู้เกี่ยวข้อง",
    icon: ClipboardList,
    color: "bg-blue-50 text-blue-600",
  },
  {
    type: "PARTS_REQUEST" as const,
    title: "ใบขอเบิกอะไหล่",
    description:
      "รายการอะไหล่ จำนวน แหล่งจัดหา ราคา และพื้นที่อนุมัติการเบิก",
    icon: Package,
    color: "bg-amber-50 text-amber-600",
  },
  {
    type: "REPAIR_SUMMARY" as const,
    title: "ใบสรุปผลการซ่อม",
    description:
      "สรุปผลดำเนินงาน อะไหล่ ค่าใช้จ่าย การส่งมอบ และการรับประกัน",
    icon: FileCheck2,
    color: "bg-emerald-50 text-emerald-600",
  },
];

export default function MaintenancePrintDialog({
  job,
  onClose,
  onPrint,
}: MaintenancePrintDialogProps) {
  useEffect(() => {
    if (!job) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [job, onClose]);

  if (!job) return null;
  const hasParts = hasRequestedSpareParts(job);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Printer className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                เลือกเอกสารที่ต้องการพิมพ์
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {job.jobNo} · {job.asset?.assetName || "ไม่ระบุครุภัณฑ์"}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="ปิดหน้าต่าง"
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-3 bg-slate-50/60 p-6">
          {documentOptions.map((option) => {
            const disabled = option.type === "PARTS_REQUEST" && !hasParts;
            const Icon = option.icon;
            return (
              <button
                key={option.type}
                type="button"
                disabled={disabled}
                onClick={() => onPrint(option.type, job)}
                className="group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-emerald-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-slate-200 disabled:hover:shadow-2xs"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${option.color}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm text-slate-900">
                    {option.title}
                  </strong>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {disabled
                      ? "ใบงานนี้ยังไม่มีรายการอะไหล่ จึงยังไม่สามารถพิมพ์ใบเบิกได้"
                      : option.description}
                  </span>
                </span>
                <span className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition group-hover:border-emerald-200 group-hover:bg-emerald-50 group-hover:text-emerald-700 group-disabled:border-slate-200 group-disabled:bg-white group-disabled:text-slate-400">
                  พิมพ์
                </span>
              </button>
            );
          })}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-[11px] text-slate-400">
            ระบบจะเปิดตัวอย่างเอกสารในหน้าต่างใหม่ก่อนสั่งพิมพ์
          </p>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            ปิด
          </button>
        </footer>
      </div>
    </div>
  );
}
