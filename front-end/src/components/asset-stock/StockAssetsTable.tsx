import { useMemo, useState, useEffect } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAssets } from "../../services/assetService";
import type { Asset } from "../../types/TypeAsset";

import { useAssetDetailModalStore } from "../../stores/useAssetDetailModalStore";

const features = tableFeatures({});

const columns: Array<ColumnDef<typeof features, Asset>> = [
  {
    id: "pid",
    header: "รหัสครุภัณฑ์ (PID)",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="font-semibold text-gray-900 text-sm font-mono">
          {row.id}
        </span>
      );
    },
  },
  {
    id: "name_model",
    header: "ชื่อครุภัณฑ์ / ยี่ห้อ-รุ่น",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div>
          <div className="font-semibold text-gray-900">{row.name}</div>
          <div className="text-sm text-gray-400 font-mono mt-0.5">
            {row.model || row.company?.name || "-"}
          </div>
        </div>
      );
    },
  },
  {
    id: "serialNo",
    header: "หมายเลขเครื่อง (S/N)",
    cell: (info) => (
      <span className="text-sm text-gray-600 font-mono">
        {info.row.original.serialNo || "-"}
      </span>
    ),
  },
  {
    id: "department_location",
    header: "หน่วยงานที่รับผิดชอบ",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {row.section?.name ?? "-"}
          </div>
          {row.section?.building && (
            <div className="text-xs text-gray-500 mt-0.5">
              {row.section.building}
            </div>
          )}
        </div>
      );
    },
  },
  {
    id: "status",
    header: "สถานะ",
    cell: (info) => {
      const status = info.row.original.status;
      const code = status?.code;
      const name = status?.name ?? "-";

      const getStatusStyle = (statusCode?: string) => {
        switch (statusCode) {
          case "NORMAL":
            return "border-emerald-500 text-emerald-700 bg-emerald-50/70";
          case "DAMAGED":
          case "LOST":
            return "border-rose-400 text-rose-700 bg-rose-50/70";
          case "UNDER_REPAIR":
          case "WAIT_DISPOSAL":
            return "border-amber-400 text-amber-700 bg-amber-50/70";
          case "DISPOSAL":
            return "border-slate-400 text-slate-700 bg-slate-50/70";
          default:
            return "border-gray-300 text-gray-700 bg-gray-50";
        }
      };

      const getDotColor = (statusCode?: string) => {
        switch (statusCode) {
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
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium border ${getStatusStyle(
            code
          )}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${getDotColor(code)}`} />
          {name}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "จัดการ",
    cell: (info) => (
      <button
        type="button"
        onClick={() => useAssetDetailModalStore.getState().openModal(info.row.original)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 transition-colors shadow-xs cursor-pointer"
      >
        รายละเอียด
      </button>
    ),
  },
];

interface StockAssetsTableProps {
  search?: string;
  type?: string;
  department?: string;
  status?: string;
}

export default function StockAssetsTable({
  search = "",
  type = "ALL",
  department = "ALL",
  status = "ALL",
}: StockAssetsTableProps) {
  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: getAssets,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset ไปหน้า 1 เสมอเมื่อมีการค้นหาหรือเปลี่ยนตัวกรอง
  useEffect(() => {
    setCurrentPage(1);
  }, [search, type, department, status]);

  const filteredAssets = useMemo(() => {
    if (!assets) return [];

    return assets.filter((item) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        search === "" ||
        item.name?.toLowerCase().includes(searchLower) ||
        item.serialNo?.toLowerCase().includes(searchLower) ||
        item.model?.toLowerCase().includes(searchLower) ||
        item.gmdn?.toLowerCase().includes(searchLower) ||
        item.id?.toLowerCase().includes(searchLower);

      const matchesType = type === "ALL" || item.type?.name === type;

      const matchesDepartment =
        department === "ALL" || item.section?.name === department;

      const matchesStatus = status === "ALL" || item.status?.name === status;

      return matchesSearch && matchesType && matchesDepartment && matchesStatus;
    });
  }, [assets, search, type, department, status]);

  const totalItems = filteredAssets.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, currentPage, pageSize]);

  const table = useTable({
    key: "stock-assets-table",
    features,
    columns,
    data: paginatedData,
  });

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="font-bold text-md border-b border-slate-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-3 px-4 font-bold text-slate-800">
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
                <td colSpan={columns.length} className="py-8 text-center text-slate-400 text-sm">
                  กำลังโหลดข้อมูลครุภัณฑ์...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-slate-400 text-sm">
                  ไม่พบข้อมูลครุภัณฑ์
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="py-3 px-4 align-middle">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Summary footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 text-sm text-slate-500">
        <div>
          แสดง {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} ถึง{" "}
          {Math.min(currentPage * pageSize, totalItems)} จาก {totalItems.toLocaleString()}{" "}
          รายการ
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, currentPage - 3), currentPage + 2)
            .map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer ${currentPage === page
                    ? "bg-emerald-600 font-semibold text-white shadow-sm"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
              >
                {page}
              </button>
            ))}
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
