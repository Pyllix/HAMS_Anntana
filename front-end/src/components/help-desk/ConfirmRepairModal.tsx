import React, { useState } from "react";
import {
  Check,
  X,
  ClipboardList,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  Wrench,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useRepairStore } from "../../stores/useRepairModalStore";
import { useAuthStore } from "../../stores/authStore";
import { createRepairTicket } from "../../services/repairService";
import type {
  ReportType,
  UrgencyStatus,
  CreateRepairDto,
} from "../../Types/TypeRepair";

export default function ConfirmRepairModal() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const { user, role } = useAuthStore();

  const {
    reportType,
    assetSearchInput,
    assetInfo,
    urgencyStatus,
    symptom,
    isConfirmModalOpen,
    closeConfirmModal,
    resetForm,
  } = useRepairStore();

  const userAvatarUrl = user?.imageUrl || null;
  const userInitial = user?.firstname
    ? user.firstname.charAt(0).toUpperCase()
    : "-";
  const userFullName =
    user?.firstname && user?.lastname
      ? `${user.firstname} ${user.lastname}`
      : user?.userName || "ไม่ระบุชื่อผู้ใช้งาน";
  const userRoleDisplay = role || user?.role || "GUEST";
  const mutation = useMutation({
    mutationFn: (dto: CreateRepairDto) => createRepairTicket(dto),
    onSuccess: () => {
      setIsSuccess(true);
    },
    onError: (error: any) => {
      const serverMessage =
        error?.response?.data?.message ||
        error?.message ||
        "เกิดข้อผิดพลาดในการส่งข้อมูล";
      setErrorMessage(serverMessage);
    },
  });

  const handleClose = () => {
    setErrorMessage(null);
    setIsSuccess(false);
    mutation.reset();
    closeConfirmModal();
    if (isSuccess) {
      resetForm();
    }
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

  const getReportTypeBadge = (type: ReportType) => {
    if (type === "Repair") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-[#00A96E] border border-emerald-200/80 font-bold text-xs">
          <Wrench className="w-3.5 h-3.5 text-[#00A96E]" />
          แจ้งซ่อมครุภัณฑ์ชำรุด (Repair)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/80 font-bold text-xs">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
        บำรุงรักษาตามรอบ (Maintenance)
      </span>
    );
  };

  const getUrgencyBadge = (status: UrgencyStatus | string) => {
    const urgency = status || "NORMAL";

    const getStatusStyle = (status: string) => {
      switch (status) {
        case "EMERGENCY":
          return "bg-rose-100 text-rose-700";
        case "URGENT":
          return "bg-amber-100 text-amber-700";
        case "NORMAL":
        default:
          return "bg-slate-100 text-slate-700";
      }
    };

    const labelMap: Record<string, string> = {
      EMERGENCY: "ด่วนมาก",
      URGENT: "ด่วน",
      NORMAL: "ปกติ",
    };

    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${getStatusStyle(
          urgency,
        )}`}
      >
        {labelMap[urgency] || "ปกติ"}
      </span>
    );
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
      <div
        className={`bg-white rounded-3xl shadow-2xl border border-slate-100 w-full overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95 ${
          isSuccess ? "max-w-sm" : "max-w-3xl"
        }`}
      >
        {/*หน้ายืนยันข้อมูล*/}
        {!isSuccess ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-6 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-[#00A96E]">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    ยืนยันข้อมูลการแจ้งซ่อม
                  </h3>
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
                  <span className="font-bold block">
                    ไม่สามารถบันทึกข้อมูลได้
                  </span>
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Body Content */}
            <div className="p-7 grid grid-cols-1 md:grid-cols-5 gap-5 max-h-[72vh] overflow-y-auto">
              {/* ฝั่งซ้าย: กล่องการแจ้งซ่อม */}
              <div className="md:col-span-3 bg-slate-50/60 border border-slate-100 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm pb-2 border-b border-slate-200/50">
                  <ClipboardList className="w-4 h-4 text-amber-700" />
                  <span>ข้อมูลรายละเอียดการแจ้งซ่อม</span>
                </div>

                <div className="grid grid-cols-3 gap-2 items-center text-xs">
                  <span className="text-slate-500 font-medium">
                    ประเภทการแจ้ง
                  </span>
                  <span className="col-span-2">
                    {getReportTypeBadge(reportType)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 items-center text-xs">
                  <span className="text-slate-500 font-medium">
                    รหัสครุภัณฑ์
                  </span>
                  <span className="col-span-2 font-bold text-slate-900 text-sm">
                    {assetInfo?.assetCode || assetSearchInput || "-"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 items-start text-xs">
                  <span className="text-slate-500 font-medium pt-0.5">
                    ชื่อครุภัณฑ์
                  </span>
                  <span className="col-span-2 font-semibold text-slate-800 leading-snug">
                    {assetInfo?.assetName || "-"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 items-start text-xs">
                  <span className="text-slate-500 font-medium pt-0.5">
                    สถานที่ตั้ง
                  </span>
                  <span className="col-span-2 font-semibold text-slate-800 leading-snug">
                    {assetInfo?.location || "-"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 items-center text-xs">
                  <span className="text-slate-500 font-medium">
                    ความเร่งด่วน
                  </span>
                  <span className="col-span-2">
                    {getUrgencyBadge(urgencyStatus)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 items-start pt-1 text-xs">
                  <span className="text-slate-500 font-medium pt-2">
                    อาการเสีย
                  </span>
                  <div className="col-span-2 min-h-[80px] p-3.5 bg-white border border-slate-200/80 rounded-xl text-slate-800 font-medium leading-relaxed whitespace-pre-wrap shadow-2xs">
                    {symptom || "-"}
                  </div>
                </div>
              </div>

              {/* ฝั่งขวา: ข้อมูลผู้ทำรายการและสถานะระบบ*/}
              <div className="md:col-span-2 bg-emerald-50/30 border border-emerald-200/60 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="space-y-3.5 text-xs">
                    <div>
                      <span className="text-slate-500 font-bold block mb-2">
                        วันและเวลาที่แจ้ง
                      </span>
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
                          <span className="text-amber-800">
                            {currentTime} น.
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-dashed border-emerald-200/80">
                      <span className="text-slate-500 font-bold block mb-2.5">
                        ผู้ทำรายการแจ้งซ่อม
                      </span>
                      <div className="flex items-center gap-3">
                        {/* แสดงรูปโปรไฟล์จริงจาก imageUrl ถ้าไม่มีรูปจะใช้ Avatar ตัวอักษรแทน */}
                        {userAvatarUrl ? (
                          <img
                            src={userAvatarUrl}
                            alt={userFullName}
                            className="w-9 h-9 rounded-full object-cover border border-emerald-300 shadow-xs shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#00A96E] text-white flex items-center justify-center font-bold text-sm shrink-0">
                            {userInitial}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-[#00A96E] text-xs leading-tight">
                            {userFullName}
                          </p>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                            {userRoleDisplay}
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
            <div className="flex items-center justify-end gap-3 px-7 py-4 bg-white border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                disabled={mutation.isPending}
                className="h-9 px-5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                {errorMessage ? "ปิดหน้าต่าง" : "แก้ไขข้อมูล"}
              </button>
              {!errorMessage && (
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={mutation.isPending}
                  className="h-9 flex items-center gap-2 px-6 rounded-lg bg-[#00A96E] text-white text-xs font-medium hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {mutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  )}
                  ยืนยันการแจ้ง
                </button>
              )}
            </div>
          </>
        ) : (
          /* หน้าส่งข้อมูลสำเร็จ*/
          <div className="relative overflow-hidden p-8 text-center bg-gradient-to-b from-emerald-50/60 via-white to-white">
            {/* Soft Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-emerald-200/40 rounded-full blur-2xl pointer-events-none" />

            {/* Checkmark Icon with Pulsing Effect */}
            <div className="relative mx-auto mb-5 flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 border-4 border-white shadow-lg shadow-emerald-500/10 text-[#00A96E] animate-in zoom-in-50 duration-300">
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping opacity-75" />
              <CheckCircle2 className="w-9 h-9 stroke-[2.2] relative z-10" />
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5 mb-6 relative z-10">
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">
                ส่งข้อมูลแจ้งซ่อมเรียบร้อยแล้ว
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[260px] mx-auto">
                ระบบบันทึกรายการเข้าสู่ระบบแล้ว <br />
                เจ้าหน้าที่จะดำเนินการตรวจสอบโดยเร็วที่สุด
              </p>
            </div>

            {/* Mini Summary Badge */}
            <div className="mb-6 mx-auto max-w-[280px] p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-left text-xs">
              <span className="text-slate-400 font-medium">รหัสครุภัณฑ์:</span>
              <span className="font-bold text-slate-700 font-mono">
                {assetInfo?.assetCode || assetSearchInput || "-"}
              </span>
            </div>

            {/* Confirm Button */}
            <div className="relative z-10">
              <button
                type="button"
                onClick={handleClose}
                className="w-full h-10 px-6 rounded-xl bg-[#00A96E] hover:bg-emerald-700 text-white text-xs font-semibold transition-all duration-200 shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 cursor-pointer active:scale-95"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
