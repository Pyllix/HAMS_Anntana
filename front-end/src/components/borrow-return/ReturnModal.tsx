import { Building2, CheckCircle2, Package, Search, Tag, X } from "lucide-react";
import { useReturnModalStore } from "../../stores/useReturnModalStore";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserById } from "../../services/userService";
import { returnAsset, ReturnReq } from "../../services/borrowService";

export default function ReturnModal() {
  // ปิด Modal กับ รับ Asset
  const { closeForm, selectedAsset: asset } = useReturnModalStore();

  const queryClient = useQueryClient();

  // State ฟอร์มการคืน
  const [conditionStatus, setConditionStatus] = useState<
    "NORMAL" | "DAMAGED" | "LOST"
  >("NORMAL");
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [returnTime, setReturnTime] = useState(
    new Date().toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  );
  const [returnMethod, setReturnMethod] = useState<string>("self_return");
  const [returnRemark, setReturnRemark] = useState("");

  const [employeeId, setEmployeeId] = useState("");

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

  // จัดการการส่ง API สำหรับการคืนครุภัณฑ์
  const { mutate: handleReturnSubmit, isPending: isSubmitting } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReturnReq }) =>
      returnAsset(id, data),
    onSuccess: (data) => {
      alert("บันทึกการคืนครุภัณฑ์สำเร็จเรียบร้อย");
      console.log("Return success:", data);
      // Invalidate queries เพื่ออัปเดตข้อมูลหน้าตาราง
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      console.log("ไม่เจอ user");
      return;
    }

    const payload: ReturnReq = {
      returnCondition: conditionStatus,
      returnMethod,
      returnRemark,
      returnedByUserId: user.id,
    };

    handleReturnSubmit({ id: borrowingId, data: payload });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-800/60 backdrop-blur-sm animate-fadeIn">
      {/* Modal Container */}
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden text-gray-800"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-4">
          <h2 className="text-xl font-bold text-gray-800">
            บันทึกการคืนครุภัณฑ์ / อุปกรณ์
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
          <div className="flex items-start justify-between p-4 bg-gray-50/80 border border-gray-100 rounded-xl">
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
                    {asset?.section?.name || asset?.section?.building || "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Availability Status Badge */}
            <span className="text-[11px] font-medium px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-200/60 rounded-md whitespace-nowrap">
              {asset?.availabilityStatus?.name || "กำลังถูกยืม"}
            </span>
          </div>

          {/* Info Alert Box */}
          <div className="px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>
              กรุณาตรวจสอบสภาพครุภัณฑ์และอุปกรณ์ต่อพ่วงให้ครบถ้วนก่อนยืนยันการคืน
            </span>
          </div>

          {/* Form */}
          <form
            id="return-asset-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 text-sm mt-1"
          >
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

            {/* สภาพของอุปกรณ์ตอนส่งคืน (Radio Group) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">
                สภาพครุภัณฑ์เมื่อส่งคืน <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-6 py-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                  <input
                    type="radio"
                    name="conditionStatus"
                    value="NORMAL"
                    checked={conditionStatus === "NORMAL"}
                    onChange={() => setConditionStatus("NORMAL")}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                  />
                  <span>ปกติสมบูรณ์</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                  <input
                    type="radio"
                    name="conditionStatus"
                    value="DAMAGED"
                    checked={conditionStatus === "DAMAGED"}
                    onChange={() => setConditionStatus("DAMAGED")}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                  />
                  <span>ชำรุด / เสียหาย</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                  <input
                    type="radio"
                    name="conditionStatus"
                    value="LOST"
                    checked={conditionStatus === "LOST"}
                    onChange={() => setConditionStatus("LOST")}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                  />
                  <span>สูญหาย</span>
                </label>
              </div>
            </div>

            {/* วันและเวลาที่รับคืน */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                วันและเวลาที่รับคืน <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    disabled
                    type="date"
                    required
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-300 rounded-lg text-gray-700 text-xs focus:outline-none focus:ring-2 "
                  />
                  {/* <CalendarIcon className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /> */}
                </div>

                <div className="relative">
                  <input
                    disabled
                    type="time"
                    required
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-300 rounded-lg text-gray-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                  />
                  {/* <Clock className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /> */}
                </div>
              </div>
            </div>

            {/* หมายเหตุ / รายละเอียดเพิ่มเติม */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">
                หมายเหตุการคืน / รายละเอียดความเสียหาย (ถ้ามี)
              </label>
              <textarea
                rows={3}
                value={returnRemark}
                onChange={(e) => setReturnRemark(e.target.value)}
                placeholder="ระบุข้อความเพิ่มเติม เช่น อุปกรณ์ครบถ้วน, มีรอยขีดข่วนเล็กน้อย..."
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none placeholder:text-gray-400"
              />
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-4 mt-3 border-t border-gray-100 flex items-center justify-end gap-3 bg-white">
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
            form="return-asset-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการคืน"}
          </button>
        </div>
      </div>
    </div>
  );
}
