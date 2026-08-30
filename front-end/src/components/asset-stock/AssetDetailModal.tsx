import { X, Wrench, BarChart2, Package } from "lucide-react";
import { useAssetDetailModalStore } from "../../stores/useAssetDetailModalStore";

const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function formatThaiDate(dateString?: string | null): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "-";
    const day = d.getDate();
    const month = THAI_MONTHS[d.getMonth()];
    const year = d.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  } catch {
    return "-";
  }
}

function calculateUsageTime(receivedDateString?: string | null): string {
  if (!receivedDateString) return "-";
  try {
    const start = new Date(receivedDateString);
    const now = new Date();
    if (isNaN(start.getTime())) return "-";

    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years < 0) return "ยังไม่ถึงกำหนด";
    if (years === 0 && months === 0) return "น้อยกว่า 1 เดือน";
    if (years === 0) return `${months} เดือน`;
    if (months === 0) return `${years} ปี`;
    return `${years} ปี ${months} เดือน`;
  } catch {
    return "-";
  }
}

function isWarrantyActive(warrantyDateString?: string | null): boolean {
  if (!warrantyDateString) return false;
  try {
    const wDate = new Date(warrantyDateString);
    return wDate.getTime() >= Date.now();
  } catch {
    return false;
  }
}

export default function AssetDetailModal() {
  const { isOpen, closeModal, selectedAsset: asset } = useAssetDetailModalStore();

  if (!isOpen || !asset) return null;

  const underWarranty = isWarrantyActive(asset.warrantyDate);

  const getStatusStyle = (code?: string) => {
    switch (code) {
      case "NORMAL":
        return "border-emerald-500 text-emerald-600 bg-emerald-50/60";
      case "DAMAGED":
      case "LOST":
        return "border-rose-400 text-rose-500 bg-rose-50/60";
      case "UNDER_REPAIR":
      case "WAIT_DISPOSAL":
        return "border-amber-400 text-amber-600 bg-amber-50/60";
      case "DISPOSAL":
        return "border-slate-400 text-slate-600 bg-slate-50/60";
      default:
        return "border-gray-300 text-gray-600 bg-gray-50";
    }
  };

  const getDotColor = (code?: string) => {
    switch (code) {
      case "NORMAL":
        return "bg-emerald-500";
      case "DAMAGED":
      case "LOST":
        return "bg-rose-500";
      case "UNDER_REPAIR":
      case "WAIT_DISPOSAL":
        return "bg-amber-500";
      case "DISPOSAL":
        return "bg-slate-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      {/* Modal Card */}
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-800">รายละเอียดครุภัณฑ์</h2>
          <button
            type="button"
            onClick={closeModal}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Top Asset Overview */}
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border border-slate-200 bg-slate-50 p-2 shrink-0 flex items-center justify-center overflow-hidden">
            {asset.imageUrl ? (
              <img
                src={asset.imageUrl}
                alt={asset.name}
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <Package className="h-10 w-10 text-slate-300" />
            )}
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {asset.name} {asset.model ? `/ ${asset.model}` : ""}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500">
              <div>
                รหัสครุภัณฑ์ (PID):{" "}
                <span className="font-bold text-slate-900">
                  {asset.id}
                </span>
              </div>
              <div>
                หมายเลขเครื่อง (S/N):{" "}
                <span className="font-bold text-slate-900">
                  {asset.serialNo || "-"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs sm:text-sm">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getStatusStyle(
                  asset.status?.code
                )}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${getDotColor(
                    asset.status?.code
                  )}`}
                />
                {asset.status?.name ?? "ไม่ระบุ"}
              </span>

              <div className="text-slate-500">
                หน่วยงานที่รับผิดชอบ:{" "}
                <span className="font-bold text-slate-900">
                  {asset.section?.name || "-"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ข้อมูลการจัดซื้อ */}
          <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-100 space-y-2.5">
            <h4 className="font-bold text-slate-900 text-sm mb-3">
              ข้อมูลการจัดซื้อ
            </h4>

            <div className="flex justify-between items-center text-xs sm:text-sm gap-2">
              <span className="text-slate-500 shrink-0">วันที่ตรวจรับ (RECEIVE):</span>
              <span className="font-bold text-slate-900 text-right">
                {formatThaiDate(asset.receivedDate)}
              </span>
            </div>

            <div className="text-xs sm:text-sm">
              <span className="text-slate-500 block mb-0.5">บริษัทที่จัดซื้อ (COMPANY):</span>
              <span className="font-bold text-slate-900 block leading-snug break-words">
                {asset.company?.name || "-"}
              </span>
            </div>

            <div className="text-xs sm:text-sm">
              <span className="text-slate-500 block mb-0.5">ราคาจัดซื้อ (KMONEY):</span>
              <span className="font-bold text-emerald-600 block text-sm sm:text-base leading-snug">
                {Number(asset.price || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                บาท
              </span>
            </div>

            <div className="flex justify-between items-center text-xs sm:text-sm gap-2">
              <span className="text-slate-500 shrink-0">ประเภทเงินงบประมาณ:</span>
              <span className="font-bold text-slate-900 text-right">
                -
              </span>
            </div>
          </div>

          {/* การรับประกันและค่าเสื่อม */}
          <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-100 space-y-2.5">
            <h4 className="font-bold text-slate-900 text-sm mb-3">
              การรับประกันและค่าเสื่อม
            </h4>

            <div className="flex justify-between items-center text-xs sm:text-sm gap-2">
              <span className="text-slate-500 shrink-0">วันที่หมดประกัน (Warranty):</span>
              <span className="font-bold text-slate-900 text-right">
                {formatThaiDate(asset.warrantyDate)}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs sm:text-sm gap-2">
              <span className="text-slate-500 shrink-0">สถานะประกัน:</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${underWarranty
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-rose-50 text-rose-600 border border-rose-200"
                  }`}
              >
                {underWarranty ? "อยู่ในประกัน" : "หมดประกัน"}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs sm:text-sm gap-2">
              <span className="text-slate-500 shrink-0">อายุการใช้งาน (Expired):</span>
              <span className="font-bold text-slate-900 text-right">
                -
              </span>
            </div>

            <div className="flex justify-between items-center text-xs sm:text-sm gap-2">
              <span className="text-slate-500 shrink-0">ใช้งานมาแล้ว:</span>
              <span className="font-bold text-slate-900 text-right">
                {calculateUsageTime(asset.receivedDate)}
              </span>
            </div>
          </div>
        </div>

        {/* ประวัติเครื่อง */}
        <div className="space-y-3 pt-1">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">ประวัติเครื่อง</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              คลิกเพื่อดูรายละเอียดประวัติการซ่อมบำรุงและการสอบเทียบของเครื่องนี้
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-sky-400 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-sky-600 hover:bg-sky-50 transition-colors"
            >
              <Wrench className="h-4 w-4" />
              ประวัติการซ่อม (0)
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-purple-400 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-purple-600 hover:bg-purple-50 transition-colors"
            >
              <BarChart2 className="h-4 w-4" />
              ประวัติการสอบเทียบ (0)
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-xl bg-slate-100 px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
