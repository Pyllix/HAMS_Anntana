import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Stethoscope, Wrench, Monitor, Loader2, Search } from "lucide-react";
import { useRepairStore } from "../stores/useRepairModalStore";
import { getAssetByCode } from "../services/repairService";
import ConfirmRepairModal from "../components/help-desk/ConfirmRepairModal";
import type { MainCategory, ReportType, UrgencyStatus } from "../Types/TypeRepair";

export default function RepairRequestPage() {
  const {
    mainCategory,
    reportType,
    assetSearchInput,
    assetInfo,
    urgencyStatus,
    symptom,
    setMainCategory,
    setReportType,
    setAssetSearchInput,
    setAssetInfo,
    setLocation,
    setUrgencyStatus,
    setSymptom,
    openConfirmModal,
    resetForm,
  } = useRepairStore();

  const { refetch: fetchAsset, isFetching: isSearching } = useQuery({
    queryKey: ["assetInfo", assetSearchInput],
    queryFn: async () => {
      if (!assetSearchInput.trim()) throw new Error("กรุณากรอกรหัสครุภัณฑ์");
      const data = await getAssetByCode(assetSearchInput);
      setAssetInfo(data);
      if (data.location) setLocation(data.location);
      return data;
    },
    enabled: false,
  });

  const handleSearchAsset = () => {
    if (!assetSearchInput.trim()) {
      alert("กรุณากรอกรหัสครุภัณฑ์ก่อนค้นหา");
      return;
    }
    fetchAsset();
  };

  // ตรวจสอบความถูกต้องของข้อมูลเบื้องต้น แล้วเปิด Modal ยืนยัน
  const handleOpenConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();

    const targetAssetId = assetInfo?.assetId || assetSearchInput;

    if (!targetAssetId.trim() || !symptom.trim()) {
      alert("กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน");
      return;
    }

    openConfirmModal();
  };

  // Tab Categories Memoization
  const categories = useMemo(
    () => [
      { id: "MEDICAL", label: "ซ่อมเครื่องมือแพทย์", icon: Stethoscope },
      { id: "GENERAL", label: "ซ่อมบำรุงทั่วไป", icon: Wrench },
      { id: "COMPUTER", label: "ซ่อมคอมพิวเตอร์", icon: Monitor },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Top Main Category Selection */}
      <div className="flex gap-2 bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-2">
        {categories.map((tab) => {
          const Icon = tab.icon;
          const isActive = mainCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMainCategory(tab.id as MainCategory)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all cursor-pointer ${
                isActive
                  ? "bg-[#00A96E] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Container */}
      <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-6 shadow-xs">
        <form onSubmit={handleOpenConfirmModal} className="space-y-6">
          {/* Header */}
          <div className="border-b border-slate-200/60 pb-4">
            <h2 className="text-base font-bold text-slate-800">รายละเอียดการแจ้ง</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              กรุณาระบุข้อมูลให้ครบถ้วนเพื่อให้เจ้าหน้าที่ดำเนินการได้รวดเร็วยิ่งขึ้น
            </p>
          </div>

          {/* Sub-Type (reportType) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              ประเภทการแจ้ง <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {[
                { id: "Repair", label: "แจ้งซ่อมครุภัณฑ์ชำรุด (Repair)" },
                { id: "Maintenance", label: "บำรุงรักษาตามรอบ (Maintenance)" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setReportType(item.id as ReportType)}
                  className={`px-4 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    reportType === item.id
                      ? "border-[#00A96E] bg-emerald-50/50 text-[#00A96E] ring-1 ring-[#00A96E]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Asset Search Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                รหัสครุภัณฑ์ <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="เช่น EQ-2567-0008"
                    value={assetSearchInput}
                    onChange={(e) => setAssetSearchInput(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchAsset}
                  disabled={isSearching}
                  className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSearching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5 text-slate-500" />
                      ค้นหา
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                ชื่อครุภัณฑ์ (ระบบดึงให้อัตโนมัติ)
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={assetInfo?.assetName || ""}
                placeholder="ชื่อครุภัณฑ์จะแสดงขึ้นเมื่อกดค้นหา"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100/60 px-3.5 text-xs text-slate-500 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Location Field (Auto-filled) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              สถานที่ตั้ง / ห้องที่ใช้งาน (ระบบดึงให้อัตโนมัติ)
            </label>
            <input
              type="text"
              readOnly
              disabled
              value={assetInfo?.location || ""}
              placeholder="สถานที่ตั้งจะแสดงขึ้นเมื่อกดค้นหา"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100/60 px-3.5 text-xs text-slate-500 disabled:cursor-not-allowed"
            />
          </div>

          {/* Category & Urgency Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                หมวดหมู่ (ระบบดึงให้อัตโนมัติ)
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={assetInfo?.category || ""}
                placeholder="หมวดหมู่จะแสดงขึ้นตามข้อมูลครุภัณฑ์"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100/60 px-3.5 text-xs text-slate-500 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                ระดับความเร่งด่วน (urgencyStatus) <span className="text-red-500">*</span>
              </label>
              <select
                value={urgencyStatus}
                onChange={(e) => setUrgencyStatus(e.target.value as UrgencyStatus)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all cursor-pointer"
              >
                <option value="NORMAL">ปกติ (NORMAL)</option>
                <option value="URGENT">ด่วน (URGENT)</option>
                <option value="HIGH_URGENT">ด่วนมาก (HIGH_URGENT)</option>
              </select>
            </div>
          </div>

          {/* Symptom Details */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              รายละเอียดอาการเสีย (symptom) <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="อธิบายอาการเสียเบื้องต้น เช่น เครื่องเปิดไม่ติด..."
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/60">
            <button
              type="button"
              onClick={resetForm}
              className="h-9 px-5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="h-9 flex items-center gap-2 px-6 rounded-lg bg-[#00A96E] text-white text-xs font-medium hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
            >
              ส่งแจ้งซ่อม
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      <ConfirmRepairModal />
    </div>
  );
}