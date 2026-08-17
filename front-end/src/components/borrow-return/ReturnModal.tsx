import { X } from "lucide-react";
import { useReturnModalStore } from "../../stores/useReturnModalStore";

export default function ReturnModal() {
  // ปิด Modal กับ รับ Asset
  const { closeForm, selectedAsset } = useReturnModalStore();

  return (
    <div
      // พื้นหลังดำๆ จร้า
      className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9999] flex items-center justify-center transition-opacity duration-300"
      onClick={closeForm}
    >
      {/* กรอบของ Form  */}
      <div
        className="bg-white p-4 rounded-xl w-full max-w-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-800">
            ทำรายการรับคืนครุภัณฑ์
          </h3>
          <button
            onClick={closeForm}
            className="p-1 text-gray-400 transition-colors rounded-full hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={22} />
          </button>
        </div>
        {/* Header */}
        {/* Content Form */}
        {/* Content Form */}
      </div>
      {/* กรอบของ Form  */}
    </div>
  );
}
