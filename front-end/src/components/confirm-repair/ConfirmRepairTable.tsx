import { useEffect, useMemo, useState } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ClipboardCheck, Eye } from "lucide-react";
import { RepairJob, RepairStatusFilter } from "../../Types/TypeRepairWorkflow";
import { useConfirmRepairModalStore } from "../../stores/useConfirmRepairModalStore";
import { useRepairHistoryModalStore } from "../../stores/useRepairHistoryModalStore";
import { getRepairConfirmations } from "../../services/confirmRepairService";

const features = tableFeatures({});

function formatDateTH(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

interface ConfirmRepairTableProps {
  search?: string;
  status?: RepairStatusFilter;
}

export default function ConfirmRepairTable({
  search = "",
  status = "ALL",
}: ConfirmRepairTableProps) {
  const openConfirm = useConfirmRepairModalStore((state) => state.openModal);
  const openDetail = useRepairHistoryModalStore((state) => state.openModal);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const {
    data: jobs = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["repairConfirmations"],
    queryFn: getRepairConfirmations,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status]);

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch =
        !keyword ||
        job.jobNo.toLowerCase().includes(keyword) ||
        job.asset?.assetName.toLowerCase().includes(keyword) ||
        job.asset?.assetCode.toLowerCase().includes(keyword) ||
        job.symptom.toLowerCase().includes(keyword);
      const matchesStatus =
        status === "ALL" || job.status?.statusCode === status;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, search, status]);

  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = useMemo(
    () => filteredData.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredData, safePage],
  );

  const columns = useMemo<Array<ColumnDef<typeof features, RepairJob>>>(
    () => [
      {
        id: "jobNo",
        header: "รหัสงาน",
        cell: (info) => (
          <span className="font-mono text-xs font-bold text-slate-900">
            {info.row.original.jobNo}
          </span>
        ),
      },
      {
        id: "asset",
        header: "รายการครุภัณฑ์",
        cell: (info) => {
          const job = info.row.original;
          return (
            <div className="min-w-[210px]">
              <p className="text-sm font-semibold text-slate-900">
                {job.asset?.assetName || "-"}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                {job.asset?.serialNumber || "-"} / {job.asset?.assetCode || "-"}
              </p>
            </div>
          );
        },
      },
      {
        id: "symptom",
        header: "อาการเสียที่แจ้ง",
        cell: (info) => (
          <span className="block max-w-[250px] text-xs leading-5 text-slate-600">
            {info.row.original.symptom}
          </span>
        ),
      },
      {
        id: "status",
        header: "สถานะ",
        cell: (info) => {
          const completed =
            info.row.original.status?.statusCode === "COMPLETED";
          return (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                completed
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
              {completed ? "ตรวจรับแล้ว" : "รอตรวจรับ"}
            </span>
          );
        },
      },
      {
        id: "createdAt",
        header: "วันที่แจ้งซ่อม",
        cell: (info) => (
          <span className="whitespace-nowrap text-xs text-slate-600">
            {formatDateTH(info.row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "detail",
        header: "รายละเอียด",
        cell: (info) => (
          <button
            type="button"
            title="ดูรายละเอียดงาน"
            onClick={() => openDetail(info.row.original)}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <Eye className="h-4 w-4" />
          </button>
        ),
      },
      {
        id: "actions",
        header: "จัดการ",
        cell: (info) => {
          const job = info.row.original;
          const completed = job.status?.statusCode === "COMPLETED";
          return completed ? (
            <button
              type="button"
              disabled
              className="h-8 cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-400"
            >
              ปิดงานแล้ว
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openConfirm(job)}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              ตรวจรับ
            </button>
          );
        },
      },
    ],
    [openConfirm, openDetail],
  );

  const table = useTable({
    key: "confirm-repair-table",
    features,
    columns,
    data: paginatedData,
  });

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/70 text-xs font-bold text-slate-700">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-200">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3">
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-sm text-slate-400"
                >
                  กำลังโหลดรายการรอยืนยัน...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-sm text-rose-500"
                >
                  ไม่สามารถโหลดรายการยืนยันการซ่อมได้
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-sm text-slate-400"
                >
                  ไม่พบรายการที่รอยืนยันการซ่อม
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-slate-50/70"
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 sm:flex-row">
        <span>
          แสดง {totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1} ถึง{" "}
          {Math.min(safePage * pageSize, totalItems)} จาก {totalItems} รายการ
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="หน้าก่อนหน้า"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map(
            (page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-xs font-semibold ${
                  safePage === page
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label="หน้าถัดไป"
            disabled={safePage >= totalPages}
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
