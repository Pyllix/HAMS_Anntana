import { useEffect, useMemo, useState } from "react";
import {
  tableFeatures,
  useTable,
  rowPaginationFeature,
  createPaginatedRowModel,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ClipboardCheck, Eye } from "lucide-react";
import { RepairJob, RepairStatusFilter } from "../../types/TypeRepairWorkflow";
import { useConfirmRepairModalStore } from "../../stores/useConfirmRepairModalStore";
import { useRepairHistoryModalStore } from "../../stores/useRepairHistoryModalStore";
import { getRepairConfirmations } from "../../services/confirmRepairService";

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

function formatDateTH(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

interface ConfirmRepairTableProps {
  search?: string;
  status?: RepairStatusFilter;
}

export default function ConfirmRepairTable({
  search = "",
  status = "ALL",
}: ConfirmRepairTableProps) {
  const openConfirm = useConfirmRepairModalStore((state) => state.openModal);
  const openDetail = useRepairHistoryModalStore((state) => state.openModal);

  const {
    data: jobs = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["repairConfirmations"],
    queryFn: getRepairConfirmations,
  });

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch =
        !keyword ||
        job.jobNo.toLowerCase().includes(keyword) ||
        job.asset?.assetName.toLowerCase().includes(keyword) ||
        job.asset?.assetCode.toLowerCase().includes(keyword) ||
        job.symptom.toLowerCase().includes(keyword);
      const matchesStatus =
        status === "ALL" || job.status?.statusCode === status;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, search, status]);

  const columns = useMemo<Array<ColumnDef<typeof features, RepairJob>>>(
    () => [
      {
        id: "jobNo",
        header: "รหัสงาน",
        cell: (info) => (
          <span className="whitespace-nowrap font-semibold text-gray-900 font-mono">
            {info.row.original.jobNo}
          </span>
        ),
      },
      {
        id: "asset",
        header: "รายการครุภัณฑ์",
        cell: (info) => {
          const job = info.row.original;
          return (
            <div>
              <div className="font-semibold text-gray-900">
                {job.asset?.assetName || "-"}
              </div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">
                {job.asset?.serialNumber || "-"} / {job.asset?.assetCode || "-"}
              </div>
            </div>
          );
        },
      },
      {
        id: "symptom",
        header: "อาการเสียที่แจ้ง",
        cell: (info) => (
          <span className="text-slate-600 line-clamp-2 max-w-xs">
            {info.row.original.symptom || "-"}
          </span>
        ),
      },
      {
        id: "status",
        header: "สถานะ",
        cell: (info) => {
          const completed =
            info.row.original.status?.statusCode === "COMPLETED";
          return (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                completed
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {completed ? "ตรวจรับแล้ว" : "รอตรวจรับ"}
            </span>
          );
        },
      },
      {
        id: "createdAt",
        header: "วันที่แจ้งซ่อม",
        cell: (info) => (
          <span className="text-slate-600 whitespace-nowrap">
            {formatDateTH(info.row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "detail",
        header: "รายละเอียด",
        cell: (info) => (
          <button
            type="button"
            title="ดูรายละเอียดงาน"
            onClick={() => openDetail(info.row.original)}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <Eye className="h-4 w-4" />
          </button>
        ),
      },
      {
        id: "actions",
        header: "จัดการ",
        cell: (info) => {
          const job = info.row.original;
          const completed = job.status?.statusCode === "COMPLETED";
          return completed ? (
            <button
              type="button"
              disabled
              className="h-8 cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-400"
            >
              ปิดงานแล้ว
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openConfirm(job)}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              ตรวจรับ
            </button>
          );
        },
      },
    ],
    [openConfirm, openDetail],
  );

  const table = useTable({
    key: "confirm-repair-table",
    features,
    columns,
    data: filteredData,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
  });

  useEffect(() => {
    table.setPageIndex(0);
  }, [search, status]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-sm text-slate-600">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3">
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
                  className="text-center py-12 text-slate-400"
                >
                  กำลังโหลดรายการรอยืนยัน...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-rose-500 text-sm"
                >
                  ไม่สามารถโหลดรายการยืนยันการซ่อมได้
                </td>
              </tr>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="py-3.5 px-4 whitespace-nowrap align-middle"
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12 text-slate-400"
                >
                  ไม่พบรายการที่รอยืนยันการซ่อม
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination - ใช้โครงสร้างเดียวกับ AvailableAssetsTable */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
        <div className="text-xs text-slate-500 hidden sm:block">
          หน้า{" "}
          <span className="font-semibold text-slate-700">
            {table.state.pagination.pageIndex + 1}
          </span>{" "}
          จาก{" "}
          <span className="font-semibold text-slate-700">
            {table.getPageCount() || 1}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 ml-auto sm:ml-0">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {Array.from({ length: table.getPageCount() }, (_, index) => {
            const pageNumber = index + 1;
            const currentPage = table.state.pagination.pageIndex;
            const isCurrentPage = currentPage === index;

            if (index < currentPage - 2 || index > currentPage + 2) return null;

            return (
              <button
                key={pageNumber}
                type="button"
                onClick={() => table.setPageIndex(index)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                  isCurrentPage
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {pageNumber}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
