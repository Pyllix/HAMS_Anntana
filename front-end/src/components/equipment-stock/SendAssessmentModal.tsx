import React, { useState, useEffect } from "react";
import {
  ClipboardCheck,
  X,
  AlertCircle,
  Wrench,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDisposalModalStore } from "../../stores/useDisposalModalStore";
import { useToastStore } from "../../stores/useToastStore";
import { createRepairTicket } from "../../services/repairService";
import type { UrgencyStatus } from "../../types/TypeRepair";

const URGENCY_OPTIONS: {
  value: UrgencyStatus;
  label: string;
  desc: string;
  badgeClass: string;
  activeBorder: string;
}[] = [
  {
    value: "NORMAL",
    label: "ปกติ (Normal)",
    desc: "ประเมินตามคิวงานทั่วไป",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    activeBorder: "border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-300",
  },
  {
    value: "URGENT",
    label: "ด่วน (Urgent)",
    desc: "ต้องการผลประเมินเร่งด่วน",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    activeBorder: "border-amber-500 bg-amber-50/40 ring-1 ring-amber-300",
  },
  {
    value: "EMERGENCY",
    label: "ฉุกเฉิน (Emergency)",
    desc: "กระทบต่อการให้บริการทันที",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    activeBorder: "border-rose-500 bg-rose-50/40 ring-1 ring-rose-300",
  },
];

export default function SendAssessmentModal() {
  const {
    isSendAssessmentOpen,
    sendAssessmentAsset: asset,
    closeSendAssessment,
  } = useDisposalModalStore();

  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);

  const [symptom, setSymptom] = useState("");
  const [urgencyStatus, setUrgencyStatus] = useState<UrgencyStatus>("NORMAL");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isSendAssessmentOpen) {
      setSymptom("");
      setUrgencyStatus("NORMAL");
      setNote("");
      setErrorMsg("");
    }
  }, [isSendAssessmentOpen, asset]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!asset) return;

      const fullSymptom = note.trim()
        ? `${symptom.trim()}\nหมายเหตุเพิ่มเติม: ${note.trim()}`
        : symptom.trim();

      return await createRepairTicket({
        assetId: asset.id,
        symptom: fullSymptom,
        urgencyStatus,
        reportType: "Repair",
      });
    },
    onSuccess: () => {
      // Invalidate asset and technician repair queues
      queryClient.invalidateQueries({ queryKey: ["equipment-assets-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-status"] });
      queryClient.invalidateQueries({ queryKey: ["pendingEvaluations"] });
      queryClient.invalidateQueries({ queryKey: ["repairs"] });

      showToast("success", "ส่งประเมินสภาพครุภัณฑ์ไปยังช่างเรียบร้อยแล้ว");
      closeSendAssessment();
    },
    onError: (err: any) => {
      setErrorMsg(
        err?.response?.data?.message ||
          err?.message ||
          "เกิดข้อผิดพลาดในการส่งข้อมูลประเมินสภาพ",
      );
    },
  });

  if (!isSendAssessmentOpen || !asset) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!symptom.trim()) {
      setErrorMsg("กรุณาระบุรายละเอียดหรืออาการที่ต้องการให้ช่างประเมิน");
      return;
    }

    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={closeSendAssessment}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-5 animate-in fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                ส่งประเมินสภาพครุภัณฑ์
              </h2>
              <p className="text-xs text-slate-500">
                ส่งรายการไปยังช่างเพื่อตรวจเช็คและประเมินสภาพ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSendAssessment}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Equipment Summary Card */}
        <div className="rounded-2xl bg-slate-50/90 border border-slate-100 p-4 space-y-2 text-xs text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-1 pb-1 border-b border-slate-200/60">
            <div>
              <span className="text-slate-400">รหัสครุภัณฑ์: </span>
              <span className="font-semibold text-slate-900 font-mono">
                {asset.noid || asset.id}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              รอจำหน่าย
            </span>
          </div>

          <div className="font-bold text-slate-900 text-sm">
            {asset.name}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400">ยี่ห้อและรุ่น: </span>
              <span className="font-medium text-slate-800">
                {asset.model || "-"}
              </span>
            </div>
            <div>
              <span className="text-slate-400">หมายเลขเครื่อง: </span>
              <span className="font-mono font-medium text-slate-800">
                {asset.serialNo || "-"}
              </span>
            </div>
            <div>
              <span className="text-slate-400">หมวดหมู่: </span>
              <span className="font-medium text-slate-800">
                {asset.type?.name || "-"}
              </span>
            </div>
            <div>
              <span className="text-slate-400">หน่วยงาน: </span>
              <span className="font-medium text-slate-800">
                {asset.section?.name || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Urgency Status */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              ระดับความเร่งด่วน <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {URGENCY_OPTIONS.map((opt) => {
                const isSelected = urgencyStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setUrgencyStatus(opt.value)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer select-none ${
                      isSelected
                        ? opt.activeBorder
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <span
                      className={`text-xs font-bold ${
                        isSelected ? "text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {opt.label.split(" ")[0]}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Symptom / Assessment Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              รายละเอียดอาการ / สาเหตุที่ส่งประเมิน{" "}
              <span className="text-rose-500 font-bold">*</span>
            </label>
            <textarea
              rows={3}
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              placeholder="ระบุรายละเอียดอาการชำรุด หรือสาเหตุที่ต้องการให้ช่างประเมินความคุ้มค่าก่อนดำเนินการ..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Additional Note */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              หมายเหตุเพิ่มเติม (ถ้ามี)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น อะไหล่บางส่วนเริ่มหายาก, ส่งตรวจเช็คความพร้อมก่อนดำเนินการต่อ"
              className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeSendAssessment}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>กำลังส่งข้อมูล...</span>
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-4 h-4" />
                  <span>ยืนยันส่งประเมิน</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
