import { getPartOrdersPage, getLocalPartOrderDrafts } from "../../services/partOrderService";
import { getSparepartGroups } from "../../services/sparepartService";
import { useServerPage, useDebouncedSearch, useForegroundQuery } from "../../hooks/useServerPage";
import { getPage } from "../../services/pagedApi";
import QueryStatus from "../shared/QueryStatus";
import { useMemo, useState, useEffect } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPartOrders } from "../../services/partOrderService";
import { getSpareParts } from "../../services/sparepartService";
import type { PartOrder } from "../../types/TypePartOrder";
import { usePartOrderModalStore } from "../../stores/usePartOrderModalStore";

const features = tableFeatures({});

// ─── Columns Definition ───────────────────────────────────────────────────────

const columns: Array<ColumnDef<typeof features, PartOrder>> = [
  {
    id: "orderNo",
    header: "รหัสคำสั่งซื้อ",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="font-bold text-slate-900 font-mono text-sm whitespace-nowrap">
          {row.orderNo}
        </span>
      );
    },
  },
  {
    id: "partDetails",
    header: "รายการอะไหล่",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="space-y-0.5 py-0.5 min-w-[180px] max-w-xs">
          <div className="font-bold text-slate-900 text-sm leading-snug break-words">
            {row.partName}
          </div>
          <div>
            <span className="inline-flex items-center text-3xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/50">
              หมวดหมู่: {row.category}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    id: "quantity",
    header: "จำนวน",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="text-sm font-bold text-slate-800 whitespace-nowrap">
          {row.quantity} {row.unit || "ชิ้น"}
        </span>
      );
    },
  },
  {
    id: "unitPrice",
    header: "ราคา/หน่วย",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="text-sm text-slate-700 font-mono whitespace-nowrap">
          {row.unitPrice !== undefined
            ? Number(row.unitPrice).toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "-"}
        </span>
      );
    },
  },
  {
    id: "totalPrice",
    header: "ราคารวม (บาท)",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="text-sm font-bold text-emerald-700 font-mono whitespace-nowrap">
          {row.totalPrice !== undefined
            ? Number(row.totalPrice).toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "-"}
        </span>
      );
    },
  },
  {
    id: "orderDate",
    header: "วันที่สั่งซื้อ",
    cell: (info) => {
      const row = info.row.original;
      if (!row.orderDate) {
        return <span className="text-xs text-slate-400 font-mono">-</span>;
      }
      if (row.orderDate.includes("-")) {
        const parts = row.orderDate.split("-");
        if (parts.length === 3) {
          const [y, m, d] = parts;
          const thaiYear = parseInt(y) + 543;
          return (
            <span className="text-xs text-slate-700 font-mono whitespace-nowrap">
              {d}/{m}/{thaiYear}
            </span>
          );
        }
      }
      return (
        <span className="text-xs text-slate-700 font-mono whitespace-nowrap">
          {row.orderDate}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "การดำเนินการ",
    cell: (info) => {
      const row = info.row.original;
      const { openDetailModal } = usePartOrderModalStore.getState();

      return (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => openDetailModal(row)}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
            title="ดูรายละเอียด"
          >
            <Eye className="h-3.5 w-3.5 text-slate-400" />
            ดู
          </button>
        </div>
      );
    },
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

interface PartOrderTableProps {
  search?: string;
  dateFilter?: string;
  categoryFilter?: string;
}

export default function PartOrderTable({
  search = "",
  dateFilter = "ALL",
  categoryFilter = "ALL",
}: PartOrderTableProps) {
  const term = useDebouncedSearch(search);
  const { data: groups } = useQuery({ queryKey: ["sparepartGroups"], queryFn: getSparepartGroups });
  const listQuery = useServerPage<PartOrder>("partOrders", {
    search: term,
    startDate: dateFilter && dateFilter !== "ALL" ? dateFilter : undefined,
    endDate: dateFilter && dateFilter !== "ALL" ? dateFilter : undefined,
    groupId: categoryFilter !== "ALL" ? groups?.find((g) => g.name === categoryFilter)?.id : undefined,
  }, getPartOrdersPage);
  const { isLoading, page: currentPage, setPage: setCurrentPage, pageSize, total: totalItems, totalPages } = listQuery;
  const paginatedData = listQuery.rows;
  const draftsQuery = useForegroundQuery(["partOrders", "local-drafts"], () => Promise.resolve(getLocalPartOrderDrafts()));
  const localDrafts = draftsQuery.data ?? [];
  const table = useTable({
    key: "part-order-table",
    features,
    columns,
    data: paginatedData,
  });

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <QueryStatus query={listQuery} />
      {localDrafts.length > 0 && <details className="border-b border-amber-200 bg-amber-50 p-3 text-xs">
        <summary>ข้อมูลรับเข้าในเครื่อง ยังไม่ยืนยันกับเซิร์ฟเวอร์ (ไม่นับในยอด)</summary>
        <LocalPartOrderDraftTable rows={localDrafts} />
      </details>}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-left border-collapse">
          <thead className="border-b border-slate-200 bg-white sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="py-2.5 px-4 font-bold text-slate-800 whitespace-nowrap text-sm"
                  >
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-slate-400 text-sm whitespace-nowrap"
                >
                  กำลังโหลดข้อมูลการสั่งซื้ออะไหล่...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-slate-400 text-sm whitespace-nowrap"
                >
                  ไม่พบข้อมูลคำสั่งซื้ออะไหล่
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="py-2.5 px-4 align-middle text-sm">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-2.5 border-t border-slate-100 text-sm text-slate-500 bg-white">
        <div>
          แสดง {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} ถึง{" "}
          {Math.min(currentPage * pageSize, totalItems)} จาก{" "}
          {totalItems.toLocaleString()} รายการ
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, currentPage - 3), currentPage + 2)
            .map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                  currentPage === page
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {page}
              </button>
            ))}
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function LocalPartOrderDraftTable({ rows }: { rows: PartOrder[] }) {
  const table = useTable({ key: "LocalPartOrderDraftTable", features, columns, data: rows });
  return <div className="overflow-auto"><table className="w-full text-left text-sm">
    <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className="px-4 py-2"><table.FlexRender header={header} /></th>)}</tr>)}</thead>
    <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getAllCells().map((cell) => <td key={cell.id} className="px-4 py-2"><table.FlexRender cell={cell} /></td>)}</tr>)}</tbody>
  </table></div>;
}
