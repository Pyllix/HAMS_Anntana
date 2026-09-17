import { useState, useMemo, useEffect } from "react";
import { Undo2, Banknote, Clock, Info, ChevronLeft, ChevronRight } from "lucide-react";
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

  // Pagination State (5 items per page ensures clean fit without vertical scroll)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [isOpen, asset?.id]);

  const totalItems = repairJobs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return repairJobs.slice(start, start + pageSize);
  }, [repairJobs, currentPage, pageSize]);

  // Prevent layout shift/jumping between pages: if multiple pages exist, maintain 5-row height on the last page
  const emptyRowsCount = useMemo(() => {
    if (totalPages > 1 && paginatedJobs.length < pageSize) {
      return pageSize - paginatedJobs.length;
    }
    return 0;
  }, [totalPages, paginatedJobs.length, pageSize]);

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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={closeModal}
    >
      <div
        className="w-full max-w-5xl lg:max-w-[66rem] bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-6.5 space-y-3.5 relative my-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xl sm:text-[22px] font-bold text-slate-800">
              ประวัติการซ่อมบำรุงครุภัณฑ์
            </h2>
            <p className="text-xs sm:text-[13px] text-slate-400 mt-0.5">
              สรุปสถิติการซ่อมบำรุงและประวัติค่าใช้จ่ายทั้งหมดของเครื่อง
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            title="ย้อนกลับ"
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <Undo2 className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Asset Info Card */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 sm:p-3.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-3.5 items-center">
          <div>
            <span className="block text-slate-400 text-[11.5px] sm:text-xs font-medium">
              รหัสครุภัณฑ์
            </span>
            <span className="text-sky-600 font-bold text-xs sm:text-[14.5px] truncate block">
              {asset.noid || "-"}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 text-[11.5px] sm:text-xs font-medium">
              ชื่อครุภัณฑ์ / รุ่น / ยี่ห้อ
            </span>
            <span className="text-slate-900 font-bold text-xs sm:text-[14.5px] leading-snug truncate block" title={`${asset.name} ${asset.model ? `(${asset.model})` : ""}`}>
              {asset.name} {asset.model ? `(${asset.model})` : ""}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 text-[11.5px] sm:text-xs font-medium">
              หมายเลขเครื่อง (S/N)
            </span>
            <span className="text-slate-800 font-semibold text-xs sm:text-[14.5px] font-mono truncate block">
              {asset.serialNo || "-"}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 text-[11.5px] sm:text-xs font-medium">
              สถานที่ตั้ง
            </span>
            <span className="text-slate-800 font-medium text-xs sm:text-[14.5px] truncate block" title={locationText}>
              {locationText}
            </span>
          </div>
        </div>

        {/* 3 KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-3.5">
          {/* Card 1: ยอดรวมค่าซ่อมสะสมทั้งหมด */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/20 p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 mb-0.5">
                ยอดรวมค่าซ่อมสะสมทั้งหมด
              </p>
              <h3 className="text-2xl sm:text-[26px] font-extrabold text-emerald-600">
                {totalCost.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                <span className="text-xs sm:text-sm font-semibold text-emerald-600 ml-1">
                  บาท
                </span>
              </h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-100/70 flex items-center justify-center text-emerald-600 shrink-0">
              <Banknote className="h-5.5 w-5.5 stroke-[2]" />
            </div>
          </div>

          {/* Card 2: จำนวนการซ่อมทั้งหมด */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/20 p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-sky-700 mb-0.5">
                จำนวนการซ่อมทั้งหมด
              </p>
              <h3 className="text-2xl sm:text-[26px] font-extrabold text-sky-600">
                {repairJobs.length}
                <span className="text-xs sm:text-sm font-semibold text-sky-600 ml-1">
                  ครั้ง
                </span>
              </h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-sky-100/70 flex items-center justify-center text-sky-600 shrink-0">
              <Clock className="h-5.5 w-5.5 stroke-[2]" />
            </div>
          </div>

          {/* Card 3: เวลาหยุดทำงานสะสม (Downtime) */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-0.5">
                เวลาหยุดทำงานสะสม (Downtime)
              </p>
              <h3 className="text-2xl sm:text-[26px] font-extrabold text-amber-600">
                {totalDowntimeDays}
                <span className="text-xs sm:text-sm font-semibold text-amber-600 ml-1">
                  วันทำการ
                </span>
              </h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-100/70 flex items-center justify-center text-amber-600 shrink-0">
              <Clock className="h-5.5 w-5.5 stroke-[2]" />
            </div>
          </div>
        </div>

        {/* Table: ประวัติรายการซ่อมบำรุงย้อนหลัง */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4 flex flex-col">
          <h3 className="text-sm sm:text-[15px] font-bold text-slate-800 mb-2.5">
            ประวัติรายการซ่อมบำรุงย้อนหลัง
          </h3>

          <div className="w-full overflow-hidden">
            <table className="w-full text-left table-fixed text-xs sm:text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11.5px] sm:text-xs font-semibold text-slate-500">
                  <th className="w-[16%] py-2.5 px-3">เลขที่ใบงาน (JOB No.)</th>
                  <th className="w-[12%] py-2.5 px-3">วันที่แจ้ง</th>
                  <th className="w-[25%] py-2.5 px-3">อาการที่แจ้ง / สาเหตุ</th>
                  <th className="w-[15%] py-2.5 px-3">ประเภทการซ่อม</th>
                  <th className="w-[10%] py-2.5 px-3 text-right">ค่าซ่อม (บาท)</th>
                  <th className="w-[11%] py-2.5 px-2 text-center">สถานะ</th>
                  <th className="w-[11%] py-2.5 px-3">ผู้ดูแล</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-[13px]">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-6 text-center text-slate-400 text-xs sm:text-sm"
                    >
                      กำลังโหลดประวัติการซ่อม...
                    </td>
                  </tr>
                ) : totalItems === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-6 text-center text-slate-400 text-xs sm:text-sm"
                    >
                      ไม่พบประวัติการซ่อมบำรุงสำหรับครุภัณฑ์นี้
                    </td>
                  </tr>
                ) : (
                  paginatedJobs.map((job) => {
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
                        className="h-[41px] hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-semibold text-sky-600 truncate">
                          {job.jobNo}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 truncate">
                          {formatThaiDate(job.createdAt)}
                        </td>
                        <td
                          className="py-2.5 px-3 text-slate-800 font-medium truncate"
                          title={fullDesc}
                        >
                          {fullDesc}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 truncate" title={getRepairTypeLabel(job)}>
                          {getRepairTypeLabel(job)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {cost.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          {isCompleted ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 whitespace-nowrap">
                              เสร็จสิ้น
                            </span>
                          ) : isCancelled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                              ยกเลิก
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-600 border border-sky-200 whitespace-nowrap">
                              กำลังซ่อม
                            </span>
                          )}
                        </td>
                        <td
                          className="py-2.5 px-3 text-slate-600 truncate"
                          title={getJobHandler(job)}
                        >
                          {getJobHandler(job)}
                        </td>
                      </tr>
                    );
                  })
                )}
                {/* Filler rows on last page when multiple pages exist to prevent layout jumping */}
                {emptyRowsCount > 0 &&
                  Array.from({ length: emptyRowsCount }).map((_, idx) => (
                    <tr
                      key={`empty-filler-row-${idx}`}
                      className="h-[41px] pointer-events-none select-none"
                    >
                      <td className="py-2.5 px-3 text-transparent">&nbsp;</td>
                      <td className="py-2.5 px-3 text-transparent">&nbsp;</td>
                      <td className="py-2.5 px-3 text-transparent">&nbsp;</td>
                      <td className="py-2.5 px-3 text-transparent">&nbsp;</td>
                      <td className="py-2.5 px-3 text-transparent">&nbsp;</td>
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-transparent opacity-0 select-none whitespace-nowrap">
                          เสร็จสิ้น
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-transparent">&nbsp;</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer Banner (Green summary row matching mockup) */}
          <div className="mt-2.5 p-2.5 sm:p-3 rounded-lg bg-emerald-50/70 border border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-2">
            <span className="font-bold text-xs sm:text-[13px] text-emerald-800">
              รวมยอดค่าซ่อมบำรุงสะสมทั้งหมด ({totalItems} รายการ)
            </span>
            <span className="font-extrabold text-xs sm:text-[14.5px] text-emerald-700">
              {totalCost.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              บาท
            </span>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2.5 px-1 text-xs text-slate-500">
              <span className="font-medium">
                แสดง {(currentPage - 1) * pageSize + 1} ถึง{" "}
                {Math.min(currentPage * pageSize, totalItems)} จาก {totalItems} รายการ
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold cursor-pointer transition-all ${currentPage === p
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
                      }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="หน้าถัดไป"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dialog Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3.5 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>
              ข้อมูลสรุปค่าใช้จ่ายคำนวณจากใบงานซ่อมบำรุงที่บันทึกสำเร็จในระบบ
            </span>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
