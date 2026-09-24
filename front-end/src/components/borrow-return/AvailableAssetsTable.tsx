import {
  tableFeatures,
  useTable,
  rowPaginationFeature,
  createPaginatedRowModel,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { Asset } from "../../types/TypeAsset";
import { useQuery } from "@tanstack/react-query";
import { getAssets, getSections } from "../../services/assetService";
import { useMemo } from "react";
import { useSelfBorrowModalStore } from "../../stores/useSelfBorrowModalStore";

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

const columns: Array<ColumnDef<typeof features, Asset>> = [
  {
    accessorKey: "imageUrl",
    header: "รูปภาพ",
    cell: (info) => (
      <img
        src={(info.getValue() as string) || "/placeholder.png"}
        alt="Asset"
        className="h-10 w-10 rounded-md object-cover object-center bg-slate-100 border border-slate-200"
      />
    ),
  },
  {
    id: "item_info",
    header: "รายการ / รหัส",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="flex flex-col justify-center min-w-[200px] max-w-[300px] lg:max-w-[400px] whitespace-normal">
          <span className="font-semibold text-slate-800 leading-snug line-clamp-2">
            {row.name || "-"}
          </span>
          <span className="text-xs text-slate-500 font-mono mt-1">
            {row.serialNo || row.model || "ไม่ระบุรหัส"}
          </span>
        </div>
      );
    },
  },
  {
    id: "typeName",
    header: "ประเภท",
    accessorFn: (row) => row.type?.name,
    cell: (info) => (
      <span className="text-sm text-slate-600">
        {(info.getValue() as string) ?? "-"}
      </span>
    ),
  },
  {
    id: "statusName",
    header: "สถานะ",
    cell: () => (
      <span className="inline-flex items-center justify-center min-w-[110px] px-3 py-1 text-xs font-semibold rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200">
        พร้อมให้ยืม
      </span>
    ),
  },
  {
    id: "actions",
    header: "จัดการ",
    cell: (info) => {
      const row = info.row.original;
      return (
        <button
          type="button"
          onClick={() => useSelfBorrowModalStore.getState().openForm(row)}
          className="w-24 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          ขอยืม
        </button>
      );
    },
  },
];

interface Props {
  search: string;
  typeFilter: string;
}

export default function AvailableAssetsTable({ search, typeFilter }: Props) {
  // หา section ของศูนย์ครุภัณฑ์กลาง (CENTER) เพื่อดึงเฉพาะครุภัณฑ์ของศูนย์เท่านั้น
  const { data: sections } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
  });
  const centerSectionId = useMemo(
    () => sections?.find((s) => s.code === "CENTER")?.id,
    [sections],
  );

  const { data: assets } = useQuery({
    queryKey: ["assets", centerSectionId],
    queryFn: () => getAssets(centerSectionId),
    enabled: !!centerSectionId,
  });

  // เห็นเฉพาะครุภัณฑ์ของศูนย์ฯ ที่ "ว่าง" (AVAILABLE) และ "ใช้งานได้" (NORMAL) เท่านั้น
  const filteredAssets = useMemo(() => {
    if (!assets) return [];

    return assets.filter((item) => {
      const isCenterAsset = item.section?.code === "CENTER";
      const isAvailable = item.availabilityStatus?.code === "AVAILABLE";
      const isNormal = item.status?.code === "NORMAL";

      const matchesSearch =
        search === "" ||
        item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.serialNo?.toLowerCase().includes(search.toLowerCase());

      const matchesType = typeFilter === "ALL" || item.type?.name === typeFilter;

      return (
        isCenterAsset && isAvailable && isNormal && matchesSearch && matchesType
      );
    });
  }, [assets, search, typeFilter]);

  const table = useTable({
    key: "available-assets-table",
    features,
    columns,
    data: filteredAssets,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex-1 min-h-0 table-scroll">
        <table className="w-full text-left border-collapse text-sm text-slate-600">
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
            {table.getRowModel().rows.length > 0 ? (
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
                  ไม่พบครุภัณฑ์ที่พร้อมให้ยืมในขณะนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* กล่อง Pagination */}
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
                className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
                  isCurrentPage
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
