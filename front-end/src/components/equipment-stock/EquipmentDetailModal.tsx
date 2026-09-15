import React, { useState, useMemo } from "react";
import {
  X,
  Clock,
  Coins,
  Building2,
  ShieldCheck,
  Phone,
  Image as ImageIcon,
  BarChart2,
  Package,
  Banknote,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEquipmentDetailModalStore } from "../../stores/useEquipmentDetailModalStore";
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

const THAI_FULL_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function formatThaiDate(dateString?: string | null): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear() + 543;
    return `${day}/${month}/${year}`;
  } catch {
    return "-";
  }
}

function formatThaiFullDate(dateString?: string | null): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = THAI_FULL_MONTHS[d.getMonth()];
    const year = d.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  } catch {
    return "-";
  }
}

function formatHistoryDate(dateString?: string | null): string {
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

  if (job.sparepartTxns && job.sparepartTxns.length > 0) {
    for (const txn of job.sparepartTxns) {
      if (txn.txnType === "WITHDRAW") {
        const qty = Number(txn.qty) || 0;
        const price = Number(txn.unitPrice) || 0;
        cost += qty * price;
      }
    }
  }

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

  if (job.repairJobSteps && job.repairJobSteps.length > 0) {
    for (const step of job.repairJobSteps) {
      const stepCost = (step as { repairCost?: number | string }).repairCost;
      if (stepCost) {
        cost += Number(stepCost) || 0;
      }
    }
  }

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

function getStatusBadge(code?: string, name?: string) {
  switch (code) {
    case "NORMAL":
      return {
        text: name || "พร้อมใช้งาน",
        bg: "bg-emerald-50 border-emerald-200 text-emerald-700",
        dot: "bg-emerald-500",
      };
    case "DAMAGED":
      return {
        text: name || "ชำรุด",
        bg: "bg-rose-50 border-rose-200 text-rose-700",
        dot: "bg-rose-500",
      };
    case "UNDER_REPAIR":
      return {
        text: name || "กำลังซ่อม",
        bg: "bg-blue-50 border-blue-200 text-blue-700",
        dot: "bg-blue-500",
      };
    case "WAIT_DISPOSAL":
      return {
        text: name || "รอจำหน่าย",
        bg: "bg-amber-50 border-amber-200 text-amber-700",
        dot: "bg-amber-500",
      };
    case "DISPOSAL":
      return {
        text: name || "จำหน่ายออกแล้ว",
        bg: "bg-slate-100 border-slate-300 text-slate-700",
        dot: "bg-slate-500",
      };
    case "LOST":
      return {
        text: name || "สูญหาย",
        bg: "bg-rose-100 border-rose-300 text-rose-800",
        dot: "bg-rose-600",
      };
    default:
      return {
        text: name || "พร้อมใช้งาน",
        bg: "bg-emerald-50 border-emerald-200 text-emerald-700",
        dot: "bg-emerald-500",
      };
  }
}

export default function EquipmentDetailModal() {
  const { isOpen, selectedAsset: asset, closeModal } = useEquipmentDetailModalStore();
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");
  const [imgError, setImgError] = useState(false);

  // Reset states when asset changes
  React.useEffect(() => {
    setImgError(false);
    setActiveTab("overview");
  }, [asset?.id]);

  // Fetch detailed repair history from friend's service
  const { data: repairJobs = [], isLoading: isLoadingRepairs } = useQuery({
    queryKey: ["equipment-repair-jobs-detailed", asset?.id],
    queryFn: async () => {
      if (!asset?.id) return [];
      const summaries = await fetchRepairJobSummaries({ assetId: asset.id });
      if (summaries.length === 0) return [];
      try {
        const details = await fetchDetailedRepairJobs(summaries);
        return details.length > 0 ? details : summaries;
      } catch {
        return summaries;
      }
    },
    enabled: Boolean(isOpen && asset?.id),
  });

  // KPI Calculations
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

  const statusBadge = getStatusBadge(asset.status?.code, asset.status?.name);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4"
      onClick={closeModal}
    >
      {/* Modal Card */}
      <div
        className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in duration-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Figma mockup */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 leading-snug">
              {asset.name} | <span className="font-semibold text-slate-600">{asset.model || "-"}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              รหัส:{" "}
              <span className="font-mono font-medium text-slate-700">
                {asset.noid || asset.id}
              </span>{" "}
              | หมายเลขเครื่อง:{" "}
              <span className="font-mono font-medium text-slate-700">
                {asset.serialNo || "-"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer shrink-0 ml-4"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 2 Tabs: ภาพรวม & ประวัติ (History) */}
        <div className="flex items-center gap-6 px-6 border-b border-slate-100 text-xs font-semibold shrink-0 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-1.5 py-3 border-b-2 transition-all cursor-pointer ${
              activeTab === "overview"
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <BarChart2 className="h-4 w-4" />
            ภาพรวม
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 py-3 border-b-2 transition-all cursor-pointer ${
              activeTab === "history"
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Clock className="h-4 w-4" />
            ประวัติ (History)
            {repairJobs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-700 font-bold">
                {repairJobs.length}
              </span>
            )}
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {activeTab === "overview" ? (
            /* TAB 1: ภาพรวม (เราทำเองตามภาพตัวอย่างแรกเป๊ะๆ) */
            <div className="grid grid-cols-12 gap-5">
              {/* Left Column: Image + Status + Location & Owner (4 cols) */}
              <div className="col-span-12 sm:col-span-4 flex flex-col space-y-3">
                {/* Equipment Image Box */}
                <div className="relative w-full h-44 rounded-2xl border border-slate-100 bg-white shadow-xs p-2 flex items-center justify-center overflow-hidden">
                  {asset.imageUrl && !imgError ? (
                    <img
                      src={asset.imageUrl}
                      alt={asset.name}
                      onError={() => setImgError(true)}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-300">
                      <ImageIcon className="h-10 w-10 stroke-[1.2]" />
                      <span className="text-[10px] text-slate-400 mt-1">ไม่มีรูปภาพ</span>
                    </div>
                  )}
                </div>

                {/* Status Badge Pill */}
                <div className="flex justify-center">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge.bg}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${statusBadge.dot}`} />
                    {statusBadge.text}
                  </span>
                </div>

                {/* ตำแหน่ง & เจ้าของ */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-800 mb-1">
                    ตำแหน่ง & เจ้าของ
                  </h4>
                  <div className="flex justify-between text-xs gap-2">
                    <span className="text-slate-400 shrink-0">หน่วยงาน:</span>
                    <span className="font-medium text-slate-700 text-right">
                      {asset.section?.name || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs gap-2">
                    <span className="text-slate-400 shrink-0">สถานที่ใช้งาน:</span>
                    <span className="font-medium text-slate-700 text-right">
                      {asset.section?.building || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs gap-2">
                    <span className="text-slate-400 shrink-0">ผู้รับผิดชอบ:</span>
                    <span className="font-medium text-slate-700 text-right">
                      {asset.owner
                        ? `${asset.owner.firstname} ${asset.owner.lastname}`
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Pricing Card + Main Asset Details Card (8 cols) */}
              <div className="col-span-12 sm:col-span-8 space-y-3">
                {/* 1. ข้อมูลราคาและการได้มา */}
                <div className="rounded-2xl bg-[#ecfdf5] border border-[#a7f3d0] p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-2">
                    <Coins className="h-4 w-4 text-emerald-600" />
                    ข้อมูลราคาและการได้มา
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
                        {Number(asset.price || 0).toLocaleString()}{" "}
                        <span className="text-base font-semibold text-emerald-800">บาท</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-right text-xs">
                      <div>
                        <span className="text-emerald-700/70">วิธีจัดซื้อ: </span>
                        <span className="font-bold text-emerald-900">
                          {asset.acqType || "e-bidding"}
                        </span>
                      </div>
                      <div>
                        <span className="text-emerald-700/70">ประเภทเงิน: </span>
                        <span className="font-bold text-emerald-900">
                          {asset.budgetType || "เงินงบประมาณ"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. ข้อมูลหลักครุภัณฑ์ */}
                <div className="rounded-2xl bg-slate-50/70 border border-slate-100 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Package className="h-4 w-4 text-slate-600" />
                    ข้อมูลหลักครุภัณฑ์
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">รหัสครุภัณฑ์:</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {asset.noid || asset.id}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">ชื่อครุภัณฑ์:</span>
                      <span className="font-semibold text-slate-800">{asset.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">หมายเลขเครื่อง:</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {asset.serialNo || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">ยี่ห้อและรุ่น:</span>
                      <span className="font-semibold text-slate-800">{asset.model || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">ประเภท:</span>
                      <span className="font-semibold text-slate-800">
                        {asset.type?.name || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">
                        วันที่ตรวจรับเข้าสต็อก:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {formatThaiDate(asset.receivedDate)}
                      </span>
                    </div>
                  </div>

                  {/* Sub-cards: ผู้ขาย & ประกัน */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                    {/* ผู้ขาย */}
                    <div className="bg-white rounded-xl p-3 border border-slate-100 space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                        <Building2 className="h-3.5 w-3.5 text-slate-500" />
                        ผู้ขาย
                      </div>
                      <div className="text-[10px] text-slate-400">บริษัทผู้จำหน่าย</div>
                      <div className="text-xs font-semibold text-slate-800 truncate" title={asset.company?.name}>
                        {asset.company?.name || "-"}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Phone className="h-2.5 w-2.5 text-slate-400" />
                        <span>{asset.company?.phone || "-"}</span>
                      </div>
                    </div>

                    {/* ประกัน */}
                    <div className="bg-white rounded-xl p-3 border border-slate-100 space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        ประกัน
                      </div>
                      <div className="text-[10px] text-slate-400">วันหมดประกัน</div>
                      <div className="text-xs font-bold text-rose-600">
                        {formatThaiFullDate(asset.warrantyDate)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: ประวัติ (History) - เอาหน้าเพื่อนขึ้นมาแสดงในแท็บนี้เลยทันที ไม่ต้องกดหลายที */
            <div className="space-y-5">
              {/* 3 KPI Summary Cards เหมือนหน้าเพื่อนเป๊ะๆ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1: ยอดรวมค่าซ่อมสะสมทั้งหมด */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 sm:p-5 flex items-center justify-between shadow-2xs">
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 mb-1">
                      ยอดรวมค่าซ่อมสะสมทั้งหมด
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-black text-emerald-600">
                      {totalCost.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      <span className="text-sm font-semibold text-emerald-600 ml-1.5">
                        บาท
                      </span>
                    </h3>
                  </div>
                  <div className="h-11 w-11 rounded-full bg-emerald-100/80 flex items-center justify-center text-emerald-600 shrink-0">
                    <Banknote className="h-6 w-6 stroke-[2]" />
                  </div>
                </div>

                {/* Card 2: จำนวนการซ่อมทั้งหมด */}
                <div className="rounded-2xl border border-sky-200 bg-sky-50/30 p-4 sm:p-5 flex items-center justify-between shadow-2xs">
                  <div>
                    <p className="text-xs font-semibold text-sky-700 mb-1">
                      จำนวนการซ่อมทั้งหมด
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-black text-sky-600">
                      {repairJobs.length}
                      <span className="text-sm font-semibold text-sky-600 ml-1.5">
                        ครั้ง
                      </span>
                    </h3>
                  </div>
                  <div className="h-11 w-11 rounded-full bg-sky-100/80 flex items-center justify-center text-sky-600 shrink-0">
                    <Clock className="h-6 w-6 stroke-[2]" />
                  </div>
                </div>

                {/* Card 3: เวลาหยุดทำงานสะสม (Downtime) */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 sm:p-5 flex items-center justify-between shadow-2xs">
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-1">
                      เวลาหยุดทำงานสะสม (Downtime)
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-black text-amber-600">
                      {totalDowntimeDays}
                      <span className="text-sm font-semibold text-amber-600 ml-1.5">
                        วันทำการ
                      </span>
                    </h3>
                  </div>
                  <div className="h-11 w-11 rounded-full bg-amber-100/80 flex items-center justify-center text-amber-600 shrink-0">
                    <Clock className="h-6 w-6 stroke-[2]" />
                  </div>
                </div>
              </div>

              {/* Table: ประวัติรายการซ่อมบำรุงย้อนหลัง */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 flex flex-col shadow-2xs">
                <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-3">
                  ประวัติรายการซ่อมบำรุงย้อนหลัง
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500">
                        <th className="py-2.5 px-3">เลขที่ใบงาน (JOB No.)</th>
                        <th className="py-2.5 px-3">วันที่แจ้ง</th>
                        <th className="py-2.5 px-3">อาการที่แจ้ง / สาเหตุ</th>
                        <th className="py-2.5 px-3">ประเภทการซ่อม</th>
                        <th className="py-2.5 px-3 text-right">ค่าซ่อม (บาท)</th>
                        <th className="py-2.5 px-3 text-center">สถานะ</th>
                        <th className="py-2.5 px-3">ผู้ดูแล</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {isLoadingRepairs ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-10 text-center text-slate-400 text-xs"
                          >
                            กำลังโหลดประวัติการซ่อม...
                          </td>
                        </tr>
                      ) : repairJobs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-10 text-center text-slate-400 text-xs"
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
                              <td className="py-2.5 px-3 font-semibold text-sky-600 whitespace-nowrap">
                                {job.jobNo}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                {formatHistoryDate(job.createdAt)}
                              </td>
                              <td
                                className="py-2.5 px-3 text-slate-800 font-medium max-w-xs truncate"
                                title={fullDesc}
                              >
                                {fullDesc}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                {getRepairTypeLabel(job)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                                {cost.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {isCompleted ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
                                    เสร็จสิ้น
                                  </span>
                                ) : isCancelled ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                    ยกเลิก
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-600 border border-sky-200">
                                    กำลังซ่อม
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                {getJobHandler(job)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer Banner (Green summary row matching friend's design) */}
                <div className="mt-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-emerald-800">
                    รวมยอดค่าซ่อมบำรุงสะสมทั้งหมด ({repairJobs.length} รายการ)
                  </span>
                  <span className="font-extrabold text-sm text-emerald-700">
                    {totalCost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    บาท
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-xl bg-slate-200/80 px-6 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
