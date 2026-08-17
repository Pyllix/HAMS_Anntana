import { Loader2, Search, X } from "lucide-react";
import { useBorrowModalStore } from "../../stores/useBorrowModalStore";
import { getUserById } from "../../services/userService";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { postBorrow } from "../../services/borrowService";

export default function BorrowModal() {
  const queryClient = useQueryClient();

  // ตัวปิด Modal กับ Asset ที่รับเข้ามา
  const { closeForm, selectedAsset } = useBorrowModalStore();

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

    if (!selectedAsset?.id) {
      alert("ไม่พบข้อมูลครุภัณฑ์ที่เลือก");
      return;
    }

    if (!user?.id) {
      alert("กรุณากรอกและค้นหารหัสพนักงานก่อนทำรายการ");
      return;
    }

    // ส่ง Payload ไปยัง API
    handleBorrowSubmit({
      assetId: selectedAsset.id,
      borrowerId: user.id,
      deliveryMethod: "PICKUP",
    });
  };

  const imgUrl = selectedAsset?.imageUrl as string;

  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9999] flex items-center justify-center transition-opacity duration-300"
      onClick={closeForm}
    >
      {/* หยุด Event ไม่ให้ลอยขึ้นไปหา Backdrop ด้วย e.stopPropagation() */}
      <div
        className="bg-white p-4 rounded-xl w-full max-w-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-800">
            ทำรายการยืมครุภัณฑ์
          </h3>
          <button
            onClick={closeForm}
            className="p-1 text-gray-400 transition-colors rounded-full hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={22} />
          </button>
        </div>
        {/* Header END */}
        {/* Content Body */}
        <div className="p-6">
          {/* กล่องแสดงข้อมูลครุภัณฑ์ */}
          <div className="flex items-center gap-4 p-4 mb-6 bg-gray-50 border border-gray-200 rounded-xl">
            <img
              className="flex items-center justify-center w-12 h-12 border-gray-200 rounded-lg shrink-0 shadow-sm"
              src={imgUrl || "/placeholder.png"}
              alt=""
            />
            <div>
              <h4 className="font-bold text-gray-800">{selectedAsset?.name}</h4>
              <p className="text-sm text-gray-500 mt-0.5">
                รหัส: {selectedAsset?.serialNo || "AED-2024-005"}
              </p>
            </div>
          </div>
          {/* กล่องแสดงข้อมูลครุภัณฑ์ */}

          {/* Form */}
          <form className="space-y-5" onSubmit={onSubmit}>
            {/* รหัสพนักงาน */}
            <div className="">
              <label
                htmlFor="employeeId"
                className="block mb-2 text-sm font-bold text-gray-800"
              >
                รหัสพนักงาน
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="employeeId"
                  className="w-full px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-transparent placeholder-gray-400"
                  placeholder="กรอกรหัสพนักงาน"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                />

                <button
                  type="button"
                  onClick={handleFetchClick}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-md transition-colors"
                  title="ค้นหา"
                >
                  {/* 2. เรียกใช้ Component ไอคอน และกำหนดขนาดด้วย className */}
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* ชื่อ-นามสกุลผู้ยืม */}
            <div>
              <label
                htmlFor="borrower"
                className="block mb-2 text-sm font-bold text-gray-800"
              >
                ชื่อ-นามสกุลผู้ยืม
              </label>
              <input
                disabled
                type="text"
                id="borrower"
                className="w-full px-4 py-2.5 text-sm    bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-gray-400"
                placeholder="ชื่อ-นามสกุล"
              />
            </div>

            {/* แผนก / วอร์ด */}
            <div>
              <label
                htmlFor="ward"
                className="block mb-2 text-sm font-bold text-gray-800"
              >
                แผนก / วอร์ด (Ward)
              </label>
              <select
                disabled
                id="ward"
                defaultValue=""
                className="w-full px-4 py-2.5 text-sm text-gray-400 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="" disabled className="text-gray-200">
                  แผนกที่นำไปใช้...
                </option>
              </select>
            </div>

            {/* วันที่และเวลาที่ยืม */}
            <div>
              <label className="block mb-2 text-sm font-bold text-gray-800">
                วันที่และเวลาที่ยืม
              </label>
              <div className="flex gap-4">
                <input
                  disabled
                  type="date"
                  defaultValue={defaultDate}
                  className="w-full flex-1 px-4 py-2.5 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <input
                  disabled
                  type="time"
                  defaultValue={defaultTime}
                  className="w-full flex-1 px-4 py-2.5 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={closeForm}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !user}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed shadow-sm"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการยืม"}
              </button>
            </div>
          </form>
        </div>
        {/* Content Body END */}
      </div>
    </div>
  );
}
