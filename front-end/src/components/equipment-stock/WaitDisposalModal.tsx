import React, { useState, useEffect } from "react";
import { Camera, X, Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDisposalModalStore } from "../../stores/useDisposalModalStore";
import { updateAsset, getAssetStatuses } from "../../services/assetService";

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

export default function WaitDisposalModal() {
  const { isWaitDisposalOpen, waitDisposalAsset: asset, closeWaitDisposal } =
    useDisposalModalStore();
  const queryClient = useQueryClient();

  const [reason, setReason] = useState("");
  const [isReceivedBack, setIsReceivedBack] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isWaitDisposalOpen && asset) {
      setReason("ผู้บริหารไม่อนุมัติการซื้ออะไหล่เนื่องจากไม่คุ้มค่า");
      setIsReceivedBack(true);
      setImagePreview(null);
      setErrorMsg("");
    }
  }, [isWaitDisposalOpen, asset]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!asset) return;
      // Find WAIT_DISPOSAL status ID (default 4)
      const statuses = await getAssetStatuses();
      const waitStatus = statuses.find((s) => s.code === "WAIT_DISPOSAL");
      const statusId = waitStatus ? waitStatus.id : 4;

      await updateAsset(asset.id, {
        asset_status_id: statusId,
        remark: reason.trim(),
        ...(imagePreview && { imageUrl: imagePreview }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-assets-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-status"] });
      closeWaitDisposal();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    },
  });

  if (!isWaitDisposalOpen || !asset) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg("กรุณาระบุเหตุผลที่ต้องจำหน่าย");
      return;
    }
    if (!isReceivedBack) {
      setErrorMsg("กรุณายืนยันการรับตัวเครื่องคืนจากช่าง");
      return;
    }
    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={closeWaitDisposal}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-5 animate-in fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title matching Figma */}
        <div className="text-center">
          <h2 className="text-lg sm:text-xl font-bold text-[#ea580c]">
            บันทึกข้อมูลเพื่อรอจำหน่าย
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
            <span className="text-slate-400">ประเภท: </span>
            <span className="font-medium text-slate-800">
              {asset.type?.name || "-"}
            </span>
          </div>
          <div>
            <span className="text-slate-400">ยี่ห้อและรุ่น: </span>
            <span className="font-medium text-slate-800">
              {asset.model || "-"}
            </span>
          </div>
          <div>
            <span className="text-slate-400">หน่วยงานที่รับผิดชอบ: </span>
            <span className="font-medium text-slate-800">
              {asset.section?.name || "-"} {asset.section?.building || ""}
            </span>
          </div>
          <div>
            <span className="text-slate-400">วันที่รับ: </span>
            <span className="font-medium text-slate-800">
              {formatThaiDate(asset.receivedDate)}
            </span>{" "}
            | <span className="text-slate-400">หมดประกัน: </span>
            <span className="font-medium text-slate-800">
              {formatThaiDate(asset.warrantyDate)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason Field */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              เหตุผลที่ต้องจำหน่าย <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="(พิมพ์รายละเอียดเพิ่มเติม...)"
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {/* Confirm Receipt Checkbox */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              การยืนยันรับเครื่องคืน <span className="text-rose-500">*</span>
            </label>
            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-orange-400 bg-orange-50/30 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isReceivedBack}
                onChange={(e) => setIsReceivedBack(e.target.checked)}
                className="h-4 w-4 rounded accent-orange-600 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-800">
                ได้รับตัวเครื่องคืนจากช่างแล้ว (คลังพัสดุ)
              </span>
            </label>
          </div>

          {/* Attach Latest Condition Photo */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              แนบรูปภาพสภาพเครื่องล่าสุด <span className="text-rose-500">*</span>
            </label>
            {imagePreview ? (
              <div className="relative w-full h-36 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50">
                <img
                  src={imagePreview}
                  alt="สภาพเครื่อง"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/60 text-white hover:bg-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed border-slate-200 hover:border-orange-400 hover:bg-orange-50/10 cursor-pointer transition-all">
                <Camera className="h-6 w-6 text-slate-400 mb-1" />
                <span className="text-xs text-slate-400 font-medium">
                  อัปโหลดรูปภาพ
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
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
              onClick={closeWaitDisposal}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#ea580c] hover:bg-[#c2410c] text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {mutation.isPending ? "กำลังบันทึก..." : "ยืนยันรอจำหน่าย"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
