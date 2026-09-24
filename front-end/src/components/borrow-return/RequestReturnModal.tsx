import { Info, Loader2, Package, X } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequestReturnModalStore } from "../../stores/useRequestReturnModalStore";
import {
  requestReturn,
  getBorrowErrorMessage,
  type RequestReturnReq,
} from "../../services/borrowService";
import { useToastStore } from "../../stores/useToastStore";

export default function RequestReturnModal() {
  const { closeForm, selectedTransaction: transaction } =
    useRequestReturnModalStore();

  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const [pickupLocation, setPickupLocation] = useState("");
  const [remark, setRemark] = useState("");

  const { mutate: handleRequestReturn, isPending: isSubmitting } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RequestReturnReq }) =>
      requestReturn(id, data),
    onSuccess: () => {
      showToast(
        "success",
        "แจ้งคืนครุภัณฑ์เรียบร้อยแล้ว รอเจ้าหน้าที่ศูนย์ครุภัณฑ์มารับคืน",
      );
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
      showToast("warning", "ไม่พบข้อมูลรายการยืมที่เลือก");
      return;
    }

    handleRequestReturn({
      id: transaction.id,
      data: {
        pickupLocation: pickupLocation.trim() || undefined,
        remark: remark.trim() || undefined,
      },
    });
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
          <h2 className="text-xl font-bold text-gray-800">แจ้งคืนครุภัณฑ์</h2>
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
          {/* Card แสดงรายละเอียดรายการยืมที่เลือก */}
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

          {/* Info Alert */}
          <div className="px-4 py-2.5 bg-sky-500/5 border border-sky-500/20 rounded-lg text-sky-700 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 flex-shrink-0 text-sky-600" />
            <span>
              เจ้าหน้าที่ศูนย์ครุภัณฑ์จะมารับครุภัณฑ์คืนตามจุดรับที่ระบุ
            </span>
          </div>

          <form
            id="request-return-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 text-sm mt-1"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">
                จุดนัดรับครุภัณฑ์
              </label>
              <input
                type="text"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="เช่น ICU ชั้น 4 เตียง 2"
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-gray-400"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">
                หมายเหตุ
              </label>
              <textarea
                rows={3}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="เช่น ใช้งานเสร็จแล้ว สามารถมารับเครื่องได้เลย"
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
                {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการแจ้งคืน"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
