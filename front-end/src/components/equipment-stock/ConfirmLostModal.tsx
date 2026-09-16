import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDisposalModalStore } from "../../stores/useDisposalModalStore";
import { updateAsset, getAssetStatuses } from "../../services/assetService";

const formatThaiDate = (dateStr?: string | null) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
};

export default function ConfirmLostModal() {
  const { isMarkLostOpen, markLostAsset: asset, closeMarkLost } =
    useDisposalModalStore();
  const queryClient = useQueryClient();

  const [lostDate, setLostDate] = useState("");
  const [lastLocation, setLastLocation] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isMarkLostOpen) {
      const today = new Date().toISOString().split("T")[0];
      setLostDate(today);
      setLastLocation("");
      setLostReason("");
      setErrorMsg("");
    }
  }, [isMarkLostOpen, asset]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!asset) return;
      const statuses = await getAssetStatuses();
      const lostStatus = statuses.find((s) => s.code === "LOST");
      const statusId = lostStatus ? lostStatus.id : 6;

      const fullRemark = [
        lostReason.trim(),
        lastLocation.trim() ? `สถานที่ล่าสุด: ${lastLocation.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      await updateAsset(asset.id, {
        asset_status_id: statusId,
        remark: fullRemark || "สูญหาย",
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
    if (!lostReason.trim()) {
      setErrorMsg("กรุณาระบุรายละเอียดหรือหมายเหตุการสูญหาย");
      return;
    }
    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={closeMarkLost}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching image */}
        <div className="bg-rose-50/60 py-4 px-6 border-b border-rose-100 text-center">
          <h2 className="text-base sm:text-lg font-bold text-rose-700">
            บันทึกข้อมูลครุภัณฑ์สูญหาย
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Equipment Summary Card */}
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 text-xs space-y-1.5 text-slate-700 leading-relaxed">
            <div className="flex flex-wrap gap-x-2">
              <span className="text-slate-400">รหัสครุภัณฑ์:</span>
              <span className="font-bold text-slate-900 font-mono">
                {asset.noid || asset.id.slice(0, 8)}
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-semibold text-slate-900">{asset.name}</span>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <span className="text-slate-400">หมายเลขเครื่อง:</span>
              <span className="font-mono text-slate-800 font-medium">
                {asset.serialNo || "-"}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <span className="text-slate-400">ยี่ห้อและรุ่น:</span>
              <span className="text-slate-700">
                {asset.model || "-"} {asset.company?.name ? `/ ${asset.company.name}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <span className="text-slate-400">ประเภท:</span>
              <span className="text-slate-700">{asset.type?.name || "-"}</span>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <span className="text-slate-400">หน่วยงานที่รับผิดชอบ:</span>
              <span className="text-slate-700">
                {asset.section?.name || "-"} {asset.section?.building ? `(${asset.section.building})` : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <span className="text-slate-400">วันที่รับ:</span>
              <span className="text-slate-700">{formatThaiDate(asset.receivedDate)}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-400">หมดประกัน:</span>
              <span className="text-slate-700">{formatThaiDate(asset.warrantyDate)}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Field 1: วันที่ตรวจพบว่าสูญหาย */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                วันที่ตรวจพบว่าสูญหาย <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={lostDate}
                  onChange={(e) => setLostDate(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Field 2: สถานที่/หน่วยงานล่าสุดที่พบ */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                สถานที่/หน่วยงานล่าสุดที่พบ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={lastLocation}
                onChange={(e) => setLastLocation(e.target.value)}
                placeholder="เช่น หอผู้ป่วยหนัก (ICU)"
                className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Field 3: รายละเอียด/หมายเหตุการสูญหาย */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รายละเอียด/หมายเหตุการสูญหาย <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="ระบุเหตุการณ์ เช่น หาไม่พบระหว่างตรวจนับประจำปี..."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none"
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
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {mutation.isPending ? "กำลังบันทึก..." : "ยืนยันการสูญหาย"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
