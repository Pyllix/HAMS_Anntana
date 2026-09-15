import React, { useState } from "react";
import {
  X,
  Package,
  Clock,
  LayoutGrid,
  Coins,
  Building2,
  ShieldCheck,
  Phone,
  Image as ImageIcon,
  Wrench,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAssetDetailModalStore } from "../../stores/useAssetDetailModalStore";
import { useAssetRepairHistoryModalStore } from "../../stores/useAssetRepairHistoryModalStore";
import { fetchRepairJobSummaries } from "../../services/repairApiService";

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
        bg: "bg-orange-50 border-orange-200 text-orange-700",
        dot: "bg-orange-500",
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
        text: name || "จำหน่ายแล้ว",
        bg: "bg-slate-100 border-slate-200 text-slate-700",
        dot: "bg-slate-500",
      };
    case "LOST":
      return {
        text: name || "สูญหาย",
        bg: "bg-rose-50 border-rose-200 text-rose-700",
        dot: "bg-rose-500",
      };
    default:
      return {
        text: name || "พร้อมใช้งาน",
        bg: "bg-emerald-50 border-emerald-200 text-emerald-700",
        dot: "bg-emerald-500",
      };
  }
}

export default function AssetDetailModal() {
  const { isOpen, selectedAsset: asset, closeModal } = useAssetDetailModalStore();
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");
  const [imgError, setImgError] = useState(false);

  // Reset imgError when asset changes
  React.useEffect(() => {
    setImgError(false);
  }, [asset?.id]);

  const { data: repairJobs } = useQuery({
    queryKey: ["asset-repair-jobs", asset?.id],
    queryFn: () =>
      asset?.id ? fetchRepairJobSummaries({ assetId: asset.id }) : [],
    enabled: Boolean(isOpen && asset?.id),
  });

  const repairCount = repairJobs?.length ?? 0;

  if (!isOpen || !asset) return null;

  const statusBadge = getStatusBadge(asset.status?.code, asset.status?.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3">
      {/* Modal Card */}
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 leading-snug">
              {asset.name} {asset.model ? `| ${asset.model}` : ""}
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
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer shrink-0 ml-4"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 2 Tabs: ภาพรวม & ประวัติ (History) */}
        <div className="flex items-center gap-6 px-6 border-b border-slate-100 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-1.5 py-3 border-b-2 transition-all cursor-pointer ${
              activeTab === "overview"
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
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
            {repairCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-sky-100 text-sky-700 font-bold">
                {repairCount}
              </span>
            )}
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6">
          {activeTab === "overview" ? (
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
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">หน่วยงาน:</span>
                    <span className="font-medium text-slate-700 text-right">
                      {asset.section?.name || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">สถานที่ใช้งาน:</span>
                    <span className="font-medium text-slate-700 text-right">
                      {asset.section?.building || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">ผู้รับผิดชอบ:</span>
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
                <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-4">
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
                          {asset.acqType || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-emerald-700/70">ประเภทเงิน: </span>
                        <span className="font-bold text-emerald-900">
                          {asset.budgetType || "-"}
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
                        วันที่ตรวจรับ/เข้าสต็อก:
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
                        <span>-</span>
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
            /* Tab: ประวัติ (History) - เชื่อมต่อกับระบบประวัติการซ่อมของเพื่อน */
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-500 mb-1">
                <Wrench className="h-7 w-7 stroke-[1.5]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  ประวัติการซ่อมบำรุง ({repairCount} รายการ)
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  คลิกปุ่มด้านล่างเพื่อเปิดดูรายละเอียดและไทม์ไลน์ประวัติการซ่อมบำรุงของเครื่องนี้
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (asset) {
                    useAssetRepairHistoryModalStore.getState().openModal(asset);
                  }
                }}
                className="flex items-center gap-2 rounded-xl border border-sky-400 bg-sky-500 text-white px-5 py-2.5 text-xs sm:text-sm font-bold hover:bg-sky-600 transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                <Wrench className="h-4 w-4" />
                เปิดดูประวัติการซ่อม ({repairCount})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
