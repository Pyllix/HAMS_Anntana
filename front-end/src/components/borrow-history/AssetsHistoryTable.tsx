import {
  tableFeatures,
  useTable,
  rowPaginationFeature,
  createPaginatedRowModel,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { BorrowHistory } from "../../services/borrowService";
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
          case "RETURNED_OPERATIONAL":
            return {
              container: "bg-emerald-100 text-emerald-600", // คืนแล้ว (พื้นหลังเขียวอ่อน ตัวหนังสือเขียวเข้ม)
              dot: "bg-emerald-600",
            };
          case "RETURNED_DAMAGED":
            return {
              container: "bg-orange-100 text-orange-600", // คืนแล้ว (ชำรุด)
              dot: "bg-orange-500",
            };
          case "BORROWED":
          case "PENDING_VERIFICATION":
            return {
              container: "bg-blue-100 text-blue-600", // กำลังยืม / รอตรวจสอบสภาพ
              dot: "bg-blue-500",
            };
          case "REJECTED":
          case "CANCELLED":
            return {
              container: "bg-rose-100 text-rose-600", // ปฏิเสธ / ยกเลิก
              dot: "bg-rose-500",
            };
          case "PENDING_APPROVAL":
          case "APPROVED":
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
  items?: BorrowHistory[];
  inputSearch: string;
  statusCodes: string[] | null; // null = ไม่กรองสถานะ
}

export default function AssetsHistoryTable({
  items,
  inputSearch,
  statusCodes,
}: Props) {
  const filteredItems = useMemo(() => {
    if (!items) return [];

    return items.filter((item) => {
      const searchKeyword = inputSearch
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();

      // รวมชื่อ-นามสกุลเป็นชื่อเต็ม (ตรงกับที่แสดงในตาราง) เพื่อให้ค้นหาด้วยชื่อเต็มได้
      const fullName = [item.borrower?.firstname, item.borrower?.lastname]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .toLowerCase();

      // ค้นหาจาก ชื่อครุภัณฑ์, รุ่น, ชื่อ-นามสกุลผู้ยืม, รหัสพนักงาน หรือรหัสการยืม
      const matchesSearch =
        searchKeyword === "" ||
        item.asset?.name?.toLowerCase().includes(searchKeyword) ||
        item.asset?.model?.toLowerCase().includes(searchKeyword) ||
        fullName.includes(searchKeyword) ||
        item.borrower?.employeeId?.toLowerCase().includes(searchKeyword) ||
        item.id?.toLowerCase().includes(searchKeyword);

      // กรองตามกลุ่มสถานะการยืมที่เลือกจากการ์ด / dropdown
      const matchesStatus =
        !statusCodes || statusCodes.includes(item.borrowStatus?.code ?? "");

      return matchesSearch && matchesStatus;
    });
  }, [items, inputSearch, statusCodes]);

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
