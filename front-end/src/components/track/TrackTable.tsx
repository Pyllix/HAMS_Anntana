import {
  tableFeatures,
  useTable,
  rowPaginationFeature,
  createPaginatedRowModel,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getRepairsHistory } from "../../services/trackingService";
import type { TrackRes } from "../../services/trackingService";

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

const columns: Array<ColumnDef<typeof features, TrackRes>> = [
  {
    accessorKey: "jobNo",
    header: "รหัสแจ้งซ่อม",
    cell: (info) => (
      <span className="font-bold text-gray-900">
        {(info.getValue() as string) || "-"}
      </span>
    ),
  },
  {
    id: "asset_info",
    header: "ข้อมูลครุภัณฑ์",
    cell: (info) => {
      const asset = info.row.original.asset;
      return (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">
            {asset?.noid ?? "-"}
          </span>
          <span className="text-xs text-gray-500 mt-0.5">
            {asset?.name ?? "-"}
          </span>
        </div>
      );
    },
  },
  {
    id: "symptom",
    header: "อาการขัดข้อง",
    cell: (info) => {
      const row = info.row.original;

      const getUrgencyText = (status?: string) => {
        switch (status?.toUpperCase()) {
          case "VERY_URGENT":
            return <span className="text-rose-500">ความเร่งด่วน: ด่วนมาก</span>;
          case "URGENT":
            return <span className="text-amber-500">ความเร่งด่วน: ด่วน</span>;
          case "NORMAL":
          default:
            return <span className="text-emerald-500">ความเร่งด่วน: ปกติ</span>;
        }
      };

      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-gray-800">
            {row.symptom || row.diagnosis || "-"}
          </span>
          <span className="text-xs font-medium">
            {getUrgencyText(row.urgencyStatus)}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "วันที่แจ้ง",
    cell: (info) => {
      const dateVal = info.getValue() as string;
      if (!dateVal) return <span className="text-sm text-gray-500">-</span>;

      const date = new Date(dateVal);
      const formattedDate = date.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const formattedTime = date.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      });

      return (
        <span className="text-sm text-gray-600">
          {`${formattedDate}, ${formattedTime}`}
        </span>
      );
    },
  },
  {
    id: "jobStatus",
    header: "สถานะ",
    cell: (info) => {
      const status = info.row.original.jobStatus;
      const code = status?.code?.toUpperCase();
      const name = status?.name ?? "-";

      const getStatusStyle = (statusCode?: string) => {
        switch (statusCode) {
          case "PARCEL_PROCESSING":
          case "PENDING":
            return {
              bg: "bg-amber-100/80 text-amber-700",
              dot: "bg-amber-500",
            };
          case "IN_PROGRESS":
            return {
              bg: "bg-blue-100/80 text-blue-700",
              dot: "bg-blue-600",
            };
          case "WAITING_PARTS":
            return {
              bg: "bg-rose-100/80 text-rose-700",
              dot: "bg-rose-500",
            };
          case "COMPLETED":
          case "SUCCESS":
            return {
              bg: "bg-emerald-100/80 text-emerald-700",
              dot: "bg-emerald-500",
            };
          default:
            return {
              bg: "bg-gray-100 text-gray-700",
              dot: "bg-gray-400",
            };
        }
      };

      const style = getStatusStyle(code);

      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style.bg}`}
        >
          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
          {name}
        </span>
      );
    },
  },
  // {
  //   id: "actions",
  //   header: "จัดการ",
  //   cell: (info) => {
  //     const row = info.row.original;

  //     const handleViewDetail = () => {
  //       // จัดการเปิด Drawer/Modal หรือนำทางไปหน้ารายละเอียด
  //       console.log("Selected Repair:", row);
  //     };

  //     return (
  //       <button
  //         type="button"
  //         onClick={handleViewDetail}
  //         className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-gray-900"
  //       >
  //         ดูข้อมูล
  //       </button>
  //     );
  //   },
  // },
];

interface Props {
  inputSearch: string;
  status: string;
}

export default function TrackTable({ inputSearch, status }: Props) {
  const { data: repairsHistory } = useQuery({
    queryKey: ["repairsHistory"],
    queryFn: () => getRepairsHistory(),
  });

  console.log("repairsHistory:", repairsHistory);

  const filteredItems = useMemo(() => {
    if (!repairsHistory) {
      console.log("repairsHistory is undefined at TrackTable.tsx");
      return [];
    }

    const searchLower = inputSearch?.trim().toLowerCase() || "";

    return repairsHistory.filter((item) => {
      // 1. ค้นหาจาก รหัสแจ้งซ่อม, รหัสครุภัณฑ์ (noid), ชื่อครุภัณฑ์, Serial No และอาการ
      const matchesSearch =
        searchLower === "" ||
        item.jobNo?.toLowerCase().includes(searchLower) ||
        item.asset?.noid?.toLowerCase().includes(searchLower) ||
        item.asset?.name?.toLowerCase().includes(searchLower) ||
        item.asset?.serialNo?.toLowerCase().includes(searchLower) ||
        item.symptom?.toLowerCase().includes(searchLower) ||
        item.diagnosis?.toLowerCase().includes(searchLower);

      // 2. กรองตามสถานะงานซ่อม (status จาก dropdown jobStatuses)
      const matchesStatus =
        !status ||
        status === "ALL" ||
        item.jobStatus?.name === status ||
        item.jobStatus?.code === status;

      return matchesSearch && matchesStatus;
    });
  }, [repairsHistory, inputSearch, status]); // เพิ่ม inputSearch และ category ใน dependency array เพื่อให้อัปเดตอัตโนมัติเมื่อพิมพ์ค้นหา

  const table = useTable({
    key: "assets-table",
    features,
    columns,
    data: filteredItems ?? [],
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

      {/* กล่อง Pagination */}
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
          {/* ปุ่ม Previous */}
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
