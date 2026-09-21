import { CheckCircle2, Loader2, Package, X } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompleteReturnModalStore } from "../../stores/useCompleteReturnModalStore";
import {
  completeReturn,
  getBorrowErrorMessage,
} from "../../services/borrowService";

export default function CompleteReturnModal() {
  const { closeForm, selectedTransaction: transaction } =
    useCompleteReturnModalStore();

  const queryClient = useQueryClient();
  const [conditionStatus, setConditionStatus] = useState<"Normal" | "Damage">(
    "Normal",
  );
  const [returnRemark, setReturnRemark] = useState("");

  const { mutate: handleComplete, isPending: isSubmitting } = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      completeReturn(id, {
        returnCondition: conditionStatus,
        returnRemark: returnRemark || undefined,
      }),
    onSuccess: () => {
      alert("บันทึกตรวจรับครุภัณฑ์เข้าคลังเรียบร้อยแล้ว");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["borrowHistory"] });
      closeForm();
    },
    onError: (err: any) => {
      alert(getBorrowErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!transaction?.id) {
      alert("ไม่พบข้อมูลรายการคืนที่เลือก");
      return;
    }

    handleComplete({ id: transaction.id });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-800/60 backdrop-blur-sm animate-fadeIn"
      onClick={closeForm}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden text-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-4">
          <h2 className="text-xl font-bold text-gray-800">
            ตรวจรับครุภัณฑ์เข้าคลัง
          </h2>
          <button
            type="button"
            onClick={closeForm}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-8 py-2 flex flex-col gap-4 overflow-y-auto max-h-[calc(85vh-160px)]">
          {/* Card แสดงรายละเอียดรายการที่เลือก */}
          <div className="flex items-start gap-3.5 p-4 bg-gray-50/80 border border-gray-100 rounded-xl">
            <div className="w-14 h-14 bg-white rounded-xl border border-gray-200/80 flex-shrink-0 flex items-center justify-center shadow-sm">
              <Package className="w-7 h-7 text-gray-400" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h3 className="font-semibold text-gray-800 text-sm leading-tight">
                {transaction?.asset?.name || "-"}
              </h3>
              <p className="text-xs text-gray-500 font-mono">
                เลขที่คำขอ: {transaction?.borrowNo || "-"}
              </p>
              <p className="text-xs text-gray-500">
                ผู้ยืม:{" "}
                {transaction?.borrower
                  ? `${transaction.borrower.firstname} ${transaction.borrower.lastname}`
                  : "-"}
              </p>
            </div>
          </div>

          <div className="px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>
              กรุณาตรวจสอบสภาพครุภัณฑ์และอุปกรณ์ต่อพ่วงให้ครบถ้วนก่อนยืนยันตรวจรับ
            </span>
          </div>

          <form
            id="complete-return-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 text-sm mt-1"
          >
            {/* สภาพของอุปกรณ์ตอนตรวจรับ */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">
                สภาพครุภัณฑ์เมื่อตรวจรับ <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-6 py-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                  <input
                    type="radio"
                    name="conditionStatus"
                    value="Normal"
                    checked={conditionStatus === "Normal"}
                    onChange={() => setConditionStatus("Normal")}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                  />
                  <span>ปกติสมบูรณ์</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                  <input
                    type="radio"
                    name="conditionStatus"
                    value="Damage"
                    checked={conditionStatus === "Damage"}
                    onChange={() => setConditionStatus("Damage")}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                  />
                  <span>ชำรุด / เสียหาย</span>
                </label>
              </div>
            </div>

            {/* หมายเหตุการตรวจรับ */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">
                หมายเหตุการตรวจรับ (ถ้ามี)
              </label>
              <textarea
                rows={3}
                value={returnRemark}
                onChange={(e) => setReturnRemark(e.target.value)}
                placeholder="ระบุข้อความเพิ่มเติม เช่น อุปกรณ์ครบถ้วน, มีรอยขีดข่วนเล็กน้อย..."
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none placeholder:text-gray-400"
              />
            </div>

            {/* Footer Actions */}
            <div className="px-8 -mx-8 py-4 mt-3 border-t border-gray-100 flex items-center justify-end gap-3 bg-white">
              <button
                type="button"
                onClick={closeForm}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg transition-colors disabled:bg-emerald-300 disabled:cursor-not-allowed shadow-sm"
              >
                {isSubmitting && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                {isSubmitting ? "กำลังบันทึก..." : "ยืนยันตรวจรับ"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
