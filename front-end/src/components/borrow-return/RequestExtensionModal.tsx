import { CalendarClock, Info, Loader2, Package, X } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useExtensionModalStore } from "../../stores/useExtensionModalStore";
import {
  createBorrowExtension,
  getBorrowErrorMessage,
  type CreateExtensionReq,
} from "../../services/borrowService";
import { useToastStore } from "../../stores/useToastStore";
import ThaiDatePicker from "./ThaiDatePicker";

const MIN_REASON_LENGTH = 5;

const toDateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// วันแรกที่เลือกได้ = วันถัดจากกำหนดคืนเดิม (หรือพรุ่งนี้ ถ้ากำหนดคืนเดิมผ่านไปแล้ว/ไม่มี)
// เพราะ backend บังคับว่าวันใหม่ต้องอยู่หลังกำหนดคืนเดิมและเป็นอนาคต
function getMinExtensionDate(currentReturnDate: string | null | undefined) {
  const base = new Date();
  if (currentReturnDate) {
    const current = new Date(currentReturnDate);
    if (!isNaN(current.getTime()) && current > base) base.setTime(current.getTime());
  }
  base.setDate(base.getDate() + 1);
  return toDateString(base);
}

const formatThaiDate = (dateString: string | null | undefined) => {
  if (!dateString) return "ไม่ได้กำหนด";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "ไม่ได้กำหนด";

  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export default function RequestExtensionModal() {
  const { closeForm, selectedTransaction: transaction } =
    useExtensionModalStore();

  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const [requestedReturnDate, setRequestedReturnDate] = useState("");
  const [reason, setReason] = useState("");

  const { mutate: handleRequestExtension, isPending: isSubmitting } =
    useMutation({
      mutationFn: ({ id, data }: { id: string; data: CreateExtensionReq }) =>
        createBorrowExtension(id, data),
      onSuccess: () => {
        showToast(
          "success",
          "ส่งคำขอต่อเวลาเรียบร้อยแล้ว รอเจ้าหน้าที่ศูนย์ครุภัณฑ์อนุมัติ",
        );
        queryClient.invalidateQueries({ queryKey: ["borrowHistory"] });
        queryClient.invalidateQueries({ queryKey: ["borrowExtensions"] });
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

    if (!requestedReturnDate) {
      showToast("warning", "กรุณาเลือกวันที่ต้องการคืนใหม่");
      return;
    }

    if (reason.trim().length < MIN_REASON_LENGTH) {
      showToast(
        "warning",
        `กรุณาระบุเหตุผลอย่างน้อย ${MIN_REASON_LENGTH} ตัวอักษร`,
      );
      return;
    }

    handleRequestExtension({
      id: transaction.id,
      data: {
        // ใช้รูปแบบเวลาเดียวกับตอนขอยืม (SelfBorrowModal)
        requestedReturnDate: new Date(
          `${requestedReturnDate}T17:00:00.000Z`,
        ).toISOString(),
        reason: reason.trim(),
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
          <h2 className="text-xl font-bold text-gray-800">ขอต่อเวลายืม</h2>
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
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <CalendarClock className="w-3 h-3 text-gray-400" />
                กำหนดคืนเดิม: {formatThaiDate(transaction?.expectedReturnDate)}
                {!!transaction?.extensionCount &&
                  ` (ต่อเวลาแล้ว ${transaction.extensionCount} ครั้ง)`}
              </p>
            </div>
          </div>

          {/* Info Alert */}
          <div className="px-4 py-2.5 bg-sky-500/5 border border-sky-500/20 rounded-lg text-sky-700 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 flex-shrink-0 text-sky-600" />
            <span>
              คำขอจะถูกส่งให้เจ้าหน้าที่ศูนย์ครุภัณฑ์อนุมัติ
              ระหว่างนี้กำหนดคืนเดิมยังมีผลอยู่
            </span>
          </div>

          <form
            id="request-extension-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 text-sm mt-1"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="requestedReturnDate"
                className="text-xs font-semibold text-gray-700"
              >
                วันที่ต้องการคืนใหม่ <span className="text-red-500">*</span>
              </label>
              <ThaiDatePicker
                id="requestedReturnDate"
                minDate={getMinExtensionDate(transaction?.expectedReturnDate)}
                value={requestedReturnDate}
                onChange={setRequestedReturnDate}
                placeholder="เลือกวันที่ต้องการคืนใหม่"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">
                เหตุผลในการขอต่อเวลา <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น ยังต้องใช้งานต่อเนื่องกับผู้ป่วยในหอผู้ป่วย"
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none placeholder:text-gray-400"
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
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg transition-colors disabled:bg-emerald-300 disabled:cursor-not-allowed shadow-sm"
              >
                {isSubmitting && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                {isSubmitting ? "กำลังบันทึก..." : "ส่งคำขอต่อเวลา"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
