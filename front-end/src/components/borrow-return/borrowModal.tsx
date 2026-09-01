import { Building2, Loader2, Package, Search, Tag, X } from "lucide-react";
import { useBorrowModalStore } from "../../stores/useBorrowModalStore";
import { getUserById } from "../../services/userService";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { postBorrow } from "../../services/borrowService";

export default function BorrowModal() {
  const queryClient = useQueryClient();

  // ตัวปิด Modal กับ Asset ที่รับเข้ามา
  const { closeForm, selectedAsset: asset } = useBorrowModalStore();

  // ------------- ทำตัวเเปลของเวลา ------------------
  // 1. เพิ่มตัวแปรดึงเวลาปัจจุบันไว้ด้านบน (ก่อน return ภายในฟังก์ชัน BorrowModal)
  const now = new Date();
  // จัดฟอร์แมตวันที่ให้อยู่ในรูป YYYY-MM-DD
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  // จัดฟอร์แมตเวลาให้อยู่ในรูป HH:MM
  const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  // ------------- ทำตัวเเปลของเวลา ------------------

  const [employeeId, setEmployeeId] = useState("");

  // จัดการการส่ง API สำหรับการยืมครุภัณฑ์
  const { mutate: handleBorrowSubmit, isPending: isSubmitting } = useMutation({
    mutationFn: postBorrow,
    onSuccess: (data) => {
      alert("บันทึกการยืมครุภัณฑ์สำเร็จเรียบร้อย");
      console.log("Borrow success:", data);
      // Invalidate queries เพื่ออัปเดตสถานะหน้าตารางรายการ
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["borrowings"] });
      closeForm();
    },
    onError: (err: any) => {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "เกิดข้อผิดพลาดในการบันทึก";
      alert(`ไม่สามารถทำรายการได้: ${errorMsg}`);
    },
  });

  // เรียกใช้ service getUser ที่เอาไปทำค้าหาพนักงาน
  const { data: user, refetch: refetchUser } = useQuery({
    queryKey: ["user", employeeId],
    queryFn: () => getUserById(employeeId),
    enabled: false,
  });

  // function ในปุ่มค้นหารหัสพนักงาน
  const handleFetchClick = () => {
    if (!employeeId.trim()) {
      alert("กรุณากรอกรหัสพนักงาน");
      return;
    }
    refetchUser();
  };

  // function ในปุ่มยืนยันการยืม
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!asset?.id) {
      alert("ไม่พบข้อมูลครุภัณฑ์ที่เลือก");
      return;
    }

    if (!user?.id) {
      alert("กรุณากรอกและค้นหารหัสพนักงานก่อนทำรายการ");
      return;
    }

    // ส่ง Payload ไปยัง API
    handleBorrowSubmit({
      assetId: asset.id,
      borrowerId: user.id,
      deliveryMethod: "PICKUP",
    });
  };


  return (
    <div
      className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 animate-fadeIn"
      onClick={closeForm}
    >
      {/* Container Modal (max-w-lg) */}
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden text-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-4">
          <h2 className="text-xl font-bold text-gray-800">
            ทำรายการยืมครุภัณฑ์
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
          {/* Card แสดงรายละเอียดครุภัณฑ์ที่เลือก */}
          <div className="flex items-start justify-between p-4 bg-gray-50/80 border border-gray-100 rounded-xl gap-3.5">
            <div className="flex gap-3.5">
              {/* Image / Icon Preview */}
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

              {/* Detail */}
              <div className="flex flex-col gap-0.5 shrink-0">
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
                    {asset?.section?.name || asset?.section?.building || "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Availability Status Badge */}
            <span className="text-[11px] font-medium px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200/60 rounded-md whitespace-nowrap">
              {asset?.availabilityStatus?.name || "กำลังถูกยืม"}
            </span>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-4 text-sm" onSubmit={onSubmit}>
            {/* รหัสพนักงาน */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="employeeId"
                className="text-xs font-semibold text-gray-700"
              >
                รหัสพนักงาน <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="employeeId"
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                  placeholder="กรอกรหัสพนักงาน"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                />

                <button
                  type="button"
                  onClick={handleFetchClick}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-gray-100 rounded-md transition-colors"
                  title="ค้นหา"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ชื่อ-นามสกุลผู้ยืม */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="borrower"
                className="text-xs font-semibold text-gray-700"
              >
                ชื่อ-นามสกุลผู้ยืม
              </label>
              <input
                disabled
                type="text"
                id="borrower"
                className={`w-full px-3.5 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none transition-all ${
                  user ? "bg-white text-gray-800" : "bg-gray-50 text-gray-400"
                }`}
                value={
                  user ? user.firstname + " " + user.lastname : "ชื่อ-นามสกุล"
                }
              />
            </div>

            {/* แผนก / วอร์ด */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="ward"
                className="text-xs font-semibold text-gray-700"
              >
                แผนก / วอร์ด (Ward)
              </label>
              <select
                disabled
                id="ward"
                defaultValue=""
                className={`w-full px-3.5 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none transition-all ${
                  user ? "bg-white text-gray-800" : "bg-gray-50 text-gray-400"
                }`}
              >
                <option value="" disabled className="text-gray-300">
                  {user ? user.role : "เลือกแผนก"}
                </option>
              </select>
            </div>

            {/* วันที่และเวลาที่ยืม */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">
                วันที่และเวลาที่ยืม
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  disabled
                  type="date"
                  defaultValue={defaultDate}
                  className="w-full px-3.5 py-2.5 text-xs text-gray-700 bg-gray-50/70 border border-gray-300 rounded-lg focus:outline-none cursor-not-allowed"
                />
                <input
                  disabled
                  type="time"
                  defaultValue={defaultTime}
                  className="w-full px-3.5 py-2.5 text-xs text-gray-700 bg-gray-50/70 border border-gray-300 rounded-lg focus:outline-none cursor-not-allowed"
                />
              </div>
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
                disabled={isSubmitting || !user}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg transition-colors disabled:bg-emerald-300 disabled:cursor-not-allowed shadow-sm"
              >
                {isSubmitting && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการยืม"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
