import {
  tableFeatures,
  useTable,
  rowPaginationFeature,
  createPaginatedRowModel,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import {
  getAllBorrowHistory,
  type BorrowHistory,
} from "../../services/borrowService";
import { useAuthStore } from "../../stores/authStore";
import { useRequestReturnModalStore } from "../../stores/useRequestReturnModalStore";

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

// สถานะที่ถือว่ารายการยืมยังค้างอยู่กับแผนก (ยังไม่จบ)
const ACTIVE_CODES = [
  "PENDING_APPROVE",
  "APPROVED",
  "BORROWED",
  "PENDING_RETURN",
  "IN_PICKUP",
];

const STATUS_STYLES: Record<string, string> = {
  PENDING_APPROVE: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-sky-100 text-sky-700 border-sky-200",
  BORROWED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PENDING_RETURN: "bg-violet-100 text-violet-700 border-violet-200",
  IN_PICKUP: "bg-indigo-100 text-indigo-700 border-indigo-200",
  RETURNED: "bg-slate-100 text-slate-600 border-slate-200",
  REJECTED: "bg-rose-100 text-rose-700 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

const formatThaiDate = (dateString: string | null) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const columns: Array<ColumnDef<typeof features, BorrowHistory>> = [
  {
    accessorKey: "borrowNo",
    header: "เลขที่คำขอ",
    cell: (info) => (
      <span className="font-semibold text-slate-800">
        {(info.getValue() as string) || "-"}
      </span>
    ),
  },
  {
    id: "item_info",
    header: "ครุภัณฑ์",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800">
            {row.asset?.name || "-"}
          </span>
          <span className="text-xs text-slate-500 font-mono mt-0.5">
            {row.asset?.noid || row.asset?.model || "-"}
          </span>
        </div>
      );
    },
  },
  {
    id: "borrower_info",
    header: "ผู้ยืม",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="flex flex-col">
          <span className="font-medium text-slate-800">
            {row.borrower
              ? `${row.borrower.firstname} ${row.borrower.lastname}`
              : "-"}
          </span>
          <span className="text-xs text-slate-500">
            รหัสพนักงาน: {row.borrower?.employeeId || "-"}
          </span>
        </div>
      );
    },
  },
  {
    id: "borrow_date",
    header: "วันที่ยืม",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="text-sm text-slate-600">
          {formatThaiDate(row.handover_date ?? row.createdAt)}
        </span>
      );
    },
  },
  {
    id: "due_date",
    header: "กำหนดคืน",
    cell: (info) => {
      const row = info.row.original;
      const isActive = ACTIVE_CODES.includes(row.borrowStatus?.code);
      return (
        <div className="flex flex-col">
          <span className="text-sm text-slate-600">
            {formatThaiDate(row.expectedReturnDate)}
          </span>
          {isActive && row.isOverdue && (
            <span className="text-xs font-semibold text-rose-600">
              เกินกำหนด {row.overdueDays ?? 0} วัน
            </span>
          )}
          {isActive && !row.isOverdue && row.remainingDays != null && (
            <span className="text-xs text-slate-400">
              เหลือ {row.remainingDays} วัน
            </span>
          )}
        </div>
      );
    },
  },
  {
    id: "status",
    header: "สถานะ",
    cell: (info) => {
      const status = info.row.original.borrowStatus;
      return (
        <span
          className={`inline-flex items-center justify-center min-w-[110px] px-3 py-1 text-xs font-semibold rounded-full border ${
            STATUS_STYLES[status?.code] ?? STATUS_STYLES.CANCELLED
          }`}
        >
          {status?.name || "-"}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "จัดการ",
    cell: (info) => {
      const row = info.row.original;
      const code = row.borrowStatus?.code;

      if (code === "BORROWED") {
        return (
          <button
            type="button"
            onClick={() => useRequestReturnModalStore.getState().openForm(row)}
            className={`w-28 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors ${
              row.isOverdue
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            แจ้งคืน
          </button>
        );
      }

      if (code === "PENDING_RETURN" || code === "IN_PICKUP") {
        return (
          <span className="inline-flex w-28 justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400">
            รอเจ้าหน้าที่รับคืน
          </span>
        );
      }

      if (code === "PENDING_APPROVE" || code === "APPROVED") {
        return (
          <span className="inline-flex w-28 justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-500">
            รอดำเนินการ
          </span>
        );
      }

      return null;
    },
  },
];

export default function DepartmentBorrowingsTable() {
  const user = useAuthStore((s) => s.user);
  const [showAll, setShowAll] = useState(false);

  // DEPARTMENT_STAFF: API กรองให้เห็นเฉพาะรายการของแผนกตัวเองอยู่แล้ว
  // PARCEL_STAFF: API ไม่ได้กรองให้ จึงต้องส่ง sectionId ของผู้ใช้ไปเอง
  const sectionId = user?.section_id;

  const { data: borrowings, isLoading } = useQuery({
    queryKey: ["borrowHistory", "department", sectionId],
    queryFn: () => getAllBorrowHistory({ limit: 100, sectionId }),
    enabled: !!sectionId,
  });

  const activeBorrowings = useMemo(
    () =>
      (borrowings ?? []).filter((b) =>
        ACTIVE_CODES.includes(b.borrowStatus?.code),
      ),
    [borrowings],
  );

  const summary = useMemo(
    () => ({
      borrowed: activeBorrowings.filter(
        (b) => b.borrowStatus?.code === "BORROWED",
      ).length,
      pending: activeBorrowings.filter((b) =>
        ["PENDING_APPROVE", "APPROVED"].includes(b.borrowStatus?.code),
      ).length,
      returning: activeBorrowings.filter((b) =>
        ["PENDING_RETURN", "IN_PICKUP"].includes(b.borrowStatus?.code),
      ).length,
      overdue: activeBorrowings.filter((b) => b.isOverdue).length,
    }),
    [activeBorrowings],
  );

  const tableData = showAll ? (borrowings ?? []) : activeBorrowings;

  const table = useTable({
    key: "department-borrowings-table",
    features,
    columns,
    data: tableData,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 5,
      },
    },
  });

  const summaryItems = [
    { label: "กำลังยืม", value: summary.borrowed, color: "text-emerald-600" },
    { label: "รออนุมัติ / รอส่งมอบ", value: summary.pending, color: "text-amber-600" },
    { label: "รอคืน", value: summary.returning, color: "text-violet-600" },
    { label: "เกินกำหนดคืน", value: summary.overdue, color: "text-rose-600" },
  ];

  return (
    <div className="flex flex-col bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* หัวข้อ + ตัวกรอง */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-emerald-600" />
          <h2 className="font-semibold text-slate-800">
            ครุภัณฑ์ที่แผนกยืมอยู่
          </h2>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setShowAll(false);
              table.setPageIndex(0);
            }}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              !showAll ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            กำลังดำเนินการ
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAll(true);
              table.setPageIndex(0);
            }}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              showAll ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            ทั้งหมด
          </button>
        </div>
      </div>

      {/* สรุปจำนวน */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-100 border-b border-slate-200">
        {summaryItems.map((item) => (
          <div key={item.label} className="bg-white px-4 py-3">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className={`text-xl font-bold ${item.color}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* ตาราง */}
      <div className="table-scroll">
        <table className="w-full text-left border-collapse text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
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
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-slate-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="py-3 px-4 whitespace-nowrap align-middle">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="text-center py-10 text-slate-400">
                  {showAll
                    ? "แผนกของคุณยังไม่มีประวัติการยืมครุภัณฑ์"
                    : "ขณะนี้แผนกของคุณไม่มีครุภัณฑ์ที่ยืมอยู่"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 text-xs text-slate-500">
          <span>
            หน้า{" "}
            <span className="font-semibold text-slate-700">
              {table.state.pagination.pageIndex + 1}
            </span>{" "}
            จาก{" "}
            <span className="font-semibold text-slate-700">
              {table.getPageCount()}
            </span>
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
