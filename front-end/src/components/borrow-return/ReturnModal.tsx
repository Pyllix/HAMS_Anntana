import { X } from "lucide-react";
import { useReturnModalStore } from "../../stores/useReturnModalStore";

export default function ReturnModal() {
  // ปิด Modal กับ รับ Asset
  const { closeForm, selectedAsset: asset } = useReturnModalStore();

  const imgUrl = asset?.imageUrl as string;

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
        {/* Header End*/}
        {/* Content Form */}
        <div className="p-6">
          {/* กล่องข้อมูล Asset */}
          <div className="flex items-center gap-4 p-4 mb-6 bg-gray-50 border border-gray-200 rounded-xl">
            <img
              className="flex items-center justify-center w-12 h-12 border-gray-200 rounded-lg shrink-0 shadow-sm"
              src={imgUrl || "/placeholder.png"}
              alt=""
            />
            <div>
              <h4 className="font-bold text-gray-800">{asset?.name}</h4>
              <p className="text-sm text-gray-500 mt-0.5">
                รหัส: {asset?.serialNo || "AED-2024-005"}
              </p>
            </div>
          </div>
          {/* กล่องข้อมูล Asset End*/}
          {/* Borrower Data */}
          <div className="bg-emerald-100 w-full px-4 py-2">

          </div>
          {/* Borrower Data End*/}
        </div>
        {/* Content Form End*/}
      </div>
      {/* กรอบของ Form  End*/}
    </div>
    // พื้นหลังดำๆ จร้า End
  );
}
