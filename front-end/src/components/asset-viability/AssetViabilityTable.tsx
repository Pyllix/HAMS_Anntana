import React from "react";
import {
  FileText,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Calendar,
  Building,
} from "lucide-react";
import StockTablePagination from "../equipment-stock/StockTablePagination";
import type {
  AssetViabilityItem,
  DisposalPrefillData,
} from "../../types/TypeAssetViability";

interface AssetViabilityTableProps {
  items: AssetViabilityItem[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onOpenDetail: (assetId: string) => void;
  onRequestDisposal: (prefill: DisposalPrefillData) => void;
}

export default function AssetViabilityTable({
  items,
  isLoading,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onOpenDetail,
  onRequestDisposal,
}: AssetViabilityTableProps) {
  const getViabilityBadge = (status: string) => {
    switch (status) {
      case "VIABLE":
        return {
          text: "คุ้มค่าในการซ่อม",
          dot: "bg-emerald-500",
          textColor: "text-emerald-700",
          bgColor: "bg-emerald-50 border border-emerald-200",
        };
      case "WARNING":
        return {
          text: "เฝ้าระวัง / ใกล้เกินเกณฑ์",
          dot: "bg-amber-500",
          textColor: "text-amber-700",
          bgColor: "bg-amber-50 border border-amber-200",
        };
      case "UNVIABLE":
        return {
          text: "ไม่คุ้มซ่อม / ควรแทงจำหน่าย",
          dot: "bg-rose-500",
          textColor: "text-rose-700",
          bgColor: "bg-rose-50 border border-rose-200",
        };
      default:
        return {
          text: status,
          dot: "bg-slate-400",
          textColor: "text-slate-700",
          bgColor: "bg-slate-50 border border-slate-200",
        };
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Scrollable Container with Fixed Header */}
      <div className="flex-1 min-h-0 table-scroll">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200 shadow-sm">
            <tr>
              <th className="py-3.5 px-3">รหัส / รายการครุภัณฑ์</th>
              <th className="py-3.5 px-3 w-[120px] text-right">ราคาจัดซื้อ</th>
              <th className="py-3.5 px-3 w-[125px] text-center">อายุ / อายุขัย</th>
              <th className="py-3.5 px-3 w-[85px] text-center">ครั้งซ่อม</th>
              <th className="py-3.5 px-3 w-[170px]">ค่าซ่อมสะสม / สัดส่วน</th>
              <th className="py-3.5 px-3 w-[145px] text-center">สถานะความคุ้มค่า</th>
              <th className="py-3.5 px-3 w-[110px] text-center">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  กำลังประเมินความคุ้มค่า...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  ไม่พบรายการครุภัณฑ์ตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const badge = getViabilityBadge(row.viabilityStatus);
                const costRatio = row.metrics?.costRatioPercentage ?? 0;
                const isWaitDisposal = row.assetStatus?.code === "WAIT_DISPOSAL";
                const isDisposed = row.assetStatus?.code === "DISPOSAL";
                const canRequestDisposal =
                  row.viabilityStatus === "UNVIABLE" &&
                  !isWaitDisposal &&
                  !isDisposed;

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* รหัส / รายการครุภัณฑ์ */}
                    <td className="py-3 px-3 align-middle">
                      <div className="font-mono text-xs font-semibold text-slate-800">
                        {row.noid || "-"}
                      </div>
                      <div className="font-bold text-slate-900 line-clamp-1 mt-0.5">
                        {row.name}
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">
                        {row.model && `รุ่น: ${row.model}`}
                        {row.section?.name && ` • ${row.section.name}`}
                      </div>
                    </td>

                    {/* ราคาจัดซื้อ */}
                    <td className="py-3 px-3 align-middle text-right">
                      <div className="font-semibold text-slate-900">
                        ฿{row.price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </div>
                      {row.receivedDate && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          รับ: {new Date(row.receivedDate).toLocaleDateString("th-TH")}
                        </div>
                      )}
                    </td>

                    {/* อายุ / เกณฑ์อายุขัย */}
                    <td className="py-3 px-3 align-middle text-center">
                      <div className="font-semibold text-slate-800">
                        {row.metrics?.ageYears ?? 0} ปี{" "}
                        <span className="text-slate-400 font-normal">
                          / {row.metrics?.usefulLifeYears ?? row.assetType?.usefulLife ?? "-"} ปี
                        </span>
                      </div>
                      {row.metrics?.isUsefulLifeExceeded && (
                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 mt-0.5">
                          ครบอายุขัย
                        </span>
                      )}
                    </td>

                    {/* จำนวนครั้งซ่อม */}
                    <td className="py-3 px-3 align-middle text-center">
                      <div className="font-bold text-slate-800">
                        {row.metrics?.totalRepairCount ?? 0} ครั้ง
                      </div>
                      {row.metrics?.recentRepairCount > 0 && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          (รอบปี: {row.metrics.recentRepairCount} ครั้ง)
                        </div>
                      )}
                    </td>

                    {/* ค่าซ่อมสะสม / สัดส่วน (%) */}
                    <td className="py-3 px-3 align-middle">
                      <div className="flex items-baseline justify-between text-xs mb-1">
                        <span
                          className={`font-bold ${
                            costRatio >= 70
                              ? "text-rose-600"
                              : costRatio >= 50
                              ? "text-amber-600"
                              : "text-slate-900"
                          }`}
                        >
                          ฿
                          {(row.metrics?.cumulativeRepairCost ?? 0).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <span
                          className={`font-semibold ml-1.5 ${
                            costRatio >= 70
                              ? "text-rose-600"
                              : costRatio >= 50
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {costRatio.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            costRatio >= 70
                              ? "bg-rose-500"
                              : costRatio >= 50
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, costRatio)}%` }}
                        />
                      </div>
                    </td>

                    {/* สถานะความคุ้มค่า */}
                    <td className="py-3 px-3 align-middle text-center">
                      <div
                        className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${badge.bgColor}`}
                        title={row.viabilityReason}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                        <span className={badge.textColor}>{badge.text}</span>
                      </div>
                    </td>

                    {/* การดำเนินการ */}
                    <td className="py-3 px-3 align-middle text-center">
                      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          title="วิเคราะห์เชิงลึก"
                          onClick={() => onOpenDetail(row.id)}
                          className="flex h-7 px-2 items-center gap-1 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer text-xs font-medium"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-500" />
                          <span>เจาะลึก</span>
                        </button>

                        {canRequestDisposal && (
                          <button
                            type="button"
                            title="เสนอขอแทงจำหน่าย"
                            onClick={() =>
                              onRequestDisposal({
                                assetId: row.id,
                                noid: row.noid,
                                name: row.name,
                                price: row.price,
                                cumulativeRepairCost:
                                  row.metrics?.cumulativeRepairCost ?? 0,
                                costRatioPercentage:
                                  row.metrics?.costRatioPercentage ?? null,
                                suggestedDisposalReason: `แทงจำหน่ายเนื่องจากประเมินแล้วซ่อมไม่คุ้มค่า: ${row.viabilityReason}`,
                                suggestedDocPrefix: `DISP-${new Date().getFullYear() + 543}-`,
                              })
                            }
                            className="flex h-7 px-2 items-center gap-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer text-xs font-semibold"
                          >
                            <Trash2 className="h-3 w-3 text-rose-600" />
                            <span>แทงจำหน่าย</span>
                          </button>
                        )}

                        {isWaitDisposal && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold bg-rose-50 border border-rose-200 text-rose-600">
                            รอจำหน่ายแล้ว
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <StockTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
