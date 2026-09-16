import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDisposalModalStore } from "../../stores/useDisposalModalStore";
import { updateAsset, getAssetStatuses } from "../../services/assetService";

export default function ConfirmLostModal() {
  const { isMarkLostOpen, markLostAsset: asset, closeMarkLost } =
    useDisposalModalStore();
  const queryClient = useQueryClient();

  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isMarkLostOpen) {
      setNote("");
      setErrorMsg("");
    }
  }, [isMarkLostOpen]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!asset) return;
      const statuses = await getAssetStatuses();
      const lostStatus = statuses.find((s) => s.code === "LOST");
      const statusId = lostStatus ? lostStatus.id : 6;

      await updateAsset(asset.id, {
        asset_status_id: statusId,
        remark: note.trim() || "ปรับสถานะเป็นสูญหาย",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-assets-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-status"] });
      closeMarkLost();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    },
  });

  if (!isMarkLostOpen || !asset) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={closeMarkLost}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 animate-in fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            ยืนยันการปรับสถานะเป็นสูญหาย
          </h2>
          <p className="text-xs text-slate-500">
            คุณต้องการปรับสถานะครุภัณฑ์นี้เป็น "สูญหาย" ใช่หรือไม่?
          </p>
        </div>

        {/* Equipment Summary Card */}
        <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100 text-xs space-y-1 text-slate-700">
          <div>
            <span className="text-slate-400">รหัสครุภัณฑ์: </span>
            <span className="font-semibold text-slate-900 font-mono">
              {asset.noid || asset.id}
            </span>
          </div>
          <div>
            <span className="text-slate-400">ชื่อครุภัณฑ์: </span>
            <span className="font-semibold text-slate-900">{asset.name}</span>
          </div>
          <div>
            <span className="text-slate-400">หมายเลขเครื่อง: </span>
            <span className="font-mono text-slate-800">
              {asset.serialNo || "-"}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              หมายเหตุ / บันทึกเพิ่มเติม
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ระบุสาเหตุหรือรายละเอียดการสูญหาย..."
              className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
          </div>

          {errorMsg && (
            <p className="text-xs font-medium text-rose-500 text-center">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeMarkLost}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {mutation.isPending ? "กำลังบันทึก..." : "ยืนยันปรับเป็นสูญหาย"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
