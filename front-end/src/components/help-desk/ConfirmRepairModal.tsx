import React, { useState } from "react";
import { Check, X, ClipboardList, Calendar, Clock, Loader2, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useRepairStore } from "../../stores/useRepairModalStore";
import { createRepairTicket } from "../../services/repairService";
import type { MainCategory, ReportType, UrgencyStatus, CreateRepairDto } from "../../Types/TypeRepair";

export default function ConfirmRepairModal() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    mainCategory,
    reportType,
    assetSearchInput,
    assetInfo,
    urgencyStatus,
    symptom,
    isConfirmModalOpen,
    closeConfirmModal,
    resetForm,
  } = useRepairStore();

  const mutation = useMutation({
    mutationFn: (dto: CreateRepairDto) => createRepairTicket(dto),
    onSuccess: () => {
      alert("ส่งข้อมูลแจ้งซ่อมเรียบร้อยแล้ว");
      handleClose();
      resetForm();
    },
    onError: (error: any) => {
      const serverMessage =
        error?.response?.data?.message || error?.message || "เกิดข้อผิดพลาดในการส่งข้อมูล";
      setErrorMessage(serverMessage);
    },
  });

  const handleClose = () => {
    setErrorMessage(null);
    mutation.reset();
    closeConfirmModal();
  };

  if (!isConfirmModalOpen) return null;

  const handleFinalSubmit = () => {
    setErrorMessage(null);
    const targetAssetId = assetInfo?.assetId || assetSearchInput;

    if (!targetAssetId) {
      setErrorMessage("ไม่พบข้อมูลรหัสครุภัณฑ์");
      return;
    }

    const payload: CreateRepairDto = {
      assetId: targetAssetId.trim(),
      symptom: symptom.trim(),
      urgencyStatus,
      reportType,
    };

    mutation.mutate(payload);
  };

  // Helper Functions สำหรับแปลง Label และ Badge
  const getCategoryLabel = (cat: MainCategory) => {
    switch (cat) {
      case "MEDICAL":
        return "ซ่อมเครื่องมือแพทย์";
      case "GENERAL":
        return "ซ่อมบำรุงทั่วไป";
      case "COMPUTER":
        return "ซ่อมคอมพิวเตอร์";
      default:
        return cat;
    }
  };

  const getReportTypeLabel = (type: ReportType) => {
    return type === "Repair"
      ? "แจ้งซ่อมครุภัณฑ์ชำรุด (Repair)"
      : "บำรุงรักษาตามรอบ (Maintenance)";
  };

  const getUrgencyBadge = (status: UrgencyStatus | string) => {
    switch (status) {
      case "EMERGENCY":
      case "HIGH_URGENT":
        return (
          <span className="px-3 py-1 rounded-md text-xs font-semibold bg-rose-100 text-rose-700 inline-block">
            ฉุกเฉิน / ด่วนมาก (EMERGENCY)
          </span>
        );
      case "URGENT":
        return (
          <span className="px-3 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-700 inline-block">
            ด่วน (URGENT)
          </span>
        );
      case "NORMAL":
      default:
        return (
          <span className="px-3 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 inline-block">
            ปกติ
          </span>
        );
    }
  };

  const currentDate = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const currentTime = new Date().toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-6 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-[#00A96E]">
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">ยืนยันข้อมูลการแจ้งซ่อม</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                กรุณาตรวจสอบความถูกต้องของข้อมูลก่อนบันทึกเข้าสู่ระบบ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={mutation.isPending}
            className="w-8 h-8 rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Display Error Alert */}
        {errorMessage && (
          <div className="mx-7 mt-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <div className="text-xs space-y-1">
              <span className="font-bold block">ไม่สามารถบันทึกข้อมูลได้</span>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="p-7 grid grid-cols-1 md:grid-cols-5 gap-5 max-h-[72vh] overflow-y-auto">
          {/* ฝั่งซ้าย: กล่องการแจ้งซ่อม (3 cols) */}
          <div className="md:col-span-3 bg-slate-50/60 border border-slate-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm pb-2 border-b border-slate-200/50">
              <ClipboardList className="w-4 h-4 text-amber-700" />
              <span>ข้อมูลรายละเอียดการแจ้งซ่อม</span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-slate-500 font-medium">กลุ่มงานรับผิดชอบ</span>
                <span className="col-span-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-xl bg-emerald-50 text-[#00A96E] font-semibold border border-emerald-200/60">
                    {getCategoryLabel(mainCategory)}
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-slate-500 font-medium">ประเภทการแจ้ง</span>
                <span className="col-span-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-xl bg-emerald-50/60 text-[#00A96E] font-medium border border-emerald-200/60">
                    {getReportTypeLabel(reportType)}
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-slate-500 font-medium">รหัสครุภัณฑ์</span>
                <span className="col-span-2 font-bold text-slate-900 text-sm">
                  {assetInfo?.assetCode || assetSearchInput || "-"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 items-start">
                <span className="text-slate-500 font-medium pt-0.5">ชื่อครุภัณฑ์</span>
                <span className="col-span-2 font-semibold text-slate-800 leading-snug">
                  {assetInfo?.assetName || "-"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 items-start">
                <span className="text-slate-500 font-medium pt-0.5">สถานที่ตั้ง</span>
                <span className="col-span-2 font-semibold text-slate-800 leading-snug">
                  {assetInfo?.location || "-"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-slate-500 font-medium">ความเร่งด่วน</span>
                <span className="col-span-2">{getUrgencyBadge(urgencyStatus)}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 items-start pt-1">
                <span className="text-slate-500 font-medium pt-2">อาการเสีย</span>
                <div className="col-span-2 min-h-[80px] p-3.5 bg-white border border-slate-200/80 rounded-xl text-slate-800 font-medium leading-relaxed whitespace-pre-wrap shadow-2xs">
                  {symptom || "-"}
                </div>
              </div>
            </div>
          </div>

          {/* ฝั่งขวา: ข้อมูลผู้ทำรายการและสถานะระบบ (2 cols) */}
          <div className="md:col-span-2 bg-emerald-50/30 border border-emerald-200/60 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-slate-500 font-bold block mb-2">วันและเวลาที่แจ้ง</span>
                  <div className="space-y-2 text-slate-800 font-bold">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[#00A96E] shrink-0">
                        <Calendar className="w-3 h-3 stroke-[2.5]" />
                      </div>
                      <span>{currentDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[#00A96E] shrink-0">
                        <Clock className="w-3 h-3 stroke-[2.5]" />
                      </div>
                      <span className="text-amber-800">{currentTime} น.</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-dashed border-emerald-200/80">
                  <span className="text-slate-500 font-bold block mb-2.5">ผู้ทำรายการแจ้งซ่อม</span>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#00A96E] text-white flex items-center justify-center font-bold text-sm shrink-0">
                      ธ
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xs leading-tight">
                        ธนากร เจ้าหน้าที่ศูนย์ครุภัณฑ์
                      </p>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        ASSET_CENTER_STAFF
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Box */}
            <div className="p-3 bg-white border border-emerald-200/80 rounded-xl text-center shadow-2xs">
              <div className="inline-flex items-center gap-2 text-[#00A96E] font-bold text-xs">
                <span className="w-2 h-2 rounded-full bg-[#00A96E]"></span>
                สถานะ: รอยืนยันการส่งข้อมูล
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-7 py-5 bg-white border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={mutation.isPending}
            className="px-7 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            {errorMessage ? "ปิดหน้าต่าง" : "แก้ไขข้อมูล"}
          </button>
          {!errorMessage && (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-[#00A96E] text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4 stroke-[3]" />
              )}
              ยืนยันการแจ้ง
            </button>
          )}
        </div>
      </div>
    </div>
  );
}