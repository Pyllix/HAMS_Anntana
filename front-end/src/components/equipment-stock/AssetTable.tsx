import React, { useMemo, useState } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  Pencil,
  Clock,
  AlertTriangle,
  Image as ImageIcon,
  XCircle,
} from "lucide-react";
import type { Asset } from "../../types/TypeAsset";
import { useEquipmentDetailModalStore } from "../../stores/useEquipmentDetailModalStore";
import { useEquipmentModalStore } from "../../stores/useEquipmentModalStore";
import { useDisposalModalStore } from "../../stores/useDisposalModalStore";

const features = tableFeatures({});

interface AssetTableProps {
  assets?: Asset[];
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  activeTab?: string;
}

export default function AssetTable({
  assets = [],
  isLoading = false,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  activeTab = "ALL",
}: AssetTableProps) {
  const openDetail = useEquipmentDetailModalStore((state) => state.openModal);
  const openEdit = useEquipmentModalStore((state) => state.openEdit);
  const { openWaitDisposal, openConfirmDisposal, openMarkLost } =
    useDisposalModalStore();

  const [openActionDropdown, setOpenActionDropdown] = useState<string | null>(
    null
  );

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
          bgColor: "bg-emerald-50 border border-emerald-200",
        };
      case "LOST":
        return {
          text: name || "สูญหาย",
          dot: "bg-rose-500",
          textColor: "text-rose-600",
          bgColor: "bg-rose-50 border border-rose-200",
        };
      case "DAMAGED":
        return {
          text: name || "ชำรุด",
          dot: "bg-orange-500",
          textColor: "text-orange-600",
          bgColor: "bg-orange-50 border border-orange-200",
        };
      case "UNDER_REPAIR":
        return {
          text: name || "กำลังซ่อม",
          dot: "bg-sky-500",
          textColor: "text-sky-600",
          bgColor: "bg-sky-50 border border-sky-200",
        };
      case "WAIT_DISPOSAL":
        return {
          text: name || "รอจำหน่าย",
          dot: "bg-amber-500",
          textColor: "text-amber-700",
          bgColor: "bg-amber-50 border border-amber-200",
        };
      case "DISPOSAL":
        return {
          text: name || "จำหน่ายแล้ว",
          dot: "bg-slate-500",
          textColor: "text-slate-600",
          bgColor: "bg-slate-100 border border-slate-200",
        };
      default:
        return {
          text: name || "พร้อมใช้งาน",
          dot: "bg-emerald-500",
          textColor: "text-emerald-700",
          bgColor: "bg-emerald-50 border border-emerald-200",
        };
    }
  };

  const columns = useMemo<Array<ColumnDef<typeof features, Asset>>>(() => {
    const isWaitDisposalTab = activeTab === "WAIT_DISPOSAL";

    if (isWaitDisposalTab) {
      // Columns specifically matching Image 1 for "รอจำหน่าย"
      return [
        {
          id: "image",
          header: "รูปภาพ",
          size: 48,
          cell: (info) => {
            const imgUrl = info.row.original.imageUrl;
            return (
              <div className="flex items-center justify-center">
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt="Equipment"
                    className="h-9 w-9 rounded-xl object-cover border border-slate-200 bg-slate-50"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400 border border-slate-200">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          },
        },
        {
          id: "noid",
          header: "รหัสครุภัณฑ์",
          size: 95,
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
          size: 145,
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
          size: 110,
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
          header: "เหตุผลการจำหน่าย",
          cell: (info) => {
            const row = info.row.original;
            const text = row.remark || "ซ่อมไม่คุ้มค่า / ผู้บริหารไม่อนุมัติ";
            return (
              <div className="min-w-0 pr-2">
                <span
                  className="text-xs text-slate-700 font-medium truncate block"
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
          header: "วันที่ทำรายการ",
          size: 90,
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
          size: 95,
          cell: (info) => {
            const status = info.row.original.status;
            const badge = getStatusBadge(status?.code, status?.name);
            return (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${badge.bgColor}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                <span className={badge.textColor}>{badge.text}</span>
              </span>
            );
          },
        },
        {
          id: "actions",
          header: "การดำเนินการ",
          size: 175,
          cell: (info) => {
            const row = info.row.original;
            const isOpen = openActionDropdown === `wait-${row.id}`;

            return (
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <button
                  type="button"
                  title="ดูรายละเอียด"
                  onClick={() => openDetail(row)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>

                {/* Dropdown ดำเนินการ with จำหน่าย & ปรับเป็นสูญหาย */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenActionDropdown(isOpen ? null : `wait-${row.id}`)
                    }
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <span>ดำเนินการ</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>

                  {isOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setOpenActionDropdown(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-30 animate-in fade-in zoom-in-95">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionDropdown(null);
                            openConfirmDisposal(row);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5 text-rose-500" />
                          <span className="font-semibold">จำหน่าย</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionDropdown(null);
                            openMarkLost(row);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left cursor-pointer"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-semibold">ปรับเป็นสูญหาย</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          },
        },
      ];
    }

    // Default Main Stock Columns (Tab: ALL, DISPOSAL, LOST)
    return [
      {
        id: "image",
        header: "รูปภาพ",
        size: 48,
        cell: (info) => {
          const imgUrl = info.row.original.imageUrl;
          return (
            <div className="flex items-center justify-center">
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt="Equipment"
                  className="h-9 w-9 rounded-full object-cover border border-slate-200 bg-slate-50"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 border border-slate-200">
                  <ImageIcon className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "noid",
        header: "รหัสครุภัณฑ์",
        size: 95,
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
        size: 160,
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
        size: 115,
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
        id: "department",
        header: "หน่วยงานที่รับผิดชอบ",
        cell: (info) => {
          const section = info.row.original.section;
          return (
            <div className="min-w-0 pr-2">
              <div className="text-xs font-semibold text-slate-800 truncate" title={section?.name || "-"}>
                {section?.name || "-"}
              </div>
              <div className="text-[11px] text-slate-400 truncate" title={section?.building || "-"}>
                {section?.building || "-"}
              </div>
            </div>
          );
        },
      },
      {
        id: "dates",
        header: "วันที่รับ / หมดประกัน",
        size: 130,
        cell: (info) => {
          const row = info.row.original;
          const expired = isExpired(row.warrantyDate);
          return (
            <div>
              <div className="text-xs font-medium text-slate-800">
                {formatThaiDate(row.receivedDate)}
              </div>
              {row.warrantyDate ? (
                <div
                  className={`text-[11px] mt-0.5 ${
                    expired ? "text-rose-500 font-medium" : "text-slate-400"
                  }`}
                >
                  {expired
                    ? "หมดประกันแล้ว"
                    : `ว/ด/ป หมด: ${formatThaiDate(row.warrantyDate)}`}
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
        size: 95,
        cell: (info) => {
          const status = info.row.original.status;
          const badge = getStatusBadge(status?.code, status?.name);
          return (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap">
              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
              <span className={badge.textColor}>{badge.text}</span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "การดำเนินการ",
        size: 220,
        cell: (info) => {
          const row = info.row.original;
          const isOpen = openActionDropdown === row.id;

          return (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <button
                type="button"
                title="แก้ไข"
                onClick={() => openEdit(row)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="ดูรายละเอียด"
                onClick={() => openDetail(row)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>

              {/* Action Dropdown for ดำเนินการต่อ with 2 options */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenActionDropdown(isOpen ? null : row.id)
                  }
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <span>ดำเนินการต่อ</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>

                {isOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setOpenActionDropdown(null)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-30 animate-in fade-in zoom-in-95">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionDropdown(null);
                          openWaitDisposal(row);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-orange-50 hover:text-[#ea580c] transition-colors text-left cursor-pointer"
                      >
                        <Clock className="h-3.5 w-3.5 text-orange-500" />
                        <span className="font-semibold">รอจำหน่าย</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionDropdown(null);
                          openMarkLost(row);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors text-left cursor-pointer"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-semibold">ปรับเป็นสูญหาย</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        },
      },
    ];
  }, [
    activeTab,
    openDetail,
    openEdit,
    openActionDropdown,
    openWaitDisposal,
    openConfirmDisposal,
    openMarkLost,
  ]);

  const table = useTable({
    key: "equipment-table",
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
                        ? "pl-2 pr-8"
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
                  ไม่พบข้อมูลครุภัณฑ์
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
                          ? "pl-2 pr-8"
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
                  className={`h-6 w-6 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                    currentPage === p
                      ? activeTab === "WAIT_DISPOSAL"
                        ? "bg-[#ea580c] text-white"
                        : "bg-emerald-600 text-white"
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
