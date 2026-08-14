import { Monitor, X } from "lucide-react";
import { useBorrowModalStore } from "../../stores/useBorrowModalStore";

export default function BorrowModal() {
  const { closeForm, selectedAsset } = useBorrowModalStore();
  // 1. เพิ่มตัวแปรดึงเวลาปัจจุบันไว้ด้านบน (ก่อน return ภายในฟังก์ชัน BorrowModal)
  const now = new Date();
  // จัดฟอร์แมตวันที่ให้อยู่ในรูป YYYY-MM-DD
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  // จัดฟอร์แมตเวลาให้อยู่ในรูป HH:MM
  const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

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
              src={selectedAsset?.imageUrl + ""}
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
          <form className="space-y-5">
            {/* รหัสพนักงาน */}
            <div>
              <label
                htmlFor="borrower"
                className="block mb-2 text-sm font-bold text-gray-800"
              >
                รหัสพนักงาน
              </label>
              <input
                type="text"
                id="borrower"
                className="w-full px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-transparent placeholder-gray-400"
                placeholder="กรอกรหัสพนักงาน"
                required
              />
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
                required
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
                required
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
                  required
                />
                <input
                  disabled
                  type="time"
                  defaultValue={defaultTime}
                  className="w-full flex-1 px-4 py-2.5 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </form>
        </div>
        {/* Content Body END */}
      </div>
    </div>
  );
}
