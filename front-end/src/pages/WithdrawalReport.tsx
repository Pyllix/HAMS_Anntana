import { formatThaiDisplayDateTime } from "../services/thaiDate";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Clock3, Eye, Search } from "lucide-react";
import { useServerPage, useDebouncedSearch } from "../hooks/useServerPage";
import { getSparePartTransactions } from "../services/sparePartTransactionService";
import QueryStatus from "../components/shared/QueryStatus";
import WithdrawalReportDetailModal from "../components/withdrawal-report/WithdrawalReportDetailModal";
import type {
  SparePartStockType,
  SparePartTransaction,
  SparePartTxnType,
} from "../types/TypeSparePartTransaction";



function formatDateTimeTH(dateString?: string | null): string {
  return formatThaiDisplayDateTime(dateString);
}

type TxnFilter = "ALL" | SparePartTxnType;

const txnTypeOptions: Array<{ value: TxnFilter; label: string }> = [
  { value: "ALL", label: "ทั้งหมด (เบิก + คืน)" },
  { value: "WITHDRAW", label: "เบิกอะไหล่" },
  { value: "RETURN", label: "คืนอะไหล่" },
  { value: "PENDING_WITHDRAW", label: "รอเบิก" },
];

const txnTypeBadge: Record<SparePartTxnType, { label: string; className: string }> = {
  WITHDRAW: { label: "เบิก", className: "bg-blue-50 text-blue-700" },
  RETURN: { label: "คืน", className: "bg-emerald-50 text-emerald-700" },
  PENDING_WITHDRAW: { label: "รอเบิก", className: "bg-amber-50 text-amber-700" },
};

const stockTypeLabel: Record<Exclude<SparePartStockType, null>, string> = {
  INTERNAL: "คลังภายใน",
  EXTERNAL: "จัดหาภายนอก",
};

export default function WithdrawalReport() {
  const [search, setSearch] = useState("");
  const [txnType, setTxnType] = useState<TxnFilter>("WITHDRAW");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selected, setSelected] = useState<SparePartTransaction | null>(null);

  const term = useDebouncedSearch(search);
  const invalidRange = Boolean(startDate && endDate && endDate < startDate);

  const listQuery = useServerPage<SparePartTransaction>(
    "sparePartTransactions",
    { search: term, txnType, startDate, endDate: invalidRange ? "" : endDate },
    (filters, signal) => getSparePartTransactions(filters, signal),
    false,
    !invalidRange,
  );
  const {
    rows,
    isLoading,
    isError,
    page,
    setPage,
    total,
    totalPages,
  } = listQuery;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden space-y-4">
      <div className="shrink-0">
        <h1 className="text-lg font-bold text-slate-900">รายงานการเบิกอะไหล่</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          ดูประวัติการเบิก/คืนอะไหล่สำหรับตรวจสอบ (ดูอย่างเดียว ไม่สามารถแก้ไขได้)
        </p>
      </div>

      <QueryStatus query={listQuery} />

      {/* Search & Filter Bar */}
      <div className="shrink-0 flex w-full flex-col flex-wrap items-start gap-4 rounded-lg bg-white p-4 shadow-2xs border border-slate-100 md:flex-row md:items-center">
        <div className="relative w-full flex-1 md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหารหัสอะไหล่ ชื่ออะไหล่ หรือรหัสงานซ่อม..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="relative inline-flex h-9 w-56 shrink-0 cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 text-xs transition-colors hover:border-slate-300">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-2">
            <span className="shrink-0 text-slate-500">ประเภท:</span>
            <span className="truncate font-semibold text-emerald-600">
              {txnTypeOptions.find((option) => option.value === txnType)?.label}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          <select
            aria-label="ประเภทรายการ"
            value={txnType}
            onChange={(event) => setTxnType(event.target.value as TxnFilter)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            {txnTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>ตั้งแต่</span>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-700 outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>ถึง</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-700 outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
            />
          </label>
        </div>
      </div>

      {invalidRange && (
        <p className="shrink-0 text-xs text-rose-600">
          วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น
        </p>
      )}

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-sm text-slate-600">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200 shadow-xs">
                <tr>
                  <th className="px-4 py-3.5 whitespace-nowrap">วันที่/เวลา</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">ประเภท</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">อะไหล่</th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-right">จำนวน</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">แหล่ง</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">รหัสงานซ่อม</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">ผู้บันทึก</th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      กำลังโหลดรายการ...
                    </td>
                  </tr>
                ) : isError && !listQuery.data ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-rose-500 text-sm">
                      ไม่สามารถโหลดรายการได้
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      ไม่พบรายการตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  rows.map((txn) => {
                    const badge = txnTypeBadge[txn.txnType];
                    const Icon =
                      txn.txnType === "RETURN"
                        ? ArrowDownLeft
                        : txn.txnType === "PENDING_WITHDRAW"
                          ? Clock3
                          : ArrowUpRight;
                    return (
                      <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap align-middle text-xs text-slate-600">
                          {formatDateTimeTH(txn.txnDate)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap align-middle">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <div className="min-w-[180px]">
                            <p className="text-sm font-semibold text-slate-900">
                              {txn.sparepart.name}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                              {txn.sparepart.code}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap align-middle text-right">
                          <span className="font-semibold text-slate-900">{txn.qty}</span>{" "}
                          <span className="text-xs text-slate-500">{txn.sparepart.unit}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap align-middle text-xs text-slate-600">
                          {txn.stockType ? stockTypeLabel[txn.stockType] : "-"}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap align-middle font-mono text-xs text-slate-700">
                          {txn.repairJob?.jobNo ?? "-"}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap align-middle text-xs text-slate-700">
                          {txn.recordedBy?.name ?? "-"}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap align-middle text-center">
                          <button
                            type="button"
                            title="ดูรายละเอียดทั้งหมด"
                            aria-label="ดูรายละเอียดทั้งหมด"
                            onClick={() => setSelected(txn)}
                            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
            <div className="text-xs text-slate-500 hidden sm:block">
              ทั้งหมด <span className="font-semibold text-slate-700">{total}</span> รายการ ·
              หน้า <span className="font-semibold text-slate-700">{page}</span> จาก{" "}
              <span className="font-semibold text-slate-700">{totalPages}</span>
            </div>

            <div className="flex items-center space-x-1.5 ml-auto sm:ml-0">
              <button
                type="button"
                onClick={() => setPage((old) => old - 1)}
                disabled={page <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {Array.from({ length: totalPages }, (_, index) => index + 1)
                .filter((pageNumber) => pageNumber >= page - 2 && pageNumber <= page + 2)
                .map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      pageNumber === page
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}

              <button
                type="button"
                onClick={() => setPage((old) => old + 1)}
                disabled={page >= totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <WithdrawalReportDetailModal
        transaction={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
