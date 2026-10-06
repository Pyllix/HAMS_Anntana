import React, { useState, useEffect } from "react";
import { AlertOctagon, X, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requestAssetDisposal } from "../../services/assetViabilityService";
import { useToastStore } from "../../stores/useToastStore";
import type { DisposalPrefillData } from "../../types/TypeAssetViability";

interface RequestDisposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillData: DisposalPrefillData | null;
  onSuccess?: () => void;
}

export default function RequestDisposalModal({
  isOpen,
  onClose,
  prefillData,
  onSuccess,
}: RequestDisposalModalProps) {
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);

  const [reason, setReason] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen && prefillData) {
      setReason(prefillData.suggestedDisposalReason || "");
      setStorageLocation("ห้องพักพัสดุรอจำหน่าย อาคาร A");
      setErrorMsg("");
    }
  }, [isOpen, prefillData]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!prefillData) return;
      return await requestAssetDisposal(prefillData.assetId, {
        reason: reason.trim(),
        storageLocation: storageLocation.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-viability-list"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-assets-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-status"] });
      showToast(
        "success",
        "ปรับสถานะเป็น 'รอจำหน่าย' (WAIT_DISPOSAL) และล็อกห้ามยืมเรียบร้อยแล้ว",
      );
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      setErrorMsg(
        err?.response?.data?.message ||
          err?.message ||
          "เกิดข้อผิดพลาดในการเสนอขอแทงจำหน่าย",
      );
    },
  });

  if (!isOpen || !prefillData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!reason.trim()) {
      setErrorMsg("กรุณาระบุเหตุผลประกอบการเสนอขอแทงจำหน่าย");
      return;
    }

    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-5 animate-in fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                เสนอขอแทงจำหน่ายครุภัณฑ์
              </h2>
              <p className="text-xs text-slate-500">
                ปรับสถานะเป็น "รอจำหน่าย" (WAIT_DISPOSAL) และล็อกการใช้งาน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Equipment Summary Card */}
        <div className="rounded-2xl bg-slate-50/90 border border-slate-100 p-4 space-y-2 text-xs text-slate-700">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
            <div>
              <span className="text-slate-400">รหัสครุภัณฑ์: </span>
              <span className="font-semibold text-slate-900 font-mono">
                {prefillData.noid || prefillData.assetId}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
              ไม่คุ้มค่าซ่อม (UNVIABLE)
            </span>
          </div>

          <div className="font-bold text-slate-900 text-sm">
            {prefillData.name}
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
            <div>
              <span className="text-slate-400 block">ราคาจัดซื้อ:</span>
              <span className="font-semibold text-slate-800">
                ฿{prefillData.price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">ค่าซ่อมสะสม:</span>
              <span className="font-semibold text-rose-600">
                ฿{prefillData.cumulativeRepairCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">สัดส่วนค่าซ่อม:</span>
              <span className="font-bold text-rose-600">
                {prefillData.costRatioPercentage !== null
                  ? `${prefillData.costRatioPercentage.toFixed(1)}%`
                  : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              เหตุผลประกอบการเสนอแทงจำหน่าย{" "}
              <span className="text-rose-500 font-bold">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ระบุเหตุผลและหลักเกณฑ์การแทงจำหน่าย..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none leading-relaxed"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              สถานที่จัดเก็บครุภัณฑ์ชำรุดรอจำหน่าย
            </label>
            <input
              type="text"
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              placeholder="เช่น ห้องพักพัสดุรอจำหน่าย อาคาร A ชั้น 1"
              className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <span>ยืนยันเสนอแทงจำหน่าย</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
