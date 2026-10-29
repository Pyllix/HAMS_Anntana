import { useEffect, useMemo, useState } from "react";
import { thaiDateString, thaiDateTimeRange, thaiMonthDateRange } from "../services/thaiDate";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileBarChart2,
  Package,
  Printer,
  Search,
} from "lucide-react";
import MaintenancePrintDialog from "../components/maintenance-reports/MaintenancePrintDialog";
import { ROLES } from "../router/roles";
import {
  getJobsVisibleToMaintenanceUser,
  getMaintenanceReportJobs,
} from "../services/maintenanceReportService";
import {
  hasRequestedSpareParts,
  printMaintenanceJobDocument,
  printMaintenancePeriodReport,
} from "../services/maintenanceReportPrintService";
import { useAuthStore } from "../stores/authStore";
import type {
  MaintenanceDocumentType,
  MaintenanceReportPeriod,
  MaintenanceReportPeriodMode,
  MaintenanceReportStatusFilter,
} from "../types/TypeMaintenanceReport";
import type {
  RepairActionType,
  RepairJob,
  RepairJobStatusCode,
} from "../types/TypeRepairWorkflow";

const PAGE_SIZE = 7;

const actionLabels: Record<RepairActionType, string> = {
  SELF_REPAIR: "ซ่อมเองได้",
  WITH_PARTS: "ขอเบิกอะไหล่",
  INTERNAL_STOCK: "เบิกอะไหล่ภายใน",
  EXTERNAL_STOCK: "จัดหาอะไหล่ภายนอก",
  OUTSOURCE: "ส่งซ่อมภายนอก",
  UNREPAIRABLE: "ไม่สามารถซ่อมได้",
};

const statusLabels: Record<RepairJobStatusCode, string> = {
  WAITING_HANDOVER: "รอรับเครื่อง",
  PENDING_ASSIGN: "รอมอบหมายงาน",
  IN_PROGRESS: "กำลังดำเนินการ",
  WAITING_PARTS: "รออะไหล่",
  PARCEL_PROCESSING: "พัสดุกำลังดำเนินการ",
  OUTSOURCED: "ส่งซ่อมภายนอก",
  UNREPAIRABLE: "ไม่สามารถซ่อมได้",
  WAITING_DELIVERY: "เสร็จแล้วรอรับคืน",
  COMPLETED: "ปิดงานแล้ว",
  CANCELLED: "ยกเลิก",
};

function localDateValue(date = new Date()): string {
  return thaiDateString(date);
}

function localMonthValue(date = new Date()): string {
  return thaiDateString(date).slice(0, 7);
}

function buildPeriod(
  mode: MaintenanceReportPeriodMode,
  value: string,
): MaintenanceReportPeriod {
  if (mode === "MONTH") {
    const { startDate, endDate } = thaiMonthDateRange(value);
    return {
      mode,
      value,
      startDate,
      endDate,
      label: new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        month: "long",
        year: "numeric",
      }).format(startDate),
    };
  }

  const { startDate, endDate } = thaiDateTimeRange(value);
  return {
    mode,
    value,
    startDate,
    endDate,
    label: new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(startDate),
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).format(date);
}

function mechanicNames(job: RepairJob): string {
  const names = (job.mechanics || [])
    .map((mechanic) =>
      `${mechanic.user.firstName} ${mechanic.user.lastName}`.trim(),
    )
    .filter(Boolean);
  if (names.length) return names.join(", ");
  return job.evaluator
    ? `${job.evaluator.firstName} ${job.evaluator.lastName}`.trim()
    : "-";
}

function matchesStatus(
  job: RepairJob,
  filter: MaintenanceReportStatusFilter,
): boolean {
  const status = job.status?.statusCode;
  if (filter === "ALL") return true;
  if (filter === "COMPLETED") return status === "COMPLETED";
  if (filter === "CANCELLED") return status === "CANCELLED";
  return status !== "COMPLETED" && status !== "CANCELLED";
}

function reportStatusClass(status?: RepairJobStatusCode): string {
  if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700";
  if (status === "CANCELLED") return "bg-slate-100 text-slate-500";
  if (status === "UNREPAIRABLE") return "bg-rose-50 text-rose-700";
  if (status === "WAITING_PARTS" || status === "PARCEL_PROCESSING")
    return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}

export default function MaintenanceReports() {
  const user = useAuthStore((state) => state.user);
  const [periodMode, setPeriodMode] =
    useState<MaintenanceReportPeriodMode>("DAY");
  const [periodValue, setPeriodValue] = useState(localDateValue());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<MaintenanceReportStatusFilter>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [printJob, setPrintJob] = useState<RepairJob | null>(null);
  const [printError, setPrintError] = useState("");

  const { data: jobs = [], isLoading, isError } = useQuery({
    queryKey: ["maintenanceReportJobs"],
    queryFn: getMaintenanceReportJobs,
  });

  const period = useMemo(
    () => buildPeriod(periodMode, periodValue),
    [periodMode, periodValue],
  );

  const visibleJobs = useMemo(
    () => getJobsVisibleToMaintenanceUser(jobs, user),
    [jobs, user],
  );

  const filteredJobs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return visibleJobs.filter((job) => {
      const createdAt = new Date(job.createdAt);
      const isInPeriod =
        !Number.isNaN(createdAt.getTime()) &&
        createdAt >= period.startDate &&
        createdAt <= period.endDate;
      const matchesKeyword =
        !keyword ||
        job.jobNo.toLowerCase().includes(keyword) ||
        job.asset?.assetCode.toLowerCase().includes(keyword) ||
        job.asset?.assetName.toLowerCase().includes(keyword) ||
        job.symptom.toLowerCase().includes(keyword) ||
        mechanicNames(job).toLowerCase().includes(keyword);
      return isInPeriod && matchesKeyword && matchesStatus(job, statusFilter);
    });
  }, [period, search, statusFilter, visibleJobs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [periodMode, periodValue, search, statusFilter]);

  const summary = useMemo(
    () => ({
      all: filteredJobs.length,
      open: filteredJobs.filter(
        (job) =>
          job.status?.statusCode !== "COMPLETED" &&
          job.status?.statusCode !== "CANCELLED",
      ).length,
      completed: filteredJobs.filter(
        (job) => job.status?.statusCode === "COMPLETED",
      ).length,
      withParts: filteredJobs.filter(hasRequestedSpareParts).length,
    }),
    [filteredJobs],
  );

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedJobs = filteredJobs.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const preparedBy = user
    ? `${user.firstname} ${user.lastname}`.trim()
    : "ผู้ใช้งานระบบ";

  const handlePeriodModeChange = (mode: MaintenanceReportPeriodMode) => {
    setPeriodMode(mode);
    setPeriodValue(mode === "DAY" ? localDateValue() : localMonthValue());
  };

  const handlePrintJob = (
    type: Exclude<MaintenanceDocumentType, "PERIOD_REPORT">,
    job: RepairJob,
  ) => {
    const opened = printMaintenanceJobDocument({
      type,
      job,
      context: { preparedBy, preparedAt: new Date() },
    });
    if (!opened) {
      setPrintError(
        "เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up สำหรับเว็บไซต์นี้แล้วลองใหม่",
      );
      return;
    }
    setPrintError("");
    setPrintJob(null);
  };

  const handlePrintPeriod = () => {
    const opened = printMaintenancePeriodReport({
      type: "PERIOD_REPORT",
      jobs: filteredJobs,
      period,
      context: { preparedBy, preparedAt: new Date() },
    });
    if (!opened) {
      setPrintError(
        "เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up สำหรับเว็บไซต์นี้แล้วลองใหม่",
      );
    } else {
      setPrintError("");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <section className="shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileBarChart2 className="h-5 w-5 text-emerald-600" />
              <h2 className="font-bold text-slate-900">
                รายงานและเอกสารงานซ่อม
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {user?.role === ROLES.MAINTENANCE_HEAD
                ? "ภาพรวมงานซ่อมของช่างทั้งหมด"
                : "แสดงเฉพาะใบงานที่มอบหมายให้คุณหรือคุณเป็นผู้ประเมิน"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">
                รูปแบบรายงาน
              </label>
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => handlePeriodModeChange("DAY")}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition ${periodMode === "DAY" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500"}`}
                >
                  รายวัน
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodModeChange("MONTH")}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition ${periodMode === "MONTH" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500"}`}
                >
                  รายเดือน
                </button>
              </div>
            </div>
            <div>
              <label
                htmlFor="maintenance-report-period"
                className="mb-1.5 block text-[11px] font-semibold text-slate-500"
              >
                {periodMode === "DAY" ? "วันที่รับงาน" : "เดือนที่รับงาน"}
              </label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="maintenance-report-period"
                  type={periodMode === "DAY" ? "date" : "month"}
                  value={periodValue}
                  onChange={(event) => setPeriodValue(event.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handlePrintPeriod}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
            >
              <Printer className="h-4 w-4" />
              พิมพ์รายงาน{periodMode === "DAY" ? "รายวัน" : "รายเดือน"}
            </button>
          </div>
        </div>
        {printError && (
          <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {printError}
          </p>
        )}
      </section>

      <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard
          label="งานที่รับเข้า"
          value={summary.all}
          icon={ClipboardList}
          color="blue"
        />
        <SummaryCard
          label="กำลังดำเนินการ"
          value={summary.open}
          icon={Clock3}
          color="amber"
        />
        <SummaryCard
          label="ปิดงานแล้ว"
          value={summary.completed}
          icon={CheckCircle2}
          color="emerald"
        />
        <SummaryCard
          label="งานที่ใช้อะไหล่"
          value={summary.withParts}
          icon={Package}
          color="violet"
        />
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex shrink-0 flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหารหัสงาน ครุภัณฑ์ อาการ หรือชื่อช่าง..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <select
            aria-label="กรองสถานะรายงาน"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as MaintenanceReportStatusFilter,
              )
            }
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-emerald-500"
          >
            <option value="ALL">สถานะทั้งหมด</option>
            <option value="OPEN">กำลังดำเนินการ</option>
            <option value="COMPLETED">ปิดงานแล้ว</option>
            <option value="CANCELLED">ยกเลิก</option>
          </select>
        </div>

        <div className="table-scroll min-h-0 flex-1">
          <table className="w-full border-collapse text-left text-xs text-slate-600">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-700 shadow-xs">
              <tr>
                <th className="px-4 py-3.5 font-semibold">รหัสงาน / วันที่แจ้ง</th>
                <th className="px-4 py-3.5 font-semibold">ครุภัณฑ์ / อาการ</th>
                <th className="px-4 py-3.5 font-semibold">ช่างผู้รับผิดชอบ</th>
                <th className="px-4 py-3.5 font-semibold">ผลการประเมิน</th>
                <th className="px-4 py-3.5 font-semibold">สถานะ</th>
                <th className="px-4 py-3.5 text-center font-semibold">เอกสาร</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-slate-400">
                    กำลังรวบรวมข้อมูลงานซ่อมสำหรับรายงาน...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-rose-500">
                    ไม่สามารถโหลดข้อมูลงานซ่อมได้ กรุณาลองใหม่อีกครั้ง
                  </td>
                </tr>
              ) : paginatedJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-slate-400">
                    ไม่พบงานซ่อมใน{periodMode === "DAY" ? "วันที่" : "เดือน"}ที่เลือก
                  </td>
                </tr>
              ) : (
                paginatedJobs.map((job) => (
                  <tr key={job.jobId} className="transition hover:bg-slate-50/80">
                    <td className="px-4 py-3.5 align-top">
                      <strong className="block whitespace-nowrap font-mono text-slate-900">
                        {job.jobNo}
                      </strong>
                      <span className="mt-1 block text-[11px] text-slate-400">
                        {formatDate(job.createdAt)}
                      </span>
                    </td>
                    <td className="max-w-[300px] px-4 py-3.5 align-top">
                      <strong className="block text-sm text-slate-900">
                        {job.asset?.assetName || "-"}
                      </strong>
                      <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                        {job.asset?.assetCode || "-"}
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-slate-500">
                        {job.symptom}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top text-slate-700">
                      {mechanicNames(job)}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-700">
                        {job.actionType
                          ? actionLabels[job.actionType]
                          : "รอประเมิน"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-semibold ${reportStatusClass(job.status?.statusCode)}`}
                      >
                        {job.status
                          ? statusLabels[job.status.statusCode]
                          : "ไม่ระบุ"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center align-top">
                      <button
                        type="button"
                        onClick={() => setPrintJob(job)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        เลือกพิมพ์
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 px-4 py-3">
          <p className="text-[11px] text-slate-500">
            แสดง {filteredJobs.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} ถึง{" "}
            {Math.min(safePage * PAGE_SIZE, filteredJobs.length)} จาก{" "}
            {filteredJobs.length} รายการ
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="หน้าก่อนหน้า"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-emerald-600 px-2 text-xs font-semibold text-white">
              {safePage}
            </span>
            <button
              type="button"
              aria-label="หน้าถัดไป"
              disabled={safePage >= totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <MaintenancePrintDialog
        job={printJob}
        onClose={() => setPrintJob(null)}
        onPrint={handlePrintJob}
      />
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  icon: typeof ClipboardList;
  color: "blue" | "amber" | "emerald" | "violet";
}

function SummaryCard({ label, value, icon: Icon, color }: SummaryCardProps) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-2xs">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div>
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="mt-0.5 text-lg font-bold text-slate-900">
          {value} <span className="text-xs font-medium text-slate-500">งาน</span>
        </p>
      </div>
    </div>
  );
}
