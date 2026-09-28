import { Building2, Loader2, Package, Tag, X } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelfBorrowModalStore } from "../../stores/useSelfBorrowModalStore";
import { useAuthStore } from "../../stores/authStore";
import {
  postBorrow,
  getBorrowErrorMessage,
} from "../../services/borrowService";
import { useToastStore } from "../../stores/useToastStore";
import ThaiDatePicker from "./ThaiDatePicker";

// วันที่พรุ่งนี้ (ค่าต่ำสุดที่เลือกได้ เพราะ backend บังคับว่าต้องเป็นอนาคต)
function getTomorrowDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

export default function SelfBorrowModal() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const { closeForm, selectedAsset: asset } = useSelfBorrowModalStore();

  const [expectedReturnDate, setExpectedReturnDate] = useState("");

  const { mutate: handleBorrowSubmit, isPending: isSubmitting } = useMutation(
    {
      mutationFn: postBorrow,
      onSuccess: () => {
        showToast(
          "success",
          "ส่งคำขอยืมครุภัณฑ์เรียบร้อยแล้ว รอเจ้าหน้าที่ศูนย์ครุภัณฑ์อนุมัติ",
        );
        queryClient.invalidateQueries({ queryKey: ["assets"] });
        queryClient.invalidateQueries({ queryKey: ["borrowHistory"] });
        closeForm();
      },
      onError: (err: any) => {
        showToast("error", getBorrowErrorMessage(err));
      },
    },
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!asset?.id) {
      showToast("warning", "ไม่พบข้อมูลครุภัณฑ์ที่เลือก");
      return;
    }

    handleBorrowSubmit({
      assetId: asset.id,
      borrowerId: user?.id,
      deliveryMethod: "PICKUP",
      expectedReturnDate: expectedReturnDate
        ? new Date(`${expectedReturnDate}T17:00:00.000Z`).toISOString()
        : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-opacity duration-300"
      onClick={closeForm}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden text-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-4">
          <h2 className="text-xl font-bold text-gray-800">ขอยืมครุภัณฑ์</h2>
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
          {/* Card แสดงรายละเอียดครุภัณฑ์ที่เลือก */}
          <div className="flex items-start gap-3.5 p-4 bg-gray-50/80 border border-gray-100 rounded-xl">
            <div className="w-14 h-14 bg-white rounded-xl border border-gray-200/80 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm">
              {asset?.imageUrl ? (
                <img
                  src={asset.imageUrl}
                  alt={asset.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="w-7 h-7 text-gray-400" />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <h3 className="font-semibold text-gray-800 text-sm leading-tight">
                {asset?.name}
              </h3>
              <p className="text-xs text-gray-500 font-mono">
                S/N: {asset?.serialNo || "-"} | Model: {asset?.model || "-"}
              </p>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-gray-400" />
                  {asset?.type?.name || "ไม่ระบุหมวดหมู่"}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-gray-400" />
                  {asset?.section?.name || "-"}
                </span>
              </div>
            </div>
          </div>

          <form
            id="self-borrow-form"
            onSubmit={onSubmit}
            className="flex flex-col gap-4 text-sm mt-1"
          >
            {/* ผู้ขอยืม */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">
                ผู้ขอยืม
              </label>
              <input
                disabled
                type="text"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 text-gray-600 border border-gray-300 rounded-lg focus:outline-none"
                value={
                  user ? `${user.firstname} ${user.lastname}` : "ไม่พบข้อมูลผู้ใช้"
                }
              />
            </div>

            {/* วันที่ต้องการคืน */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="expectedReturnDate"
                className="text-xs font-semibold text-gray-700"
              >
                วันที่ต้องการคืน (ถ้าไม่ระบุ เจ้าหน้าที่จะกำหนดให้ภายหลัง)
              </label>
              <ThaiDatePicker
                id="expectedReturnDate"
                minDate={getTomorrowDateString()}
                value={expectedReturnDate}
                onChange={setExpectedReturnDate}
                placeholder="เลือกวันที่ต้องการคืน"
              />
            </div>

            {/* Info Alert Box */}
            <div className="px-4 py-2.5 bg-sky-500/5 border border-sky-500/20 rounded-lg text-sky-800 text-xs">
              คำขอนี้จะถูกส่งไปให้เจ้าหน้าที่ศูนย์ครุภัณฑ์อนุมัติก่อน
              เมื่ออนุมัติแล้วให้มารับครุภัณฑ์ที่ศูนย์ครุภัณฑ์กลาง
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-gray-100 bg-white">
              <button
                type="button"
                onClick={closeForm}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
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
                {isSubmitting ? "กำลังส่งคำขอ..." : "ยืนยันขอยืม"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
