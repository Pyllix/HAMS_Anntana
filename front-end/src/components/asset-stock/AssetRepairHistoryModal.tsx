import { useMemo } from "react";
import { Undo2, Banknote, Clock, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAssetRepairHistoryModalStore } from "../../stores/useAssetRepairHistoryModalStore";
import {
  fetchRepairJobSummaries,
  fetchDetailedRepairJobs,
  ApiRepairJob,
} from "../../services/repairApiService";

const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function formatThaiDate(dateString?: string | null): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = THAI_MONTHS[d.getMonth()];
    const year = d.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  } catch {
    return "-";
  }
}

function calculateJobCost(job: ApiRepairJob): number {
  // If backend returns a direct cost breakdown summary
  const costBreakdown = (
    job as {
      costBreakdown?: {
        totalCost?: number | string;
        partsCost?: number | string;
        outsourceCost?: number | string;
        repairCost?: number | string;
      };
    }
  ).costBreakdown;

  if (costBreakdown?.totalCost) {
    return Number(costBreakdown.totalCost) || 0;
  }

  let cost = 0;

  // 1. Cost from spare part transactions (withdrawals)
  if (job.sparepartTxns && job.sparepartTxns.length > 0) {
    for (const txn of job.sparepartTxns) {
      if (txn.txnType === "WITHDRAW") {
        const qty = Number(txn.qty) || 0;
        const price = Number(txn.unitPrice) || 0;
        cost += qty * price;
      }
    }
  }

  // 2. Cost from spareParts array (if returned directly)
  const spareParts = (
    job as {
      spareParts?: Array<{
        qty?: number | string;
        price?: number | string;
        unitPrice?: number | string;
        totalPrice?: number | string;
      }>;
    }
  ).spareParts;
  if (spareParts && spareParts.length > 0) {
    for (const p of spareParts) {
      if (p.totalPrice) {
        cost += Number(p.totalPrice) || 0;
      } else {
        const qty = Number(p.qty) || 0;
        const price = Number(p.unitPrice ?? p.price) || 0;
        cost += qty * price;
      }
    }
  }

  // 3. Cost from outsource repair bill in steps
  if (job.repairJobSteps && job.repairJobSteps.length > 0) {
    for (const step of job.repairJobSteps) {
      const stepCost = (step as { repairCost?: number | string }).repairCost;
      if (stepCost) {
        cost += Number(stepCost) || 0;
      }
    }
  }

  // 4. Cost from job level if present (supports multiple common backend field names)
  const anyJob = job as {
    repairCost?: number | string;
    totalCost?: number | string;
    cost?: number | string;
    actualCost?: number | string;
    totalPrice?: number | string;
  };
  const directCost =
    anyJob.repairCost ??
    anyJob.totalCost ??
    anyJob.cost ??
    anyJob.actualCost ??
    anyJob.totalPrice;

  if (directCost) {
    cost += Number(directCost) || 0;
  }

  return cost;
}

function calculateJobDowntimeDays(job: ApiRepairJob): number {
  try {
    const start = new Date(job.createdAt);
    if (isNaN(start.getTime())) return 0;
    const end = job.returnDate
      ? new Date(job.returnDate)
      : new Date(job.updatedAt);
    if (isNaN(end.getTime())) return 0;

    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return 1;
    return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

function getRepairTypeLabel(job: ApiRepairJob): string {
  // Check actionType / stepActionType or steps
  const firstStepAction = job.repairJobSteps?.[0]?.stepMaster?.actionType;
  if (firstStepAction === "SELF_REPAIR") return "ซ่อมเอง/ไม่ซื้ออะไหล่";
  if (firstStepAction === "INTERNAL_STOCK") return "เบิกอะไหล่ภายใน";
  if (firstStepAction === "EXTERNAL_STOCK") return "ซื้ออะไหล่ภายนอก";
  if (firstStepAction === "OUTSOURCE") return "ส่งซ่อมศูนย์บริการ";

  if (job.company || job.companyId) return "ส่งซ่อมศูนย์บริการ";
  if (job.sparepartTxns && job.sparepartTxns.length > 0) {
    return "เบิกอะไหล่ภายใน";
  }
  if (job.reportType === "MAINTENANCE") return "บำรุงรักษาตามรอบ";
  return "ซ่อมทั่วไป";
}

function getJobHandler(job: ApiRepairJob): string {
  if (job.company?.name) return job.company.name;
  if (job.mechanicRepairs && job.mechanicRepairs.length > 0) {
    const names = job.mechanicRepairs
      .map((m) =>
        m.user
          ? `${m.user.firstname || ""} ${m.user.lastname || ""}`.trim()
          : ""
      )
      .filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }
  if (job.reporter) {
    return `${job.reporter.firstname || ""} ${job.reporter.lastname || ""}`.trim();
  }
  return "-";
}

export default function AssetRepairHistoryModal() {
  const { isOpen, asset, closeModal } = useAssetRepairHistoryModalStore();

  const { data: repairJobs = [], isLoading } = useQuery({
    queryKey: ["asset-repair-jobs-detailed", asset?.id],
    queryFn: async () => {
      if (!asset?.id) return [];
      const summaries = await fetchRepairJobSummaries({ assetId: asset.id });
      if (summaries.length === 0) return [];
      // Fetch details to get sparepartTxns and repairJobSteps for cost & downtime
      try {
        const details = await fetchDetailedRepairJobs(summaries);
        return details.length > 0 ? details : summaries;
      } catch {
        return summaries;
      }
    },
    enabled: Boolean(isOpen && asset?.id),
  });

  // Calculate summary metrics
  const totalCost = useMemo(() => {
    return repairJobs.reduce((sum, job) => sum + calculateJobCost(job), 0);
  }, [repairJobs]);

  const totalDowntimeDays = useMemo(() => {
    return repairJobs.reduce(
      (sum, job) => sum + calculateJobDowntimeDays(job),
      0
    );
  }, [repairJobs]);

  if (!isOpen || !asset) return null;

  const secObj =
    asset.section && typeof asset.section === "object"
      ? (asset.section as { name?: string; code?: string; building?: string })
      : null;
  const building = secObj?.building?.trim();
  const secName = secObj?.name?.trim() || (typeof asset.section === "string" ? asset.section : null);
  const locationText =
    building && secName
      ? `${building} ${secName}`
      : secName || building || secObj?.code || "-";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 sm:p-6"
      onClick={closeModal}
    >
      <div
        className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
              ประวัติการซ่อมบำรุงครุภัณฑ์
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              สรุปสถิติการซ่อมบำรุงและประวัติค่าใช้จ่ายทั้งหมดของเครื่อง
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            title="ย้อนกลับ"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <Undo2 className="h-4 w-4" />
          </button>
        </div>

        {/* Asset Info Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-center">
          <div>
            <span className="block text-slate-400 text-xs mb-1 font-medium">
              รหัสครุภัณฑ์
            </span>
            <span className="text-sky-600 font-bold text-sm sm:text-base">
              {asset.noid || "-"}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 text-xs mb-1 font-medium">
              ชื่อครุภัณฑ์ / รุ่น / ยี่ห้อ
            </span>
            <span className="text-slate-900 font-bold text-sm sm:text-base leading-snug line-clamp-2">
              {asset.name} {asset.model ? `(${asset.model})` : ""}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 text-xs mb-1 font-medium">
              หมายเลขเครื่อง (S/N)
            </span>
            <span className="text-slate-800 font-semibold text-sm sm:text-base font-mono">
              {asset.serialNo || "-"}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 text-xs mb-1 font-medium">
              สถานที่ตั้ง
            </span>
            <span className="text-slate-800 font-medium text-sm sm:text-base">
              {locationText}
            </span>
          </div>
        </div>

        {/* 3 KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: ยอดรวมค่าซ่อมสะสมทั้งหมด */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/20 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 mb-1.5">
                ยอดรวมค่าซ่อมสะสมทั้งหมด
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
                {totalCost.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                <span className="text-sm font-semibold text-emerald-600 ml-1.5">
                  บาท
                </span>
              </h3>
            </div>
            <div className="h-11 w-11 rounded-full bg-emerald-100/70 flex items-center justify-center text-emerald-600 shrink-0">
              <Banknote className="h-6 w-6 stroke-[2]" />
            </div>
          </div>

          {/* Card 2: จำนวนการซ่อมทั้งหมด */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50/20 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-sky-700 mb-1.5">
                จำนวนการซ่อมทั้งหมด
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-sky-600">
                {repairJobs.length}
                <span className="text-sm font-semibold text-sky-600 ml-1.5">
                  ครั้ง
                </span>
              </h3>
            </div>
            <div className="h-11 w-11 rounded-full bg-sky-100/70 flex items-center justify-center text-sky-600 shrink-0">
              <Clock className="h-6 w-6 stroke-[2]" />
            </div>
          </div>

          {/* Card 3: เวลาหยุดทำงานสะสม (Downtime) */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/20 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1.5">
                เวลาหยุดทำงานสะสม (Downtime)
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-600">
                {totalDowntimeDays}
                <span className="text-sm font-semibold text-amber-600 ml-1.5">
                  วันทำการ
                </span>
              </h3>
            </div>
            <div className="h-11 w-11 rounded-full bg-amber-100/70 flex items-center justify-center text-amber-600 shrink-0">
              <Clock className="h-6 w-6 stroke-[2]" />
            </div>
          </div>
        </div>

        {/* Table: ประวัติรายการซ่อมบำรุงย้อนหลัง */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 flex flex-col">
          <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-3">
            ประวัติรายการซ่อมบำรุงย้อนหลัง
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-3">เลขที่ใบงาน (JOB No.)</th>
                  <th className="py-3 px-3">วันที่แจ้ง</th>
                  <th className="py-3 px-3">อาการที่แจ้ง / สาเหตุ</th>
                  <th className="py-3 px-3">ประเภทการซ่อม</th>
                  <th className="py-3 px-3 text-right">ค่าซ่อม (บาท)</th>
                  <th className="py-3 px-3 text-center">สถานะ</th>
                  <th className="py-3 px-3">ผู้ดูแล</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-slate-400 text-xs"
                    >
                      กำลังโหลดประวัติการซ่อม...
                    </td>
                  </tr>
                ) : repairJobs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-slate-400 text-xs"
                    >
                      ไม่พบประวัติการซ่อมบำรุงสำหรับครุภัณฑ์นี้
                    </td>
                  </tr>
                ) : (
                  repairJobs.map((job) => {
                    const cost = calculateJobCost(job);
                    const statusCode = job.jobStatus?.code || "";
                    const isCompleted = statusCode === "COMPLETED";
                    const isCancelled = statusCode === "CANCELLED";

                    const symptomDesc = job.symptom || "-";
                    const causeDesc = job.cause?.name || job.diagnosis || "";
                    const fullDesc = causeDesc
                      ? `${symptomDesc} (${causeDesc})`
                      : symptomDesc;

                    return (
                      <tr
                        key={job.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="py-3 px-3 font-semibold text-sky-600 whitespace-nowrap">
                          {job.jobNo}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {formatThaiDate(job.createdAt)}
                        </td>
                        <td className="py-3 px-3 text-slate-800 font-medium max-w-xs truncate" title={fullDesc}>
                          {fullDesc}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {getRepairTypeLabel(job)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {cost.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {isCompleted ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
                              เสร็จสิ้น
                            </span>
                          ) : isCancelled ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              ยกเลิก
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-600 border border-sky-200">
                              กำลังซ่อม
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {getJobHandler(job)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Banner (Green summary row matching mockup) */}
          <div className="mt-3 p-3 sm:p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-bold text-xs sm:text-sm text-emerald-800">
              รวมยอดค่าซ่อมบำรุงสะสมทั้งหมด ({repairJobs.length} รายการ)
            </span>
            <span className="font-extrabold text-sm sm:text-base text-emerald-700">
              {totalCost.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              บาท
            </span>
          </div>
        </div>

        {/* Dialog Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="h-4 w-4 shrink-0 text-slate-400" />
            <span>
              ข้อมูลสรุปค่าใช้จ่ายคำนวณจากใบงานซ่อมบำรุงที่บันทึกสำเร็จในระบบ
            </span>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-xs cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
