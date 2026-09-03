import { FileText } from "lucide-react";
import { useAssessmentStore } from "../../stores/useAssessmentModalStore";
import type {
  RepairDetail,
  UrgencyStatus,
  BaseLookup,
  RepairMetaLookups,
} from "../../Types/TypeAssessment";

interface AssetInfoProps {
  jobData?: RepairDetail | null;
  jobTypes?: BaseLookup[];
}

export default function AssetInfoCard({
  jobData: customJobData,
  jobTypes: customJobTypes,
}: AssetInfoProps) {
  const { selectedJob, lookups } = useAssessmentStore() as any;

  const rawJob = customJobData || selectedJob;
  const job = (
    Array.isArray((rawJob as any)?.data) ? (rawJob as any).data[0] : rawJob
  ) as RepairDetail | null;

  if (!job) return null;

  const asset = job.asset;
  const section = job.section;
  const reporter = job.reporter;

  const jobTypesList: BaseLookup[] =
    customJobTypes ||
    lookups?.jobTypes ||
    lookups?.meta?.jobTypes ||
    lookups?.repairMeta?.jobTypes ||
    (lookups as RepairMetaLookups)?.jobTypes ||
    [];

  const matchedJobType = jobTypesList.find(
    (item) => String(item.id) === String(job.jobTypeId),
  );

  const rawReportType = job.reportType?.trim();
  const isGenericEnglishWord =
    rawReportType?.toUpperCase() === "REPAIR" || !rawReportType;
    
  const rawJobTypeObj = (job as any)?.jobType;
  const reportType =
    (typeof rawJobTypeObj === "string" ? rawJobTypeObj : rawJobTypeObj?.name) ||
    matchedJobType?.name ||
    (!isGenericEnglishWord ? rawReportType : null) ||
    "-";

  const assetCode = asset?.noid || "-";
  const assetName = asset?.name
    ? `${asset.name} ${asset.model ? `(${asset.model})` : ""}`
    : "-";
  const serialNo = asset?.serialNo || "-";
  const categoryName =
    (job as any)?.techCategory?.name ||
    asset?.type?.name ||
    (job as any)?.jobType?.name ||
    "-";
  const location = section?.name
    ? `${section.name} ${section.building ? `(${section.building})` : ""}`
    : "-";
  const reporterName = reporter?.firstname
    ? `${reporter.firstname} ${reporter.lastname}`
    : "-";
  const urgencyStatus = job.urgencyStatus;
  const reportedAt = job.createdAt
    ? new Date(job.createdAt).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";
  const symptomDetails = job.symptom || asset?.remark || "-";

  const getUrgencyBadge = (urgency?: UrgencyStatus) => {
    switch (urgency) {
      case "EMERGENCY":
        return {
          label: "ด่วนมาก",
          className: "bg-rose-50 border border-rose-100 text-rose-600",
        };
      case "URGENT":
        return {
          label: "ด่วน",
          className: "bg-amber-50 border border-amber-100 text-amber-600",
        };
      case "NORMAL":
      default:
        return {
          label: "ปกติ",
          className: "bg-slate-100 border border-slate-200 text-slate-600",
        };
    }
  };

  const urgencyBadge = getUrgencyBadge(urgencyStatus);

  return (
    <div className="bg-white border border-slate-100 shadow-2xs rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-3">
        <span className="p-1 rounded-md bg-emerald-50 text-emerald-600">
          <FileText className="w-4 h-4" />
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
              value={assetCode}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-mono font-semibold outline-hidden"
            />
          </div>
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              ประเภทการแจ้ง
            </label>
            <div className="w-full bg-emerald-50/60 border border-emerald-100 rounded-lg px-3 py-2 text-emerald-700 font-semibold truncate">
              {reportType}
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
            value={assetName}
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
              value={serialNo}
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
              value={categoryName}
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
            value={location}
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
              value={reporterName}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 truncate outline-hidden"
            />
          </div>
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              ระดับความเร่งด่วน
            </label>
            <div
              className={`w-full rounded-lg px-3 py-2 font-semibold text-center truncate  ${urgencyBadge.className}`}
            >
              {urgencyBadge.label}
            </div>
          </div>
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              วันที่แจ้ง
            </label>
            <input
              type="text"
              readOnly
              value={reportedAt}
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
            value={symptomDetails}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 resize-none outline-hidden"
          />
        </div>
      </div>
    </div>
  );
}
