import React from "react";
import { useAssessmentStore } from "../../stores/useAssessmentStore";
import type { RepairJob } from "../../Types/TypeAssessment";

interface AssetInfoProps {
  jobData?: RepairJob | null;
}

export const AssetInfoCard: React.FC<AssetInfoProps> = ({
  jobData: customJobData,
}) => {
  const { selectedJob } = useAssessmentStore();

  // เลือกใช้ข้อมูลจาก props ก่อน หากไม่มีให้ใช้ selectedJob จาก Store
  const job = customJobData || selectedJob;

  if (!job) return null;

  // Cast type ชั่วคราวเพื่อให้อ่าน Optional Fields
  const rawJob = job as RepairJob & Record<string, any>;
  const rawAsset = (job.asset || {}) as Record<string, any>;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-white border border-slate-100 shadow-2xs rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-3">
        <span className="p-1 rounded-md bg-emerald-50 text-emerald-600">
          📄
        </span>
        ข้อมูลครุภัณฑ์และรายการแจ้งซ่อม
      </div>

      <div className="space-y-3 text-xs">
        {/* Row 1: Asset Code & Report Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              รหัสครุภัณฑ์
            </label>
            <input
              type="text"
              readOnly
              value={job.asset?.assetCode || rawJob.assetCode || "-"}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-mono font-semibold outline-hidden"
            />
          </div>
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              ประเภทการแจ้ง
            </label>
            <div className="w-full bg-emerald-50/60 border border-emerald-100 rounded-lg px-3 py-2 text-emerald-700 font-semibold truncate">
              {job.reportType ||
                rawAsset.type ||
                rawJob.category ||
                "ซ่อมทั่วไป"}
            </div>
          </div>
        </div>

        {/* Row 2: Asset Name */}
        <div>
          <label className="text-slate-400 font-medium block mb-1">
            ชื่อครุภัณฑ์ / รุ่น / ยี่ห้อ
          </label>
          <input
            type="text"
            readOnly
            value={job.asset?.assetName || rawJob.assetName || "-"}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-medium outline-hidden"
          />
        </div>

        {/* Row 3: Serial No. & Category */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              หมายเลขเครื่อง (Serial No.)
            </label>
            <input
              type="text"
              readOnly
              value={
                rawAsset.serialNo ||
                rawAsset.serialNumber ||
                rawJob.serialNo ||
                "-"
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-mono outline-hidden"
            />
          </div>
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              หมวดหมู่ครุภัณฑ์
            </label>
            <input
              type="text"
              readOnly
              value={
                job.techCategory?.categoryName ||
                rawAsset.category ||
                rawJob.categoryName ||
                rawJob.group ||
                "-"
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 truncate outline-hidden"
            />
          </div>
        </div>

        {/* Row 4: Location */}
        <div>
          <label className="text-slate-400 font-medium block mb-1">
            สถานที่ติดตั้ง / แผนกที่ใช้งาน
          </label>
          <input
            type="text"
            readOnly
            value={rawJob.location || rawAsset.location || "-"}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-hidden"
          />
        </div>

        {/* Row 5: Reporter, Urgency & Created Date */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="text-slate-400 font-medium block mb-1">
              ผู้แจ้งซ่อม / เบอร์โทร
            </label>
            <input
              type="text"
              readOnly
              value={
                rawJob.reporterName
                  ? `${rawJob.reporterName} ${rawJob.reporterPhone ? `(${rawJob.reporterPhone})` : ""}`
                  : rawJob.reporter || "-"
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 truncate outline-hidden"
            />
          </div>
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              ระดับความเร่งด่วน
            </label>
            <div
              className={`w-full rounded-lg px-3 py-2 font-semibold text-center truncate ${
                job.urgencyStatus === "EMERGENCY"
                  ? "bg-rose-50 border border-rose-100 text-rose-600"
                  : job.urgencyStatus === "URGENT"
                    ? "bg-amber-50 border border-amber-100 text-amber-600"
                    : "bg-slate-100 border border-slate-200 text-slate-600"
              }`}
            >
              {job.urgencyStatus === "EMERGENCY"
                ? "ด่วนมาก"
                : job.urgencyStatus === "URGENT"
                  ? "ด่วน"
                  : rawJob.urgency || "ปกติ"}
            </div>
          </div>
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              วันที่แจ้ง
            </label>
            <input
              type="text"
              readOnly
              value={formatDate(job.createdAt || rawJob.createdDate)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-center outline-hidden"
            />
          </div>
        </div>

        {/* Row 6: Symptom */}
        <div>
          <label className="text-slate-400 font-medium block mb-1">
            อาการเสียที่ระบุ (จากผู้ใช้งาน)
          </label>
          <textarea
            readOnly
            rows={3}
            value={job.symptom || rawJob.userSymptom || "-"}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 resize-none outline-hidden"
          />
        </div>
      </div>
    </div>
  );
};

export default AssetInfoCard;
