import { formatThaiDisplayDate } from "../../services/thaiDate";
import { useServerPage, useDebouncedSearch } from "../../hooks/useServerPage";
import { getPage } from "../../services/pagedApi";
import QueryStatus from "../shared/QueryStatus";
import { useMemo } from "react";
import {
  tableFeatures,
  useTable,
  rowPaginationFeature,
  createPaginatedRowModel,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  UserPlus,
  ClipboardEdit,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { RepairListItem, UrgencyStatus } from "../../types/TypeAssessment";
import { getPendingEvaluations } from "../../services/assessmentService";
import { useAssessmentStore } from "../../stores/useAssessmentModalStore";
import { useAuthStore } from "../../stores/authStore";

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

function formatDateTH(dateString?: string): string {
  return formatThaiDisplayDate(dateString);
}

function UrgencyBadge({ urgencyStatus }: { urgencyStatus?: string }) {
  const urgency = urgencyStatus || "NORMAL";

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "EMERGENCY":
        return "bg-rose-100 text-rose-700";
      case "URGENT":
        return "bg-amber-100 text-amber-700";
      case "NORMAL":
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const labelMap: Record<string, string> = {
    EMERGENCY: "ด่วนมาก",
    URGENT: "ด่วน",
    NORMAL: "ปกติ",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${getStatusStyle(
        urgency,
      )}`}
    >
      {labelMap[urgency] || "ปกติ"}
    </span>
  );
}

interface PendingEvaluationTableProps {
  search?: string;
  urgencyStatus?: UrgencyStatus | "ALL";
}

export default function PendingEvaluationTable({
  search = "",
  urgencyStatus = "ALL",
}: PendingEvaluationTableProps) {
  const { user } = useAuthStore();
  const isHead = user?.role === "MAINTENANCE_HEAD";

  const openAssessmentForm = useAssessmentStore(
    (state) => state.openAssessmentForm,
  );

  const term = useDebouncedSearch(search);
  const listQuery = useServerPage<RepairListItem>("pendingEvaluations", {
    search: term, urgencyStatus, evaluatedOnly: false, isRejected: false,
    statusCodes: ["WAITING_HANDOVER", "PENDING_ASSIGN", "IN_PROGRESS"],
    assignmentScope: isHead ? "MINE_OR_UNASSIGNED" : "MINE",
  }, (filters, signal) => getPage("/repairs", filters, signal), true);
  const isLoading = listQuery.isLoading;

  const columns = useMemo<ColumnDef<typeof features, RepairListItem>[]>(
    () => [
      {
        id: "jobNo",
        header: "รหัสงาน",
        cell: (info: any) => {
          const row = info.row.original;
          return (
            <span className="whitespace-nowrap font-semibold text-gray-900 font-mono">
              {row.jobNo || "-"}
            </span>
          );
        },
      },
      {
        id: "assetInfo",
        header: "รายการครุภัณฑ์",
        cell: (info: any) => {
          const row = info.row.original;
          return (
            <div>
              <div className="font-semibold text-gray-900">
                {row.asset?.name || "-"}
              </div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">
                {row.asset?.noid || "-"}
              </div>
            </div>
          );
        },
      },
      {
        id: "symptom",
        header: "อาการเสียที่แจ้ง",
        cell: (info: any) => (
          <span className="text-slate-600 line-clamp-2 max-w-xs">
            {info.row.original.symptom || "-"}
          </span>
        ),
      },
      {
        id: "urgencyStatus",
        header: "ระดับความเร่งด่วน",
        cell: (info: any) => (
          <UrgencyBadge urgencyStatus={info.row.original.urgencyStatus} />
        ),
      },
      {
        id: "createdAt",
        header: "วันที่แจ้งซ่อม",
        cell: (info: any) => {
          const date = info.row.original.createdAt;
          return (
            <span className="text-slate-600 whitespace-nowrap">
              {date ? formatDateTH(date) : "-"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "จัดการงาน",
        cell: (info: any) => {
          const row = info.row.original;

          const assignedMechanics =
            row.mechanicRepairs || row.mechanics || row.assignedMechanics || [];

          const currentUserId = String(user?.id ?? "");
          const currentMechanicId = String(
            (user as any)?.mechanicId ?? user?.id ?? "",
          );

          const isMyJob = assignedMechanics.some((m: any) => {
            const mUserId = String(m.userId ?? m.user?.id ?? m.id ?? "");
            const mMechanicId = String(m.mechanicId ?? m.id ?? "");

            return (
              (mUserId && mUserId === currentUserId) ||
              (mMechanicId && mMechanicId === currentMechanicId) ||
              (mUserId && mUserId === currentMechanicId) ||
              (mMechanicId && mMechanicId === currentUserId)
            );
          });

          const shouldShowAssessBtn = !isHead || isMyJob;

          return (
            <div className="flex items-center gap-2 whitespace-nowrap">
              {shouldShowAssessBtn ? (
                <button
                  type="button"
                  onClick={() => openAssessmentForm(row)}
                  className="inline-flex items-center gap-1.5 justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                >
                  <ClipboardEdit className="h-4 w-4" />
                  ประเมิน
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openAssessmentForm(row)}
                  className="inline-flex items-center gap-1.5 justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  จ่ายงาน
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [openAssessmentForm, isHead, user],
  );

  const filteredData = listQuery.rows;

  const table = useTable({
    key: "pending-evaluation-table",
    features,
    columns,
    data: filteredData,
    ...listQuery.tableOptions,
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <QueryStatus query={listQuery} />
      {/* พื้นที่ตาราง Scroll ได้ */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-sm text-slate-600">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200 shadow-sm">
            {table.getHeaderGroups().map((headerGroup: any) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header: any) => (
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
                <td
                  colSpan={columns.length}
                  className="text-center py-12 text-slate-400"
                >
                  กำลังโหลดรายการรอประเมิน...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12 text-slate-400"
                >
                  ไม่พบรายการงานแจ้งซ่อมที่รอประเมิน
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row: any) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  {row.getAllCells().map((cell: any) => (
                    <td
                      key={cell.id}
                      className="py-3.5 px-4 whitespace-nowrap align-middle"
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
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
                className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                  isCurrentPage
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
