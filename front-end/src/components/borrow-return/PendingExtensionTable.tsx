import { useServerPage } from "../../hooks/useServerPage";
import { getPage } from "../../services/pagedApi";
import QueryStatus from "../shared/QueryStatus";
import {
  tableFeatures,
  useTable,
  rowPaginationFeature,
  createPaginatedRowModel,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import {
  reviewBorrowExtension,
  getBorrowErrorMessage,
  type BorrowExtension,
} from "../../services/borrowService";
import { useRejectExtensionModalStore } from "../../stores/useRejectExtensionModalStore";
import { useToastStore } from "../../stores/useToastStore";
import { formatThaiDisplayDate as formatThaiDate } from "../../services/thaiDate";

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

function ExtensionActions({ extension }: { extension: BorrowExtension }) {
  const queryClient = useQueryClient();
  const { openForm: openRejectForm } = useRejectExtensionModalStore();
  const showToast = useToastStore((s) => s.showToast);

  const { mutate: handleApprove, isPending: isApproving } = useMutation({
    mutationFn: () =>
      reviewBorrowExtension(extension.id, { status: "APPROVED" }),
    onSuccess: () => {
      showToast("success", "อนุมัติคำขอต่อเวลาเรียบร้อยแล้ว");
      queryClient.invalidateQueries({ queryKey: ["borrowHistory"] });
      queryClient.invalidateQueries({ queryKey: ["borrowExtensions"] });
    },
    onError: (err: any) => {
      showToast("error", getBorrowErrorMessage(err));
    },
  });

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => handleApprove()}
        disabled={isApproving}
        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
      >
        {isApproving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
        อนุมัติ
      </button>
      <button
        type="button"
        onClick={() => openRejectForm(extension)}
        disabled={isApproving}
        className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 shadow-sm transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
        ปฏิเสธ
      </button>
    </div>
  );
}

const columns: Array<ColumnDef<typeof features, BorrowExtension>> = [
  {
    id: "borrowNo",
    header: "เลขที่คำขอยืม",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="flex flex-col">
          <span className="whitespace-nowrap font-semibold text-gray-900">
            {row.borrowTransaction?.borrowNo || "-"}
          </span>
          <span className="text-xs text-gray-500">
            ต่อเวลาครั้งที่ {row.roundNumber}
          </span>
        </div>
      );
    },
  },
  {
    id: "item_info",
    header: "ข้อมูลครุภัณฑ์",
    cell: (info) => {
      const asset = info.row.original.borrowTransaction?.asset;
      return (
        <div>
          <div className="font-semibold text-gray-900">{asset?.name || "-"}</div>
          <div className="text-sm text-gray-500">
            {asset?.noid || asset?.model || "-"}
          </div>
        </div>
      );
    },
  },
  {
    id: "requester_info",
    header: "ผู้ขอต่อเวลา",
    cell: (info) => {
      const user = info.row.original.requestedByUser;
      return (
        <div>
          <div className="font-medium text-gray-900">
            {user ? `${user.firstname} ${user.lastname}` : "-"}
          </div>
          <div className="text-xs text-gray-500">
            รหัสพนักงาน: {user?.employeeId || "-"}
          </div>
        </div>
      );
    },
  },
  {
    id: "dates",
    header: "กำหนดคืนเดิม → ใหม่",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="flex flex-col text-sm">
          <span className="text-gray-500 line-through">
            {formatThaiDate(row.currentReturnDate)}
          </span>
          <span className="font-semibold text-sky-700">
            {formatThaiDate(row.requestedReturnDate)}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "reason",
    header: "เหตุผล",
    cell: (info) => {
      const reason = (info.getValue() as string) || "-";
      return (
        <span
          className="block max-w-[240px] truncate text-sm text-gray-600"
          title={reason}
        >
          {reason}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "การดำเนินการ",
    cell: (info) => <ExtensionActions extension={info.row.original} />,
  },
];

export default function PendingExtensionTable() {
  const listQuery = useServerPage<BorrowExtension>("borrowExtensions", { status: "PENDING" },
    (filters, signal) => getPage("/borrowings/extensions/requests", filters, signal), true);
  const table = useTable({
    key: "pending-extension-table",
    features,
    columns,
    data: listQuery.rows,
    ...listQuery.tableOptions,
  });

  return (
    <div className="flex flex-col bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <QueryStatus query={listQuery} />
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-sky-50/60">
        <span className="flex h-2 w-2 rounded-full bg-sky-500" />
        <h2 className="text-sm font-semibold text-slate-800">
          คำขอต่อเวลารออนุมัติ
        </h2>
        <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-sky-500 text-white text-xs font-semibold">
          {listQuery.data ? listQuery.total : "—"}
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
                  ไม่มีคำขอต่อเวลารออนุมัติในขณะนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200 text-xs text-slate-500">
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
