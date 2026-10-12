// =============================================================
// File: src/components/equipment-stock/EquipmentStockPrintDialog.tsx
// Dialog for selecting equipment stock print mode (Parcel role)
// =============================================================

import React, { useState } from "react";
import {
  Printer,
  X,
  FileSpreadsheet,
  Layers,
  FileText,
  CheckCircle2,
  Loader2,
  Sparkles,
  AlertTriangle,
  Archive,
  HelpCircle,
} from "lucide-react";
import type { Asset } from "../../types/TypeAsset";
import {
  printEquipmentStockReport,
  printEquipmentStockGroupedByStatusReport,
} from "../../services/assetPrintService";
import { getAllAssets } from "../../services/assetService";

export type EquipmentPrintMode = "current_tab" | "all_grouped" | "current_page";

interface EquipmentStockPrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: "ALL" | "WAIT_DISPOSAL" | "DISPOSAL" | "LOST";
  currentPageAssets: Asset[];
  effectiveStatusId?: number;
  selectedTypeId?: string;
  searchQuery?: string;
  dateRange?: Record<string, any>;
  userName?: string;
}

export const EquipmentStockPrintDialog: React.FC<
  EquipmentStockPrintDialogProps
> = ({
  isOpen,
  onClose,
  activeTab = "ALL",
  currentPageAssets,
  effectiveStatusId,
  selectedTypeId = "ALL",
  searchQuery = "",
  dateRange,
  userName = "เจ้าหน้าที่พัสดุ",
}) => {
  const [mode, setMode] = useState<EquipmentPrintMode>("current_tab");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const tabInfoMap = {
    ALL: {
      name: "รายการทั้งหมด",
      docTitle: "รายงานทะเบียนคุมสต็อกครุภัณฑ์ (งานพัสดุ)",
      description: "ดึงครุภัณฑ์ทั้งหมดในทะเบียนคุมพัสดุ พิมพ์รายงานภาพรวมสต็อก",
      icon: FileSpreadsheet,
    },
    WAIT_DISPOSAL: {
      name: "รอจำหน่าย",
      docTitle: "บัญชีรายการครุภัณฑ์รอจำหน่าย (ขออนุมัติจำหน่าย)",
      description: "พิมพ์บัญชีสำรวจครุภัณฑ์ชำรุดเสื่อมสภาพ พร้อมเหตุผล เพื่อเสนอขออนุมัติแทงจำหน่าย",
      icon: AlertTriangle,
    },
    DISPOSAL: {
      name: "จำหน่ายแล้ว",
      docTitle: "บัญชีรายการครุภัณฑ์ที่จำหน่ายแล้ว (ตัดจำหน่ายออกจากบัญชี)",
      description: "พิมพ์บัญชีรายการครุภัณฑ์ที่ตัดจำหน่ายออกจากทะเบียนคุมพัสดุเรียบร้อยแล้ว",
      icon: Archive,
    },
    LOST: {
      name: "สูญหาย",
      docTitle: "รายงานสรุปรายการครุภัณฑ์สูญหาย",
      description: "พิมพ์รายงานตรวจสอบและสรุปยอดครุภัณฑ์ที่แจ้งสูญหาย",
      icon: HelpCircle,
    },
  };

  const currentTabInfo = tabInfoMap[activeTab] || tabInfoMap.ALL;
  const CurrentTabIcon = currentTabInfo.icon;

  const handlePrint = async () => {
    setIsLoading(true);
    try {
      if (mode === "current_page") {
        // Print exactly what's visible right now
        const total = currentPageAssets.length;
        const normal = currentPageAssets.filter(
          (a) => a.status?.code === "NORMAL",
        ).length;
        const repair = currentPageAssets.filter(
          (a) =>
            a.status?.code === "DAMAGED" ||
            a.status?.code === "UNDER_REPAIR",
        ).length;
        const disposal = currentPageAssets.filter(
          (a) =>
            a.status?.code === "WAIT_DISPOSAL" ||
            a.status?.code === "DISPOSAL" ||
            a.status?.code === "DISPOSED" ||
            a.status?.code === "LOST",
        ).length;

        printEquipmentStockReport({
          title: `${currentTabInfo.docTitle} (เฉพาะหน้าที่แสดง)`,
          activeTab,
          filters: {
            search: searchQuery || undefined,
          },
          stats: { total, normal, repair, disposal },
          assets: currentPageAssets,
          context: {
            preparedBy: userName,
            preparedAt: new Date(),
          },
        });
        onClose();
        return;
      }

      if (mode === "current_tab") {
        // Fetch all assets for the current tab / status
        const filterParams: Record<string, any> = {};
        if (effectiveStatusId !== undefined) {
          filterParams.asset_status_id = effectiveStatusId;
        }
        if (selectedTypeId !== "ALL") {
          filterParams.asset_type_id = Number(selectedTypeId);
        }
        if (searchQuery.trim()) {
          filterParams.search = searchQuery.trim();
        }
        if (dateRange) {
          Object.assign(filterParams, dateRange);
        }

        const tabAssets = await getAllAssets(filterParams);

        const total = tabAssets.length;
        const normal = tabAssets.filter((a) => a.status?.code === "NORMAL").length;
        const repair = tabAssets.filter(
          (a) =>
            a.status?.code === "DAMAGED" ||
            a.status?.code === "UNDER_REPAIR",
        ).length;
        const disposal = tabAssets.filter(
          (a) =>
            a.status?.code === "WAIT_DISPOSAL" ||
            a.status?.code === "DISPOSAL" ||
            a.status?.code === "DISPOSED" ||
            a.status?.code === "LOST",
        ).length;

        printEquipmentStockReport({
          title: currentTabInfo.docTitle,
          activeTab,
          filters: {
            search: searchQuery || undefined,
          },
          stats: { total, normal, repair, disposal },
          assets: tabAssets,
          context: {
            preparedBy: userName,
            preparedAt: new Date(),
          },
        });
        onClose();
        return;
      }

      if (mode === "all_grouped") {
        // Fetch all assets and group by lifecycle status
        const allAssets = await getAllAssets();

        printEquipmentStockGroupedByStatusReport({
          title: "รายงานสต็อกครุภัณฑ์แยกตามสถานะวงจรชีวิต (งานพัสดุ)",
          assets: allAssets,
          context: {
            preparedBy: userName,
            preparedAt: new Date(),
          },
        });
        onClose();
        return;
      }
    } catch (err) {
      console.error("Equipment print export error:", err);
      alert("เกิดข้อผิดพลาดในการดึงข้อมูลสำหรับพิมพ์ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-linear-to-r from-emerald-50/50 to-teal-50/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                พิมพ์รายงานสต็อกครุภัณฑ์ (งานพัสดุ)
              </h3>
              <p className="text-xs text-slate-500">
                เลือกรูปแบบรายงานและขอบเขตข้อมูลที่ต้องการพิมพ์ออกเป็นเอกสาร / PDF
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <label className="block text-xs font-semibold text-slate-700 tracking-wider">
            เลือกรูปแบบการพิมพ์
          </label>

          {/* Option 1: Current Tab */}
          <div
            onClick={() => !isLoading && setMode("current_tab")}
            className={`relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              mode === "current_tab"
                ? "border-emerald-600 bg-emerald-50/40 shadow-xs ring-2 ring-emerald-600/10"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
            }`}
          >
            <div
              className={`mt-0.5 flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                mode === "current_tab"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <CurrentTabIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-800">
                    พิมพ์ตามแท็บปัจจุบัน: {currentTabInfo.name}
                  </h4>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <Sparkles className="w-2.5 h-2.5" /> แนะนำ
                  </span>
                </div>
                {mode === "current_tab" && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {currentTabInfo.description}
              </p>
            </div>
          </div>

          {/* Option 2: All Grouped by Status */}
          <div
            onClick={() => !isLoading && setMode("all_grouped")}
            className={`relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              mode === "all_grouped"
                ? "border-emerald-600 bg-emerald-50/40 shadow-xs ring-2 ring-emerald-600/10"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
            }`}
          >
            <div
              className={`mt-0.5 flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                mode === "all_grouped"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">
                  พิมพ์ทั้งหมด (แยกตามสถานะวงจรชีวิต)
                </h4>
                {mode === "all_grouped" && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ดึงครุภัณฑ์ทั้งหมดในระบบ จัดกลุ่มเรียงตามสถานะ (พร้อมใช้, ชำรุด/ส่งซ่อม, รอจำหน่าย, จำหน่ายแล้ว/สูญหาย)
              </p>
            </div>
          </div>

          {/* Option 3: Current Page Only */}
          <div
            onClick={() => !isLoading && setMode("current_page")}
            className={`relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              mode === "current_page"
                ? "border-emerald-600 bg-emerald-50/40 shadow-xs ring-2 ring-emerald-600/10"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
            }`}
          >
            <div
              className={`mt-0.5 flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                mode === "current_page"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">
                  พิมพ์เฉพาะหน้าที่กำลังแสดง ({currentPageAssets.length} รายการ)
                </h4>
                {mode === "current_page" && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                พิมพ์เฉพาะรายการในตาราง 10 รายการที่แสดงอยู่บนหน้าจอปัจจุบันทันที
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>กำลังโหลดข้อมูลทั้งหมด...</span>
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                <span>เปิดหน้าต่างพิมพ์ (Print / PDF)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
