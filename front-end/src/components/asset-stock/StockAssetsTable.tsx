import { useMemo } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { Asset } from "../../Types/TypeAsset";

import { useAssetDetailModalStore } from "../../stores/useAssetDetailModalStore";
import { useAuthStore } from "../../stores/authStore";
import { ROLES } from "../../router/roles";
import StockTablePagination from "../equipment-stock/StockTablePagination";

const features = tableFeatures({});

interface StockAssetsTableProps {
  assets?: Asset[];
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isAssetCenter?: boolean;
}

export default function StockAssetsTable({
  assets = [],
  isLoading = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  isAssetCenter: isAssetCenterProp,
}: StockAssetsTableProps) {
  const role = useAuthStore((state) => state.role);
  const isAssetCenter =
    isAssetCenterProp ??
    (role === ROLES.ADMIN || role === ROLES.ASSET_CENTER_STAFF);

  const columns = useMemo<Array<ColumnDef<typeof features, Asset>>>(() => {
    const cols: Array<ColumnDef<typeof features, Asset>> = [
      {
        id: "pid",
        header: "รหัสครุภัณฑ์ (PID)",
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="font-semibold text-slate-800 font-mono">
              {row.noid || row.id}
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
              <div className="font-semibold text-slate-800 leading-snug line-clamp-2 min-w-[200px] max-w-[300px] lg:max-w-[400px] whitespace-normal">
                {row.name}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
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
          <span className="text-sm text-slate-600 font-mono">
            {info.row.original.serialNo || "-"}
          </span>
        ),
      },
    ];

    // แสดงคอลัมน์ "หน่วยงานที่รับผิดชอบ" เฉพาะเจ้าหน้าที่ศูนย์ครุภัณฑ์ / Admin
    if (isAssetCenter) {
      cols.push({
        id: "department_location",
        header: "หน่วยงานที่รับผิดชอบ",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <div className="text-sm font-medium text-slate-800">
                {row.section?.name ?? "-"}
              </div>
              {row.section?.building && (
                <div className="text-xs text-slate-500 mt-0.5">
                  {row.section.building}
                </div>
              )}
            </div>
          );
        },
      });
    }

    cols.push(
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
                return "bg-emerald-100 text-emerald-700 border-emerald-200";
              case "DAMAGED":
              case "LOST":
                return "bg-rose-100 text-rose-700 border-rose-200";
              case "UNDER_REPAIR":
              case "WAIT_DISPOSAL":
                return "bg-amber-100 text-amber-700 border-amber-200";
              case "DISPOSAL":
                return "bg-slate-100 text-slate-600 border-slate-200";
              default:
                return "bg-slate-100 text-slate-600 border-slate-200";
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
              className={`inline-flex items-center justify-center gap-1.5 min-w-[90px] px-3 py-1 text-xs font-semibold rounded-full border ${getStatusStyle(
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
            onClick={() =>
              useAssetDetailModalStore.getState().openModal(info.row.original)
            }
            className="w-24 rounded-lg border border-emerald-600 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 cursor-pointer"
          >
            รายละเอียด
          </button>
        ),
      }
    );

    return cols;
  }, [isAssetCenter]);
  const table = useTable({
    key: "stock-assets-table",
    features,
    columns,
    data: assets,
  });


  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex-1 min-h-0 table-scroll">
        <table className="w-full text-left border-collapse text-sm text-slate-600 min-w-[950px]">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-3.5 px-4">
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
                <td colSpan={columns.length} className="text-center py-12 text-slate-400">
                  กำลังโหลดข้อมูลครุภัณฑ์...
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-slate-400">
                  ไม่พบข้อมูลครุภัณฑ์
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="py-3.5 px-4 whitespace-nowrap align-middle">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>


      <StockTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
