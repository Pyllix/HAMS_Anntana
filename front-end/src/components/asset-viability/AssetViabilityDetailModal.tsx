import React from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Wrench,
  Package,
  Calendar,
  Building,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAssetViabilityDetail } from "../../services/assetViabilityService";
import type { DisposalPrefillData } from "../../types/TypeAssetViability";

interface AssetViabilityDetailModalProps {
  assetId: string | null;
  onClose: () => void;
  onRequestDisposal: (prefill: DisposalPrefillData) => void;
}

export default function AssetViabilityDetailModal({
  assetId,
  onClose,
  onRequestDisposal,
}: AssetViabilityDetailModalProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["asset-viability-detail", assetId],
    queryFn: () => getAssetViabilityDetail(assetId!),
    enabled: Boolean(assetId),
  });

  if (!assetId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-base font-bold text-slate-900">
                {data?.asset?.noid || data?.asset?.id || "รหัสครุภัณฑ์"}
              </span>

              {data?.viability?.status === "VIABLE" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  คุ้มค่าในการซ่อม
                </span>
              )}
              {data?.viability?.status === "WARNING" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  เฝ้าระวัง / ใกล้เกินเกณฑ์
                </span>
              )}
              {data?.viability?.status === "UNVIABLE" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  ไม่คุ้มค่า / ควรแทงจำหน่าย
                </span>
              )}

              {data?.asset?.status && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                  สถานะ: {data.asset.status.name}
                </span>
              )}
            </div>

            <h3 className="text-sm font-bold text-slate-800 mt-1">
              {data?.asset?.name || "กำลังโหลด..."}
            </h3>
            <p className="text-xs text-slate-500">
              {data?.asset?.model && `รุ่น: ${data.asset.model}`}
              {data?.asset?.serialNo && ` | S/N: ${data.asset.serialNo}`}
              {data?.asset?.section?.name && ` | แผนก: ${data.asset.section.name}`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700 custom-scrollbar">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-2" />
              <span>กำลังวิเคราะห์ความคุ้มค่า...</span>
            </div>
          ) : error || !data ? (
            <div className="py-12 text-center text-rose-500">
              ไม่สามารถโหลดข้อมูลการวิเคราะห์ความคุ้มค่าได้
            </div>
          ) : (
            <>
              {/* Reason / Decision Tree Alert Box */}
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                  data.viability.status === "VIABLE"
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                    : data.viability.status === "WARNING"
                    ? "bg-amber-50/70 border-amber-200 text-amber-950"
                    : "bg-rose-50/70 border-rose-200 text-rose-950"
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {data.viability.status === "VIABLE" && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                  {data.viability.status === "WARNING" && (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                  {data.viability.status === "UNVIABLE" && (
                    <AlertOctagon className="w-5 h-5 text-rose-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-xs uppercase tracking-wider mb-1">
                    ผลการวิเคราะห์ความคุ้มค่าตามระเบียบพัสดุ
                  </h4>
                  <p className="leading-relaxed font-medium">
                    {data.viability.reason}
                  </p>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    ราคาซื้อเริ่มต้น
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    ฿{data.viability.financials.originalPrice.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    ค่าซ่อมสะสมรวม
                  </span>
                  <span
                    className={`font-bold text-sm ${
                      (data.viability.costRatioPercentage || 0) >= 70
                        ? "text-rose-600"
                        : (data.viability.costRatioPercentage || 0) >= 50
                        ? "text-amber-600"
                        : "text-slate-900"
                    }`}
                  >
                    ฿{data.viability.financials.cumulativeRepairCost.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    สัดส่วนค่าซ่อมสะสม
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`font-bold text-sm ${
                        (data.viability.costRatioPercentage || 0) >= 70
                          ? "text-rose-600"
                          : (data.viability.costRatioPercentage || 0) >= 50
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {data.viability.costRatioPercentage !== null
                        ? `${data.viability.costRatioPercentage.toFixed(1)}%`
                        : "-"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      (เกณฑ์วิกฤต ≥ 70%)
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    อายุเครื่อง / อายุขัย
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-900 text-sm">
                      {data.viability.ageYears} ปี
                    </span>
                    <span className="text-slate-400">
                      / {data.viability.usefulLifeYears} ปี
                    </span>
                    {data.viability.isUsefulLifeExceeded && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                        ครบอายุขัย
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Bar for Cost Ratio */}
              <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600">
                    กราฟสัดส่วนค่าซ่อมสะสมต่อราคาจัดซื้อ
                  </span>
                  <span
                    className={
                      (data.viability.costRatioPercentage || 0) >= 70
                        ? "text-rose-600"
                        : (data.viability.costRatioPercentage || 0) >= 50
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }
                  >
                    {data.viability.costRatioPercentage !== null
                      ? `${data.viability.costRatioPercentage.toFixed(1)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      (data.viability.costRatioPercentage || 0) >= 70
                        ? "bg-rose-500"
                        : (data.viability.costRatioPercentage || 0) >= 50
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(100, data.viability.costRatioPercentage || 0)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0% (ปกติ)</span>
                  <span>50% (เฝ้าระวัง)</span>
                  <span className="text-rose-500 font-semibold">
                    70% (เกณฑ์แทงจำหน่าย)
                  </span>
                  <span>100%+</span>
                </div>
              </div>

              {/* Cost Breakdown Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-slate-100/60 rounded-xl text-slate-600 text-[11px]">
                <div>
                  <span className="text-slate-400">ค่าจ้างซ่อมภายนอก:</span>{" "}
                  <strong className="text-slate-800">
                    ฿{data.viability.financials.totalOutsourceCost.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                    })}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">ค่าอะไหล่เบิกใช้:</span>{" "}
                  <strong className="text-slate-800">
                    ฿{data.viability.financials.totalSparePartsCost.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                    })}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">ความถี่การซ่อม:</span>{" "}
                  <strong className="text-slate-800">
                    {data.viability.totalRepairCount} ครั้ง (ในรอบปี: {data.viability.recentRepairCount} ครั้ง)
                  </strong>
                </div>
              </div>

              {/* Historical Repair Jobs */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-slate-400" />
                    <span>ประวัติงานซ่อมบำรุงและรายการอะไหล่ในอดีต (Repair History)</span>
                  </h4>
                  <span className="text-slate-400 text-[11px]">
                    {data.repairHistory?.length || 0} รายการ
                  </span>
                </div>

                {data.repairHistory?.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center text-slate-400">
                    ไม่มีประวัติงานซ่อมบำรุงในอดีต
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {data.repairHistory.map((job) => (
                      <div
                        key={job.jobId}
                        className="p-3 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/60 transition-colors space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              {job.jobNo}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 font-medium text-slate-600">
                              {job.reportType}
                            </span>
                            {job.actionType && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 font-medium">
                                {job.actionType}
                              </span>
                            )}
                          </div>
                          <span className="text-slate-400 text-[10px]">
                            {new Date(job.createdAt).toLocaleDateString("th-TH")}
                          </span>
                        </div>

                        {job.symptom && (
                          <p className="text-slate-600 text-[11px]">
                            <span className="text-slate-400">อาการ: </span>
                            {job.symptom}
                          </p>
                        )}
                        {job.solution && (
                          <p className="text-slate-600 text-[11px]">
                            <span className="text-slate-400">การแก้ไข: </span>
                            {job.solution}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                          <span className="text-slate-400">
                            อะไหล่: {job.spareParts?.length || 0} รายการ | ซ่อมภายนอก: ฿{job.outsourceCost.toLocaleString()}
                          </span>
                          <span className="font-bold text-slate-900">
                            รวม: ฿{job.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {job.spareParts?.length > 0 && (
                          <div className="bg-slate-50 rounded-lg p-2 text-[10px] text-slate-600 space-y-0.5">
                            {job.spareParts.map((sp, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>
                                  • {sp.name} ({sp.code}) x {sp.qty}
                                </span>
                                <span className="font-mono font-semibold">
                                  ฿{sp.totalPrice.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Disposal Recommendation & Action Box (แสดงเฉพาะกรณีประเมินแล้วไม่คุ้มค่า UNVIABLE) */}
              {data.viability.status === "UNVIABLE" && (
                <div className="p-4 rounded-2xl border space-y-3 bg-rose-50/70 border-rose-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">
                        ข้อเสนอแนะเชิงนโยบายพัสดุ:
                      </span>
                      <span className="font-bold px-2 py-0.5 rounded text-[11px] bg-rose-200 text-rose-900">
                        {data.disposalRecommendation.actionLabel}
                      </span>
                    </div>
                  </div>

                  {data.disposalRecommendation.canInitiateDisposal ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                      <p className="text-[11px] text-rose-800">
                        ครุภัณฑ์นี้เข้าเกณฑ์ไม่คุ้มค่าซ่อม สามารถกดเสนอเพื่อล็อกเครื่องเข้าสู่สถานะ <strong>"รอจำหน่าย" (WAIT_DISPOSAL)</strong> ได้ทันที
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onRequestDisposal(
                            data.disposalRecommendation.prefillData,
                          );
                          onClose();
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                      >
                        <span>เสนอขอแทงจำหน่าย</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      ไม่สามารถเสนอขอแทงจำหน่ายได้ในขณะนี้
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
          <span className="text-[11px] text-slate-400">
            เกณฑ์มาตรฐานระเบียบพัสดุ
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
