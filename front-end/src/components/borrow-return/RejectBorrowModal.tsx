import { AlertTriangle, Loader2, Package, X } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRejectModalStore } from "../../stores/useRejectModalStore";
import { rejectBorrow, getBorrowErrorMessage } from "../../services/borrowService";
import { useToastStore } from "../../stores/useToastStore";

export default function RejectBorrowModal() {
  const { closeForm, selectedTransaction: transaction } =
    useRejectModalStore();

  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const [reason, setReason] = useState("");

  const { mutate: handleReject, isPending: isSubmitting } = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectBorrow(id, reason),
    onSuccess: () => {
      showToast("success", "ปฏิเสธคำขอยืมครุภัณฑ์เรียบร้อยแล้ว");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["borrowHistory"] });
      closeForm();
    },
    onError: (err: any) => {
      showToast("error", getBorrowErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!transaction?.id) {
      showToast("warning", "ไม่พบข้อมูลคำขอยืมที่เลือก");
      return;
    }

    if (!reason.trim()) {
      showToast("warning", "กรุณาระบุเหตุผลในการปฏิเสธคำขอ");
      return;
    }

    handleReject({ id: transaction.id, reason: reason.trim() });
  };

  return (
    <div
      className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 animate-fadeIn"
      onClick={closeForm}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden text-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-4">
          <h2 className="text-xl font-bold text-gray-800">ปฏิเสธคำขอยืม</h2>
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
        <div className="px-8 py-2 flex flex-col gap-4">
          {/* Card แสดงรายละเอียดคำขอที่เลือก */}
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
                ผู้ขอยืม:{" "}
                {transaction?.borrower
                  ? `${transaction.borrower.firstname} ${transaction.borrower.lastname}`
                  : "-"}
              </p>
            </div>
          </div>

          {/* Warning Alert */}
          <div className="px-4 py-2.5 bg-rose-500/5 border border-rose-500/20 rounded-lg text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>
              เมื่อปฏิเสธแล้ว ครุภัณฑ์นี้จะกลับมาพร้อมให้ยืมได้ตามเดิม
            </span>
          </div>

          <form
            id="reject-borrow-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 text-sm mt-1"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">
                เหตุผลในการปฏิเสธ <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ระบุเหตุผล เช่น ครุภัณฑ์ถูกจองไว้ใช้งานส่วนกลาง..."
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none placeholder:text-gray-400"
                required
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
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg transition-colors disabled:bg-rose-300 disabled:cursor-not-allowed shadow-sm"
              >
                {isSubmitting && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการปฏิเสธ"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
