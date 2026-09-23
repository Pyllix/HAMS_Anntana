import {
  tableFeatures,
  useTable,
  rowPaginationFeature,
  createPaginatedRowModel,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  getAllBorrowHistory,
  type BorrowHistory,
} from "../../services/borrowService";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

// ฟังก์ชันสำหรับแปลงรูปแบบวันที่ให้ออกมาเป็นภาษาไทย (เช่น 01 มี.ค. 2026, 13:56)
const formatThaiDate = (dateString: string | null) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const columns: Array<ColumnDef<typeof features, BorrowHistory>> = [
  {
    accessorKey: "id",
    header: "รหัสการยืม",
    cell: (info) => {
      const id = info.getValue() as string;
      // ตัด UUID ให้แสดงผลสั้นลง พร้อมเติม Prefix (หรือปรับตามรูปแบบ ID จริงของระบบ)
      const shortId = id ? `BR-${id.slice(0, 6).toUpperCase()}` : "-";
      return (
        <span className="whitespace-nowrap font-semibold text-gray-900">
          {shortId}
        </span>
      );
    },
  },
  {
    id: "item_info",
    header: "ข้อมูลครุภัณฑ์",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div>
          <div className="font-semibold text-gray-900">
            {row.asset?.model || "-"}
          </div>
          <div className="text-sm text-gray-500">{row.asset?.name || "-"}</div>
        </div>
      );
    },
  },
  {
    id: "borrower_info",
    header: "ชื่อผู้ยืม",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div>
          <div className="font-medium text-gray-900">
            {row.borrower
              ? `${row.borrower.firstname} ${row.borrower.lastname}`
              : "-"}
          </div>
          <div className="text-xs text-gray-500">
            รหัสพนักงาน: {row.borrower?.employeeId || "-"}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "handover_date",
    header: "วันที่ยืม",
    cell: (info) => {
      const dateStr = info.getValue() as string | null;
      return (
        <span className="text-sm text-gray-600">{formatThaiDate(dateStr)}</span>
      );
    },
  },
  {
    accessorKey: "return_date",
    header: "วันที่คืน",
    cell: (info) => {
      const dateStr = info.getValue() as string | null;
      if (!dateStr) {
        return <span className="text-sm text-gray-400">-</span>;
      }
      return (
        <span className="text-sm text-gray-600">{formatThaiDate(dateStr)}</span>
      );
    },
  },
  {
    id: "statusName",
    header: "สถานะ",
    cell: (info) => {
      const status = info.row.original.borrowStatus;
      const code = status?.code;
      const name = status?.name ?? "-";

      // กำหนดสีและสไตล์ตาม Code ของสถานะ
      const getStatusStyle = (statusCode?: string) => {
        switch (statusCode) {
          case "RETURNED":
            return {
              container: "bg-emerald-100 text-emerald-600", // คืนแล้ว (พื้นหลังเขียวอ่อน ตัวหนังสือเขียวเข้ม)
              dot: "bg-emerald-600",
            };
          case "BORROWED":
          case "PENDING":
          default:
            return {
              container: "bg-amber-100 text-amber-600", // ยังไม่คืน (พื้นหลังเหลือง/ส้มอ่อน ตัวหนังสือส้มเข้ม)
              dot: "bg-amber-500",
            };
        }
      };

      const style = getStatusStyle(code);

      return (
        <span
          className={`whitespace-nowrap inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold shadow-xs ${style.container}`}
        >
          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
          {name}
        </span>
      );
    },
  },
];

interface Props {
  inputSearch: string;
  status: "ALL" | "BORROWED" | "RETURNED";
}

export default function AssetsHistoryTable({ inputSearch, status }: Props) {
  const { data: borrowHistory } = useQuery({
    queryKey: ["borrowHistory"],
    queryFn: () => getAllBorrowHistory(),
  });

  const filteredItems = useMemo(() => {
    if (!borrowHistory) {
      console.log("borrowHistory is undefined at AssetsHistoryTable.tsx");
      return [];
    }

    return borrowHistory.filter((item) => {
      const searchKeyword = inputSearch.toLowerCase();

      // ค้นหาจาก ชื่อครุภัณฑ์, รุ่น, ชื่อ-นามสกุลผู้ยืม, รหัสพนักงาน หรือรหัสการยืม
      const matchesSearch =
        inputSearch === "" ||
        item.asset?.name?.toLowerCase().includes(searchKeyword) ||
        item.asset?.model?.toLowerCase().includes(searchKeyword) ||
        item.borrower?.firstname?.toLowerCase().includes(searchKeyword) ||
        item.borrower?.lastname?.toLowerCase().includes(searchKeyword) ||
        item.borrower?.employeeId?.toLowerCase().includes(searchKeyword) ||
        item.id?.toLowerCase().includes(searchKeyword);

      // กรองตามสถานะการยืม (เช่น ALL, BORROWED, RETURNED)
      const matchesStatus =
        status === "ALL" || item.borrowStatus?.code === status;

      return matchesSearch && matchesStatus;
    });
  }, [borrowHistory, inputSearch, status]);

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
