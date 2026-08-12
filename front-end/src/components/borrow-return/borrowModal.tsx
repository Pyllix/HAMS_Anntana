import { X } from "lucide-react";
import { useBorrowModalStore } from "../../stores/useBorrowModalStore";

export default function BorrowModal() {
  const { closeForm, selectedAsset } = useBorrowModalStore();

  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-opacity duration-300"
      onClick={closeForm}
    >
      {/* หยุด Event ไม่ให้ลอยขึ้นไปหา Backdrop ด้วย e.stopPropagation() */}
      <div
        className="bg-white p-8 rounded-xl w-full max-w-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">
            ยืมครุภัณฑ์: {selectedAsset?.name}
          </h3>
          <button
            onClick={closeForm}
            className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <form className="space-y-5">
          <div>
            <label
              htmlFor="borrower"
              className="block text-sm font-medium text-gray-700"
            >
              ผู้ยืม
            </label>
            <input
              type="text"
              id="borrower"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              placeholder="ชื่อ-นามสกุล หรือ รหัสพนักงาน"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 border border-transparent rounded-md shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              ยืนยันการยืม
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
