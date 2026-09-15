import React, { useMemo } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Image as ImageIcon,
} from "lucide-react";
import type { Asset } from "../../types/TypeAsset";
import { useEquipmentDetailModalStore } from "../../stores/useEquipmentDetailModalStore";
import { useEquipmentModalStore } from "../../stores/useEquipmentModalStore";

const features = tableFeatures({});

interface AssetTableProps {
  assets?: Asset[];
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function AssetTable({
  assets = [],
  isLoading = false,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
}: AssetTableProps) {
  const openDetail = useEquipmentDetailModalStore((state) => state.openModal);
  const openEdit = useEquipmentModalStore((state) => state.openEdit);

  const formatThaiDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "-";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear() + 543;
      return `${day}/${month}/${year}`;
    } catch {
      return "-";
    }
  };

  const isExpired = (warrantyDateStr?: string | null) => {
    if (!warrantyDateStr) return false;
    try {
      const d = new Date(warrantyDateStr);
      return d.getTime() < new Date().getTime();
    } catch {
      return false;
    }
  };

  const getStatusBadge = (code?: string, name?: string) => {
    switch (code) {
      case "NORMAL":
        return {
          text: name || "พร้อมใช้งาน",
          dot: "bg-emerald-500",
          textColor: "text-emerald-700",
        };
      case "LOST":
        return {
          text: name || "สูญหาย",
          dot: "bg-rose-500",
          textColor: "text-rose-600",
        };
      case "WAIT_DISPOSAL":
        return {
          text: name || "รอจำหน่าย",
          dot: "bg-amber-500",
          textColor: "text-amber-600",
        };
      case "DISPOSAL":
        return {
          text: name || "จำหน่ายออกแล้ว",
          dot: "bg-slate-400",
          textColor: "text-slate-600",
        };
      case "UNDER_REPAIR":
        return {
          text: name || "กำลังซ่อม",
          dot: "bg-blue-500",
          textColor: "text-blue-600",
        };
      case "DAMAGED":
        return {
          text: name || "ชำรุด",
          dot: "bg-orange-500",
          textColor: "text-orange-600",
        };
      default:
        return {
          text: name || "รอดำเนินการ",
          dot: "bg-amber-500",
          textColor: "text-amber-600",
        };
    }
  };

  const columns = useMemo<Array<ColumnDef<typeof features, Asset>>>(() => {
    return [
      {
        id: "image",
        header: "รูปภาพ",
        cell: (info) => {
          const imgUrl = info.row.original.imageUrl;
          return (
            <div className="flex items-center justify-center">
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt="Equipment"
                  className="h-10 w-10 rounded-full object-cover border border-slate-200 bg-slate-50"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 border border-slate-200">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "noid",
        header: "รหัสครุภัณฑ์",
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="font-semibold text-slate-800 text-sm font-mono">
              {row.noid || row.id.slice(0, 8)}
            </span>
          );
        },
      },
      {
        id: "name_model",
        header: "ชื่อครุภัณฑ์ / ยี่ห้อและรุ่น",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="max-w-xs">
              <div className="font-bold text-slate-800 text-sm truncate" title={row.name}>
                {row.name}
              </div>
              <div className="text-xs text-slate-400 truncate mt-0.5" title={row.model || row.company?.name}>
                {row.model} {row.company?.name ? `/ ${row.company.name}` : ""}
              </div>
            </div>
          );
        },
      },
      {
        id: "serialNo",
        header: "หมายเลขเครื่อง",
        cell: (info) => (
          <span className="text-xs text-slate-600 font-mono">
            {info.row.original.serialNo || "-"}
          </span>
        ),
      },
      {
        id: "section",
        header: "หน่วยงานที่รับผิดชอบ",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <div className="text-xs font-semibold text-slate-800">
                {row.section?.name || "-"}
              </div>
              {row.section?.building && (
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {row.section.building}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "dates",
        header: "วันที่รับ / หมดประกัน",
        cell: (info) => {
          const row = info.row.original;
          const expired = isExpired(row.warrantyDate);
          return (
            <div>
              <div className="text-xs font-medium text-slate-700">
                {formatThaiDate(row.receivedDate)}
              </div>
              {row.warrantyDate ? (
                <div
                  className={`text-[11px] mt-0.5 ${
                    expired ? "text-rose-500 font-medium" : "text-slate-400"
                  }`}
                >
                  {expired ? "หมดประกันแล้ว" : `ว/ด/ป หมด: ${formatThaiDate(row.warrantyDate)}`}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 mt-0.5">-</div>
              )}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "สถานะสต็อก",
        cell: (info) => {
          const status = info.row.original.status;
          const badge = getStatusBadge(status?.code, status?.name);
          return (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
              <span className={badge.textColor}>{badge.text}</span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "การดำเนินการ",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="แก้ไข"
                onClick={() => openEdit(row)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="ดูรายละเอียด"
                onClick={() => openDetail(row)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="px-2 py-1 text-[11px] font-medium rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                ดำเนินการต่อ
              </button>
            </div>
          );
        },
      },
    ];
  }, [openDetail, openEdit]);

  const table = useTable({
    key: "equipment-table",
    features,
    columns,
    data: assets,
  });

  const visiblePages = useMemo(() => {
    if (totalPages <= 3) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 2) {
      return [1, 2, 3];
    }
    if (currentPage >= totalPages - 1) {
      return [totalPages - 2, totalPages - 1, totalPages];
    }
    return [currentPage - 1, currentPage, currentPage + 1];
  }, [currentPage, totalPages]);

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-left">
          <thead className="font-bold text-md border-b border-slate-200 bg-white sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="py-2.5 px-4 font-bold text-slate-800 text-sm"
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
                  className="py-8 text-center text-slate-400 text-sm"
                >
                  กำลังโหลดข้อมูลครุภัณฑ์...
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-slate-400 text-sm"
                >
                  ไม่พบข้อมูลรายการครุภัณฑ์
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/50 transition-colors"
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

      {/* Pagination & Summary footer matching StockAssetsTable */}
      <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-2.5 border-t border-slate-100 text-sm text-slate-500 bg-white">
        <div>
          แสดง {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} ถึง{" "}
          {Math.min(currentPage * pageSize, totalItems)} จาก{" "}
          {totalItems.toLocaleString()} รายการ
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {visiblePages.map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              disabled={isLoading}
              onClick={() => onPageChange(pageNum)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                currentPage === pageNum
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {pageNum}
            </button>
          ))}

          <button
            type="button"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
