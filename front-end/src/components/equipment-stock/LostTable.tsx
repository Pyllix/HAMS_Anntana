import React, { useMemo } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Image as ImageIcon,
} from "lucide-react";
import type { Asset } from "../../types/TypeAsset";
import { useEquipmentDetailModalStore } from "../../stores/useEquipmentDetailModalStore";

const features = tableFeatures({});

interface LostTableProps {
  assets?: Asset[];
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const formatThaiDate = (dateStr?: string | null) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
};

export default function LostTable({
  assets = [],
  isLoading = false,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
}: LostTableProps) {
  const openDetail = useEquipmentDetailModalStore((state) => state.openModal);

  const columns = useMemo<Array<ColumnDef<typeof features, Asset>>>(() => {
    return [
      {
        id: "image",
        header: "รูปภาพ",
        size: 60,
        cell: (info) => {
          const imgUrl = info.row.original.imageUrl;
          return (
            <div className="flex items-center justify-center">
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget
                      .nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }}
                  className="h-10 w-10 rounded-md object-cover border border-gray-200 bg-gray-100"
                />
              ) : null}
              <div
                style={{ display: imgUrl ? "none" : "flex" }}
                className="h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-400 border border-gray-200"
              >
                <ImageIcon className="h-4 w-4" />
              </div>
            </div>
          );
        },
      },
      {
        id: "noid",
        header: "รหัสครุภัณฑ์",
        size: 120,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="font-semibold text-slate-800 text-xs font-mono truncate block">
              {row.noid || row.id.slice(0, 8)}
            </span>
          );
        },
      },
      {
        id: "name_model",
        header: "ชื่อครุภัณฑ์ / ยี่ห้อและรุ่น",
        size: 200,
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="min-w-0 pr-2">
              <div
                className="font-bold text-slate-800 text-xs truncate"
                title={row.name}
              >
                {row.name}
              </div>
              <div
                className="text-[11px] text-slate-400 truncate mt-0.5"
                title={row.model || row.company?.name}
              >
                {row.model} {row.company?.name ? `/ ${row.company.name}` : ""}
              </div>
            </div>
          );
        },
      },
      {
        id: "serialNo",
        header: "หมายเลขเครื่อง",
        size: 130,
        cell: (info) => (
          <span
            className="font-mono text-xs text-slate-600 font-medium truncate block"
            title={info.row.original.serialNo || "-"}
          >
            {info.row.original.serialNo || "-"}
          </span>
        ),
      },
      {
        id: "reason",
        header: "สาเหตุการสูญหาย",
        cell: (info) => {
          const row = info.row.original;
          const text = row.remark || "สูญหายระหว่างการตรวจนับ";
          return (
            <div className="min-w-0 pr-2">
              <span
                className="text-xs text-rose-600 font-semibold truncate block"
                title={text}
              >
                {text}
              </span>
            </div>
          );
        },
      },
      {
        id: "date",
        header: "วันที่พบว่าสูญหาย",
        size: 110,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
              {formatThaiDate(row.updatedAt || row.receivedDate)}
            </span>
          );
        },
      },
      {
        id: "status",
        header: "สถานะสต็อก",
        size: 125,
        cell: () => (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>สูญหาย</span>
          </span>
        ),
      },
      {
        id: "actions",
        header: "การดำเนินการ",
        size: 100,
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-center justify-center whitespace-nowrap">
              <button
                type="button"
                title="ดูรายละเอียด"
                onClick={() => openDetail(row)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        },
      },
    ];
  }, [openDetail]);

  const table = useTable({
    key: "lost-table",
    features,
    columns,
    data: assets,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable Container with Fixed Header */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="sticky top-0 z-10 bg-white border-b border-slate-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const colSize = (
                    header.column.columnDef as { size?: number }
                  ).size;
                  return (
                    <th
                      key={header.id}
                      style={{
                        width: colSize ? `${colSize}px` : undefined,
                      }}
                      className={`py-2.5 text-xs font-semibold text-slate-600 bg-white whitespace-nowrap ${
                        header.id === "image"
                          ? "pl-4 pr-2"
                          : header.id === "actions"
                          ? "px-3 text-center"
                          : "px-3"
                      }`}
                    >
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-10 text-xs text-slate-400"
                >
                  กำลังโหลดข้อมูล...
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-10 text-xs text-slate-400"
                >
                  ไม่พบข้อมูลครุภัณฑ์ที่สูญหาย
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`py-2.5 align-middle text-xs ${
                        cell.column.id === "image"
                          ? "pl-4 pr-2"
                          : cell.column.id === "actions"
                          ? "px-3"
                          : "px-3"
                      }`}
                    >
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
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-white shrink-0 text-xs text-slate-500">
        <div>
          แสดง {(currentPage - 1) * pageSize + 1} ถึง{" "}
          {Math.min(currentPage * pageSize, totalItems)} จาก {totalItems} รายการ
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              if (totalPages <= 5) return true;
              return Math.abs(p - currentPage) <= 1 || p === 1 || p === totalPages;
            })
            .map((p, idx, arr) => (
              <React.Fragment key={p}>
                {idx > 0 && p - arr[idx - 1] > 1 && (
                  <span className="px-1 text-slate-400">...</span>
                )}
                <button
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`min-w-6 h-6 px-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                    p === currentPage
                      ? "bg-emerald-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {p}
                </button>
              </React.Fragment>
            ))}
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
