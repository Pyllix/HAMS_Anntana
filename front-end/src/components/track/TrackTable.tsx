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
