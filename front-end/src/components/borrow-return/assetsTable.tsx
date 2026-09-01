import {
  tableFeatures,
  useTable,
  rowPaginationFeature,
  createPaginatedRowModel,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { Asset } from "../../Types/TypeAsset";
import { useQuery } from "@tanstack/react-query";
import { getAssets } from "../../services/assetService";
import { useMemo } from "react";
import { useBorrowModalStore } from "../../stores/useBorrowModalStore";
import { useReturnModalStore } from "../../stores/useReturnModalStore";

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
        className="h-10 w-10 rounded-md object-cover bg-gray-100 border border-gray-200"
      />
    ),
  },
  {
    id: "item_info",
    header: "รายการ / รหัส",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div>
          <div className="font-semibold text-gray-900">{row.name}</div>
          <div className="text-sm text-gray-400 font-mono mt-0.5">
            {row.serialNo || row.model}
          </div>
        </div>
      );
    },
  },
  {
    id: "typeName",
    header: "ประเภท",
    accessorFn: (row) => row.type?.name,
    cell: (info) => (
      <span className="text-sm text-gray-600">
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
        <div>
          <div className="text-xs text-gray-500">
            {row.section?.name ?? "-"}
          </div>
        </div>
      );
    },
  },
  //   {
  //     accessorKey: "receivedDate",
  //     header: "วันที่ยืม",
  //     cell: (info) => {
  //       const dateStr = info.getValue() as string;

  //       const timePart = dateStr.split("T")[0];
  //       return <span className="text-sm text-gray-600">{timePart || "-"}</span>;
  //     },
  //   },
  {
    id: "statusName",
    header: "สถานะ",
    cell: (info) => {
      const status = info.row.original.availabilityStatus;
      const code = status?.code;
      const name = status?.name ?? "-";

      // เลือก Class สีตาม Code
      const getStatusStyle = (statusCode?: string) => {
        switch (statusCode) {
          case "AVAILABLE":
            return "bg-emerald-100 text-emerald-700";
          case "BORROWED":
            return "bg-red-100 text-red-700";
          case "UNAVAILABLE":
          default:
            return "bg-gray-100 text-gray-700";
        }
      };

      return (
        <span
          className={`inline-flex items-center justify-center w-36 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-medium ${getStatusStyle(
            code,
          )}`}
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

      const handleOpenBorrowModal = () => {
        useBorrowModalStore.getState().openForm(row);
      };

      const handleOpenReturnModal = () => {
        useReturnModalStore.getState().openForm(row);
      };

      if (isAvailable === "AVAILABLE") {
        return (
          <button
            type="button"
            onClick={handleOpenBorrowModal}
            className="w-full max-w-20 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            ยืมของ
          </button>
        );
      }

      if (isAvailable === "BORROWED") {
        return (
          <button
            type="button"
            onClick={handleOpenReturnModal}
            className="w-full max-w-20 rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50"
          >
            รับคืน
          </button>
        );
      }

      if (isAvailable === "UNAVAILABLE") {
        return (
          <button
            disabled
            type="button"
            className="w-full whitespace-nowrap cursor-not-allowed rounded-lg border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-400"
          >
            ไม่พร้อม
          </button>
        );
      }
    },
  },
];

interface Props {
  search: string;
  category: string;
  type: string;
}

export default function AssetsTable({ search, category, type }: Props) {
  const { data: assets } = useQuery({
    queryKey: ["assets"],
    queryFn: getAssets,
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
    <div className="flex flex-col justify-between mb-6">
      <div className="space-y-4">
        {/* table */}
        <table className="bg-bg-component shadow-sm w-full rounded-sm text-left">
          <thead className="font-bold text-md">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-200">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-3 px-4">
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* ใช้ rowModel ตัวที่ผ่านการแบ่งหน้าแล้ว */}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="py-3 px-4">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* ส่วนล่าง: ปุ่ม Pagination ที่จะถูกดันมาอยู่ขวาล่างสุดอัตโนมัติ */}
        <div className="flex items-center justify-end space-x-2 pt--6 mt-auto ">
          {/* ปุ่ม Previous */}
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              className="h-5 w-5"
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
            const isCurrentPage = table.state.pagination.pageIndex === index;

            return (
              <button
                key={pageNumber}
                type="button"
                onClick={() => table.setPageIndex(index)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                  isCurrentPage
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
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
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
