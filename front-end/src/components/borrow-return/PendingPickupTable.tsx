import {
  tableFeatures,
  useTable,
  rowPaginationFeature,
  createPaginatedRowModel,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { PackageOpen, Loader2 } from "lucide-react";
import {
  claimPickup,
  getAllBorrowHistory,
  getBorrowErrorMessage,
  type BorrowHistory,
} from "../../services/borrowService";
import { useToastStore } from "../../stores/useToastStore";

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

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

function ClaimPickupAction({ transaction }: { transaction: BorrowHistory }) {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);

  const { mutate: handleClaim, isPending: isSubmitting } = useMutation({
    mutationFn: () => claimPickup(transaction.id),
    onSuccess: () => {
      showToast("success", "รับงานไปเก็บครุภัณฑ์เรียบร้อยแล้ว");
      queryClient.invalidateQueries({ queryKey: ["borrowHistory"] });
    },
    onError: (err: any) => {
      showToast("error", getBorrowErrorMessage(err));
    },
  });

  return (
    <button
      type="button"
      onClick={() => handleClaim()}
      disabled={isSubmitting}
      className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
    >
      {isSubmitting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <PackageOpen className="h-3.5 w-3.5" />
      )}
      รับงาน
    </button>
  );
}

const columns: Array<ColumnDef<typeof features, BorrowHistory>> = [
  {
    accessorKey: "borrowNo",
    header: "เลขที่คำขอ",
    cell: (info) => (
      <span className="whitespace-nowrap font-semibold text-gray-900">
        {(info.getValue() as string) || "-"}
      </span>
    ),
  },
  {
    id: "item_info",
    header: "ข้อมูลครุภัณฑ์",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div>
          <div className="font-semibold text-gray-900">
            {row.asset?.name || "-"}
          </div>
          <div className="text-sm text-gray-500">{row.asset?.model || "-"}</div>
        </div>
      );
    },
  },
  {
    id: "borrower_info",
    header: "ผู้แจ้งคืน",
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
    id: "return_remark",
    header: "จุดรับ / หมายเหตุ",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="text-sm text-gray-600 whitespace-normal">
          {row.return_remark || "-"}
        </span>
      );
    },
  },
  {
    accessorKey: "return_date",
    header: "วันที่แจ้งคืน",
    cell: (info) => {
      const dateStr = info.getValue() as string | null;
      return (
        <span className="text-sm text-gray-600">{formatThaiDate(dateStr)}</span>
      );
    },
  },
  {
    id: "actions",
    header: "การดำเนินการ",
    cell: (info) => <ClaimPickupAction transaction={info.row.original} />,
  },
];

export default function PendingPickupTable() {
  const { data: borrowHistory } = useQuery({
    queryKey: ["borrowHistory", "pendingPickup"],
    queryFn: () => getAllBorrowHistory({ limit: 100 }),
  });

  const pendingItems = useMemo(() => {
    if (!borrowHistory) return [];
    return borrowHistory.filter(
      (item) => item.borrowStatus?.code === "PENDING_RETURN",
    );
  }, [borrowHistory]);

  const table = useTable({
    key: "pending-pickup-table",
    features,
    columns,
    data: pendingItems,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 5,
      },
    },
  });

  return (
    <div className="flex flex-col bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-amber-50/60">
        <span className="flex h-2 w-2 rounded-full bg-amber-500" />
        <h2 className="text-sm font-semibold text-slate-800">
          รายการรอรับงาน (แจ้งคืนแบบ online)
        </h2>
        <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold">
          {pendingItems.length}
        </span>
      </div>

      <div className="table-scroll">
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
                  className="text-center py-8 text-slate-400 text-sm"
                >
                  ไม่มีรายการรอรับงานในขณะนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
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
      )}
    </div>
  );
}
