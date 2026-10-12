// =============================================================
// File: src/components/asset-stock/AssetStockPrintDialog.tsx
// Dialog for selecting asset stock print mode (Department / All / Current Page)
// =============================================================

import React, { useState } from "react";
import {
  Printer,
  X,
  Building2,
  Layers,
  FileText,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { Asset, Section } from "../../types/TypeAsset";
import {
  printAssetStockReport,
  printAssetStockGroupedByDepartmentReport,
} from "../../services/assetPrintService";
import { getAllAssets } from "../../services/assetService";

export type PrintMode = "department" | "all_grouped" | "current_page";

interface AssetStockPrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // Current view context
  currentPageAssets: Asset[];
  sections: Section[];
  selectedSectionId?: string;
  searchQuery?: string;
  // User info
  userName?: string;
}

export const AssetStockPrintDialog: React.FC<AssetStockPrintDialogProps> = ({
  isOpen,
  onClose,
  currentPageAssets,
  sections,
  selectedSectionId = "ALL",
  searchQuery = "",
  userName = "เจ้าหน้าที่ศูนย์ครุภัณฑ์",
}) => {
  // Mode: department / all_grouped / current_page
  const [mode, setMode] = useState<PrintMode>("department");
  // Chosen department when mode === 'department'
  const [targetSectionId, setTargetSectionId] = useState<string>(
    selectedSectionId !== "ALL" ? selectedSectionId : sections[0]?.id || "",
  );
  // Loading state while fetching all pages
  const [isLoading, setIsLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentSection = sections.find((s) => s.id === targetSectionId);

  const handlePrint = async () => {
    setIsLoading(true);
    try {
      if (mode === "current_page") {
        // Print exactly what's visible right now
        const total = currentPageAssets.length;
        const normal = currentPageAssets.filter(
          (a) => a.status?.code === "NORMAL",
        ).length;
        const underRepair = currentPageAssets.filter(
          (a) => a.status?.code === "UNDER_REPAIR",
        ).length;
        const damaged = currentPageAssets.filter(
          (a) => a.status?.code === "DAMAGED",
        ).length;
        const repair = underRepair + damaged;
        const disposal = currentPageAssets.filter(
          (a) =>
            a.status?.code === "WAIT_DISPOSAL" ||
            a.status?.code === "DISPOSED" ||
            a.status?.code === "LOST",
        ).length;

        printAssetStockReport({
          title: "รายงานสต็อกครุภัณฑ์ (เฉพาะหน้าที่แสดง)",
          subtitle: "ภาพรวมศูนย์บริหารจัดการสินทรัพย์ (Asset Center)",
          filters: {
            search: searchQuery || undefined,
            sectionName:
              selectedSectionId !== "ALL"
                ? sections.find((s) => s.id === selectedSectionId)?.name
                : undefined,
          },
          stats: { total, normal, repair, underRepair, damaged, disposal },
          assets: currentPageAssets,
          context: {
            preparedBy: userName,
            preparedAt: new Date(),
          },
        });
        onClose();
        return;
      }

      if (mode === "department") {
        // Fetch all assets for the selected department
        const deptAssets = await getAllAssets({
          section_id: targetSectionId,
        });

        const total = deptAssets.length;
        const normal = deptAssets.filter(
          (a) => a.status?.code === "NORMAL",
        ).length;
        const underRepair = deptAssets.filter(
          (a) => a.status?.code === "UNDER_REPAIR",
        ).length;
        const damaged = deptAssets.filter(
          (a) => a.status?.code === "DAMAGED",
        ).length;
        const repair = underRepair + damaged;
        const disposal = deptAssets.filter(
          (a) =>
            a.status?.code === "WAIT_DISPOSAL" ||
            a.status?.code === "DISPOSED" ||
            a.status?.code === "LOST",
        ).length;

        const secName = currentSection?.name || "ระบุแผนก";
        const building = currentSection?.building
          ? `อาคาร${currentSection.building}`
          : "";

        printAssetStockReport({
          title: `รายงานสต็อกครุภัณฑ์ประจำแผนก ${secName}`,
          subtitle: building ? `สถานที่/อาคาร: ${building}` : undefined,
          filters: {
            sectionName: secName,
          },
          stats: { total, normal, repair, underRepair, damaged, disposal },
          assets: deptAssets,
          context: {
            preparedBy: userName,
            preparedAt: new Date(),
          },
        });
        onClose();
        return;
      }

      if (mode === "all_grouped") {
        // Fetch all assets across all departments
        const allAssets = await getAllAssets();

        printAssetStockGroupedByDepartmentReport({
          title: "รายงานสรุปสต็อกครุภัณฑ์แยกตามแผนก",
          subtitle:
            "ศูนย์บริหารจัดการสินทรัพย์ (Asset Center) • สรุปรายการตามหน่วยงาน",
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
      console.error("Print export error:", err);
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
                พิมพ์รายงานสต็อกครุภัณฑ์
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
        <div className="p-6 space-y-5">
          {/* Option Cards */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 tracking-wider">
              เลือกรูปแบบการพิมพ์
            </label>

            {/* Option 1: Selected Department */}
            <div
              onClick={() => !isLoading && setMode("department")}
              className={`relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                mode === "department"
                  ? "border-emerald-600 bg-emerald-50/40 shadow-xs ring-2 ring-emerald-600/10"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div
                className={`mt-0.5 flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                  mode === "department"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800">
                    พิมพ์เฉพาะแผนกที่เลือก
                  </h4>
                  {mode === "department" && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  ดึงข้อมูลครุภัณฑ์ทั้งหมดของแผนกนั้นๆ พร้อมข้อมูลสรุปยอดและช่องลงนาม
                </p>

                {/* Sub-selector for Department */}
                {mode === "department" && (
                  <div
                    className="mt-3 pt-3 border-t border-emerald-100 animate-in fade-in duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label className="block text-xs font-semibold text-emerald-900 mb-1.5">
                      เลือกแผนก / หน่วยงาน:
                    </label>
                    <select
                      value={targetSectionId}
                      onChange={(e) => setTargetSectionId(e.target.value)}
                      disabled={isLoading}
                      className="w-full text-xs font-medium bg-white text-slate-700 rounded-lg border border-emerald-300 px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.building ? `(อาคาร ${s.building})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Option 2: All Departments (Grouped) */}
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
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-800">
                      พิมพ์ทั้งหมด (แบ่งแยกตามแผนก)
                    </h4>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      <Sparkles className="w-2.5 h-2.5" /> แนะนำ
                    </span>
                  </div>
                  {mode === "all_grouped" && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  ดึงครุภัณฑ์ทุกแผนกในระบบ จัดกลุ่มเรียงตามแผนก พร้อมตารางสรุปยอดแยกแต่ละหน่วยงาน
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
                <p className="text-xs text-slate-500 mt-0.5">
                  พิมพ์เฉพาะรายการตาราง 10 รายการที่แสดงอยู่บนหน้าจอในปัจจุบันทันที (ไม่ต้องโหลดใหม่)
                </p>
              </div>
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
