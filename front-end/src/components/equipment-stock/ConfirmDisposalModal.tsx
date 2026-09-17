import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDisposalModalStore } from "../../stores/useDisposalModalStore";
import { updateAsset, getAssetStatuses } from "../../services/assetService";

const DISPOSAL_REASONS = [
  {
    id: "DAMAGED",
    title: "ชำรุด / เสียหาย",
    desc: "ซ่อมไม่คุ้มค่า หรือซ่อมไม่ได้",
  },
  {
    id: "EXPIRED",
    title: "เสื่อมสภาพตามอายุ",
    desc: "ใช้งานมานานจนหมดอายุการใช้งาน",
  },
  {
    id: "TRANSFER",
    title: "โอน / บริจาค",
    desc: "โอนให้หน่วยงานอื่นตามระเบียบ",
  },
  {
    id: "AUCTION",
    title: "ขายทอดตลาด",
    desc: "ดำเนินการประมูลขายพัสดุเสื่อมสภาพ",
  },
];

export default function ConfirmDisposalModal() {
  const {
    isConfirmDisposalOpen,
    confirmDisposalAsset: asset,
    closeConfirmDisposal,
  } = useDisposalModalStore();
  const queryClient = useQueryClient();

  const [selectedReason, setSelectedReason] = useState("DAMAGED");
  const [additionalNote, setAdditionalNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isConfirmDisposalOpen) {
      setSelectedReason("DAMAGED");
      setAdditionalNote("");
      setErrorMsg("");
    }
  }, [isConfirmDisposalOpen]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!asset) return;
      const statuses = await getAssetStatuses();
      const dispStatus = statuses.find((s) => s.code === "DISPOSAL");
      const statusId = dispStatus ? dispStatus.id : 5;

      const reasonObj = DISPOSAL_REASONS.find((r) => r.id === selectedReason);
      const fullRemark = additionalNote.trim()
        ? `${reasonObj?.title} - ${additionalNote.trim()}`
        : (reasonObj?.title || "");

      await updateAsset(asset.id, {
        asset_status_id: statusId,
        remark: fullRemark,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-assets-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-status"] });
      closeConfirmDisposal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    },
  });

  if (!isConfirmDisposalOpen || !asset) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={closeConfirmDisposal}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-5 animate-in fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title matching Figma */}
        <div className="text-center">
          <h2 className="text-lg sm:text-xl font-bold text-rose-600">
            ยืนยันการอนุมัติจำหน่ายครุภัณฑ์
          </h2>
        </div>

        {/* Equipment Summary Card */}
        <div className="rounded-2xl bg-slate-50/90 border border-slate-100 p-4 space-y-1.5 text-xs text-slate-700">
          <div>
            <span className="text-slate-400">รหัสครุภัณฑ์: </span>
            <span className="font-semibold text-slate-900 font-mono">
              {asset.noid || asset.id}
            </span>{" "}
            | <span className="font-bold text-slate-900">{asset.name}</span>
          </div>
          <div>
            <span className="text-slate-400">หมายเลขเครื่อง: </span>
            <span className="font-mono font-medium text-slate-800">
              {asset.serialNo || "-"}
            </span>
          </div>
          <div>
            <span className="text-slate-400">ยี่ห้อและรุ่น: </span>
            <span className="font-medium text-slate-800">
              {asset.model || "-"}
            </span>
          </div>
          <div>
            <span className="text-slate-400">ประเภท: </span>
            <span className="font-medium text-slate-800">
              {asset.type?.name || "-"}
            </span>
          </div>
          <div>
            <span className="text-slate-400">ราคาจัดซื้อ: </span>
            <span className="font-semibold text-slate-900">
              {Number(asset.price || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              บาท
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Write-off Reason Radio Cards Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              ระบุสาเหตุการจำหน่าย (Write-off Reason) <span className="text-rose-500">*</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DISPOSAL_REASONS.map((r) => {
                const isSelected = selectedReason === r.id;
                return (
                  <label
                    key={r.id}
                    onClick={() => setSelectedReason(r.id)}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                      isSelected
                        ? "border-rose-400 bg-rose-50/40 ring-1 ring-rose-300"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="pt-0.5 shrink-0">
                      <div
                        className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? "border-rose-600 bg-white"
                            : "border-slate-300"
                        }`}
                      >
                        {isSelected && (
                          <div className="h-2 w-2 rounded-full bg-rose-600" />
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4
                        className={`text-xs font-bold ${
                          isSelected ? "text-rose-700" : "text-slate-800"
                        }`}
                      >
                        {r.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                        {r.desc}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              หมายเหตุเพิ่มเติม
            </label>
            <input
              type="text"
              value={additionalNote}
              onChange={(e) => setAdditionalNote(e.target.value)}
              placeholder="ระบุรายละเอียดเพิ่มเติม..."
              className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
            />
          </div>

          {errorMsg && (
            <p className="text-xs font-medium text-rose-500 text-center">
              {errorMsg}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeConfirmDisposal}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {mutation.isPending ? "กำลังบันทึก..." : "ยืนยันการจำหน่าย"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
