import {
  tableFeatures,
  useTable,
  rowPaginationFeature,
  createPaginatedRowModel,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { Asset } from "../../types/TypeAsset";
import { useQuery } from "@tanstack/react-query";
import { getAssets } from "../../services/assetService";
import { useMemo } from "react";
import { useBorrowModalStore } from "../../stores/useBorrowModalStore";
import { useReturnModalStore } from "../../stores/useReturnModalStore";
import { useAuthStore } from "../../stores/authStore";

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
        // เพิ่ม object-center เผื่อรูปมาสัดส่วนแปลกๆ
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
        // 🌟 เพิ่ม max-w-[300px] หรือขนาดตามต้องการ และใส่ whitespace-normal
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
    id: "borrower_section",
    header: "สถานที่เก็บ",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="text-sm text-slate-600">
          {row.section?.name ?? "-"}
        </span>
      );
    },
  },
  {
    id: "statusName",
    header: "สถานะ",
    cell: (info) => {
      const status = info.row.original.availabilityStatus;
      const code = status?.code;
      const name =
        code === "RESERVED"
          ? (status?.name ?? "รออนุมัติ")
          : (status?.name ?? "-");

      const getStatusStyle = (statusCode?: string) => {
        switch (statusCode) {
          case "AVAILABLE":
            return "bg-emerald-100 text-emerald-700 border-emerald-200";
          case "RESERVED":
            return "bg-cyan-100 text-cyan-700 border-cyan-200";
          case "BORROWED":
            return "bg-rose-100 text-rose-700 border-rose-200";
          default:
            return "bg-slate-100 text-slate-600 border-slate-200";
        }
      };

      return (
        <span
          className={`inline-flex items-center justify-center min-w-[90px] px-3 py-1 text-xs font-semibold rounded-full border ${getStatusStyle(code)}`}
        >
          {name}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "จัดการ",
    cell: (info) => {
      const row = info.row.original;
      const isAvailable = info.row.original.availabilityStatus?.code;

      const handleOpenBorrowModal = () =>
        useBorrowModalStore.getState().openForm(row);
      const handleOpenReturnModal = () =>
        useReturnModalStore.getState().openForm(row);

      if (isAvailable === "AVAILABLE") {
        return (
          <button
            type="button"
            onClick={handleOpenBorrowModal}
            className="w-24 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            ยืมของ
          </button>
        );
      }

      if (isAvailable === "RESERVED") {
        return (
          <button
            disabled
            type="button"
            title='ดำเนินการได้ที่แท็บ "อนุมัติคำขอยืม"'
            className="w-24 cursor-not-allowed rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-500"
          >
            รอดำเนินการ
          </button>
        );
      }

      if (isAvailable === "BORROWED") {
        return (
          <button
            type="button"
            onClick={handleOpenReturnModal}
            className="w-24 rounded-lg border border-emerald-600 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
          >
            รับคืน
          </button>
        );
      }

      return (
        <button
          disabled
          type="button"
          className="w-24 cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-400"
        >
          ไม่พร้อม
        </button>
      );
    },
  },
];

interface Props {
  search: string;
  category: string;
  type: string;
}

export default function AssetsTable({ search, category, type }: Props) {
  const user = useAuthStore((state) => state.user);
  const sectionId = user?.section_id;

  const { data: assets } = useQuery({
    queryKey: ["assets", sectionId],
    queryFn: () => getAssets(sectionId),
  });

  const filteredAssets = useMemo(() => {
    if (!assets) {
      console.log("assets is undefined at AssetsTable.tsx");
      return [];
    }

    return assets.filter((item) => {
      const matchesSearch =
        search === "" ||
        item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.serialNo?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        category === "ALL" || item.availabilityStatus?.name === category;

      const matchesType = type === "ALL" || item.type?.name === type;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [assets, search, category, type]);

  const table = useTable({
    key: "assets-table",
    features,
    columns,
    data: filteredAssets ?? [],
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* พื้นที่ตาราง Scroll ได้ */}
      <div className="flex-1 min-h-0 table-scroll">
        <table className="w-full text-left border-collapse text-sm text-slate-600">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-3.5 px-4 ">
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
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* กล่อง Pagination (ที่คุณลืมใส่กรอบครอบไว้) */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
        {/* ข้อความบอกจำนวนหน้า */}
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

        {/* กลุ่มปุ่มเปลี่ยนหน้า */}
        <div className="flex items-center space-x-1.5 ml-auto sm:ml-0">
          {/* ปุ่ม Previous (ที่หายไป) */}
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

          {/* ปุ่มตัวเลขหน้า */}
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

          {/* ปุ่ม Next */}
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
