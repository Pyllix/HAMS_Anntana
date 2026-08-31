import { useMemo, useState, useEffect } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { RepairJob, PriorityFilter } from "../../Types/TypeAssessment";
import { getPendingEvaluations } from "../../services/assessmentService";

const features = tableFeatures({});

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatDateTH(dateString?: string): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

// ─── Status Badge Component ────────────────────────────────────────────────────

function UrgencyBadge({ job }: { job: RepairJob }) {
  const urgency = job.urgencyStatus || "NORMAL";

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
        urgency
      )}`}
    >
      {labelMap[urgency] || "ปกติ"}
    </span>
  );
}

// ─── Columns Definition ───────────────────────────────────────────────────────

const columns: Array<ColumnDef<typeof features, RepairJob>> = [
  {
    id: "jobNo",
    header: "รหัสงาน",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="font-semibold text-gray-900 font-mono text-sm">
          {row.jobNo || row.jobId}
        </span>
      );
    },
  },
  {
    id: "assetInfo",
    header: "รายการครุภัณฑ์",
    cell: (info) => {
      const asset = info.row.original.asset;
      return (
        <div>
          <div className="font-semibold text-gray-900 text-sm">
            {asset?.assetName || "-"}
          </div>
          <div className="text-sm text-gray-600 font-mono mt-0.5">
            {asset?.assetCode || "-"}
          </div>
        </div>
      );
    },
  },
  {
    id: "symptom",
    header: "อาการเสียที่แจ้ง",
    cell: (info) => (
      <span className="text-sm text-gray-600 line-clamp-2 max-w-xs">
        {info.row.original.symptom || "-"}
      </span>
    ),
  },
  {
    id: "urgencyStatus",
    header: "ระดับความเร่งด่วน",
    cell: (info) => <UrgencyBadge job={info.row.original} />,
  },
  {
    id: "createdAt",
    header: "วันที่แจ้งซ่อม",
    cell: (info) => (
      <span className="text-sm text-gray-600 whitespace-nowrap">
        {formatDateTH(info.row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "actions",
    header: "การจัดการ",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const customEvent = new CustomEvent("open-evaluate-modal", { detail: row });
              window.dispatchEvent(customEvent);
            }}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
          >
            ประเมิน
          </button>
        </div>
      );
    },
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

interface PendingEvaluationTableProps {
  search?: string;
  urgencyStatus?: PriorityFilter;
}

export default function PendingEvaluationTable({
  search = "",
  urgencyStatus = "ALL",
}: PendingEvaluationTableProps) {
  const { data: jobsData = [], isLoading } = useQuery({
    queryKey: ["pendingEvaluations"],
    queryFn: getPendingEvaluations,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, urgencyStatus]);

  const filteredData = useMemo(() => {
    if (!jobsData) return [];
    return jobsData.filter((item) => {
      const sl = search.toLowerCase();
      const matchesSearch =
        search === "" ||
        item.jobNo?.toLowerCase().includes(sl) ||
        String(item.jobId)?.toLowerCase().includes(sl) ||
        item.asset?.assetName?.toLowerCase().includes(sl) ||
        item.asset?.assetCode?.toLowerCase().includes(sl) ||
        item.symptom?.toLowerCase().includes(sl);

      const matchesUrgency =
        urgencyStatus === "ALL" ||
        (item.urgencyStatus || "NORMAL") === urgencyStatus;

      return matchesSearch && matchesUrgency;
    });
  }, [jobsData, search, urgencyStatus]);

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = useMemo(
    () =>
      filteredData.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
      ),
    [filteredData, currentPage],
  );

  const table = useTable({
    key: "pending-evaluation-table",
    features,
    columns,
    data: paginatedData,
  });

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
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
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-slate-400 text-sm"
                >
                  กำลังโหลดรายการรอประเมิน...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-slate-400 text-sm"
                >
                  ไม่พบรายการงานแจ้งซ่อมที่รอประเมิน
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="py-3 px-4">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 text-sm text-slate-500">
        <div>
          แสดง {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} ถึง{" "}
          {Math.min(currentPage * pageSize, totalItems)} จาก{" "}
          {totalItems.toLocaleString()} รายการ
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, currentPage - 3), currentPage + 2)
            .map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  currentPage === page
                    ? "bg-emerald-600 font-semibold text-white shadow-sm"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}