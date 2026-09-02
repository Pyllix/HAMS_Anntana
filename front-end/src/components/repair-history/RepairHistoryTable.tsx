import { useEffect, useMemo, useState } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ClipboardCheck, Eye } from "lucide-react";

import {
  getNextWorkflowStage,
  getWorkflowProgress,
} from "../../config/repairWorkflow";
import RepairWorkflowActionDialog from "./RepairWorkflowActionDialog";
import {
  RepairActionFilter,
  RepairActionType,
  RepairJob,
  RepairJobStatusCode,
  RepairStatusFilter,
  RepairWorkflowStage,
} from "../../Types/TypeRepairWorkflow";
import { useRepairHistoryModalStore } from "../../stores/useRepairHistoryModalStore";
import {
  advanceRepairWorkflow,
  getRepairHistory,
} from "../../services/repairHistoryService";
import { publishWorkflowNotification } from "../../services/notificationService";

const features = tableFeatures({});

const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function formatDateTH(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

const actionLabels: Record<RepairActionType, string> = {
  SELF_REPAIR: "ซ่อมเองได้",
  INTERNAL_STOCK: "ขอเบิกอะไหล่ภายใน",
  EXTERNAL_STOCK: "ขอจัดหาอะไหล่ภายนอก",
  OUTSOURCE: "ส่งซ่อมภายนอก",
  PURCHASE_REPLACEMENT: "เสนอซื้อทดแทน",
};

const actionStyles: Record<RepairActionType, string> = {
  SELF_REPAIR: "bg-emerald-50 text-emerald-700",
  INTERNAL_STOCK: "bg-blue-50 text-blue-700",
  EXTERNAL_STOCK: "bg-amber-50 text-amber-700",
  OUTSOURCE: "bg-violet-50 text-violet-700",
  PURCHASE_REPLACEMENT: "bg-rose-50 text-rose-700",
};

const statusStyles: Record<RepairJobStatusCode, string> = {
  WAITING_HANDOVER: "bg-slate-100 text-slate-700",
  PENDING_ASSIGN: "bg-sky-50 text-sky-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  WAITING_PARTS: "bg-amber-50 text-amber-700",
  PARCEL_PROCESSING: "bg-orange-50 text-orange-700",
  OUTSOURCED: "bg-violet-50 text-violet-700",
  UNREPAIRABLE: "bg-rose-50 text-rose-700",
  WAITING_DELIVERY: "bg-cyan-50 text-cyan-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

function ActionBadge({ value }: { value?: RepairActionType | null }) {
  if (!value) return <span className="text-xs text-slate-400">ยังไม่ระบุ</span>;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${actionStyles[value]}`}
    >
      {actionLabels[value]}
    </span>
  );
}

function StatusBadge({ job }: { job: RepairJob }) {
  const code = job.status?.statusCode || "IN_PROGRESS";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[code]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {job.status?.statusName || "กำลังดำเนินการ"}
    </span>
  );
}

function pendingActorLabel(stage: RepairWorkflowStage): string {
  if (stage.actor === "PARCEL") {
    return stage.stepLabel.startsWith("พัสดุ")
      ? `รอ${stage.stepLabel.replace("พัสดุ", "เจ้าหน้าที่พัสดุ")}`
      : `รอเจ้าหน้าที่พัสดุ${stage.stepLabel}`;
  }
  if (stage.actor === "SUPERVISOR") {
    return stage.stepLabel.startsWith("ผู้บริหาร")
      ? `รอ${stage.stepLabel}`
      : `รอผู้บริหาร${stage.stepLabel}`;
  }
  if (stage.actor === "DEPARTMENT") return `รอหน่วยงาน${stage.stepLabel}`;
  return `รอช่างผู้รับผิดชอบ${stage.stepLabel}`;
}

function pendingActorHint(stage: RepairWorkflowStage): string {
  if (stage.actor === "PARCEL") {
    return "ขั้นตอนนี้ต้องดำเนินการจากหน้าของเจ้าหน้าที่พัสดุ";
  }
  if (stage.actor === "SUPERVISOR") {
    return "ขั้นตอนนี้ต้องดำเนินการจากหน้าของผู้บริหาร";
  }
  if (stage.actor === "DEPARTMENT") {
    return "ขั้นตอนนี้ต้องดำเนินการจากหน้าของหน่วยงาน";
  }
  return "ขั้นตอนนี้เป็นหน้าที่ของช่างผู้รับผิดชอบ";
}

interface RepairHistoryTableProps {
  search?: string;
  actionType?: RepairActionFilter;
  status?: RepairStatusFilter;
}

export default function RepairHistoryTable({
  search = "",
  actionType = "ALL",
  status = "ALL",
}: RepairHistoryTableProps) {
  const queryClient = useQueryClient();
  const openDetail = useRepairHistoryModalStore((state) => state.openModal);
  const [currentPage, setCurrentPage] = useState(1);
  const [workflowTarget, setWorkflowTarget] = useState<{
    job: RepairJob;
    stage: RepairWorkflowStage;
  } | null>(null);
  const pageSize = 5;

  const {
    data: jobs = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["repairHistory"],
    queryFn: getRepairHistory,
  });

  const updateWorkflow = useMutation({
    mutationFn: ({
      jobId,
      stage,
    }: {
      jobId: string;
      stage: RepairWorkflowStage;
    }) => advanceRepairWorkflow(jobId, stage),
    onSuccess: async (job, variables) => {
      publishWorkflowNotification(job, variables.stage);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["repairHistory"] }),
        queryClient.invalidateQueries({ queryKey: ["repairConfirmations"] }),
      ]);
      setWorkflowTarget(null);
    },
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, actionType, status]);

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch =
        !keyword ||
        job.jobNo.toLowerCase().includes(keyword) ||
        job.asset?.assetName.toLowerCase().includes(keyword) ||
        job.asset?.assetCode.toLowerCase().includes(keyword) ||
        job.symptom.toLowerCase().includes(keyword);
      const matchesAction =
        actionType === "ALL" || job.actionType === actionType;
      const matchesStatus =
        status === "ALL" || job.status?.statusCode === status;
      return matchesSearch && matchesAction && matchesStatus;
    });
  }, [jobs, search, actionType, status]);

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
        header: "ครุภัณฑ์ / รายการแจ้งซ่อม",
        cell: (info) => {
          const job = info.row.original;
          return (
            <div className="min-w-[220px]">
              <p className="text-sm font-semibold text-slate-900">
                {job.asset?.assetName || "-"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{job.symptom}</p>
              <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                {job.asset?.assetCode || "-"}
              </p>
            </div>
          );
        },
      },
      {
        id: "assessment",
        header: "ผลการประเมิน",
        cell: (info) => <ActionBadge value={info.row.original.actionType} />,
      },
      {
        id: "evaluatedAt",
        header: "วันที่ประเมิน",
        cell: (info) => (
          <span className="whitespace-nowrap text-xs text-slate-600">
            {formatDateTH(info.row.original.evaluatedAt)}
          </span>
        ),
      },
      {
        id: "evaluator",
        header: "ผู้ประเมิน",
        cell: (info) => {
          const evaluator = info.row.original.evaluator;
          return (
            <span className="whitespace-nowrap text-xs text-slate-700">
              {evaluator ? `${evaluator.firstName} ${evaluator.lastName}` : "-"}
            </span>
          );
        },
      },
      {
        id: "status",
        header: "สถานะ",
        cell: (info) => <StatusBadge job={info.row.original} />,
      },
      {
        id: "actions",
        header: "จัดการ",
        cell: (info) => {
          const job = info.row.original;
          const isCompleted = job.status?.statusCode === "COMPLETED";
          const isWaitingDelivery =
            job.status?.statusCode === "WAITING_DELIVERY";
          const isCancelled = job.status?.statusCode === "CANCELLED";
          const nextStage = getNextWorkflowStage(job);
          const canUpdateStage = nextStage?.actor === "MAINTENANCE";
          const progress = getWorkflowProgress(job);

          return (
            <div className="grid min-w-[270px] grid-cols-[40px_218px] items-center justify-end gap-3">
              <button
                type="button"
                title="ดูรายละเอียดประวัติงาน"
                onClick={() => openDetail(job)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <Eye className="h-4 w-4" />
              </button>
              {nextStage && canUpdateStage && (
                <div className="w-full text-center">
                  <button
                    type="button"
                    disabled={updateWorkflow.isLoading}
                    onClick={() => setWorkflowTarget({ job, stage: nextStage })}
                    className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    {nextStage.actionLabel}
                  </button>
                  <p className="mt-1 text-[10px] text-slate-400">
                    เสร็จแล้ว {progress.completed}/{progress.total} ขั้นตอน
                  </p>
                </div>
              )}
              {nextStage && !canUpdateStage && (
                <div className="w-full text-center">
                  <span className="flex min-h-11 w-full items-center justify-center rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-semibold leading-4 text-amber-700">
                    {pendingActorLabel(nextStage)}
                  </span>
                  <p className="mt-1 text-center text-[10px] leading-4 text-slate-400">
                    {pendingActorHint(nextStage)}
                  </p>
                </div>
              )}
              {isWaitingDelivery && (
                <span className="flex h-9 w-full items-center justify-center whitespace-nowrap rounded-lg bg-cyan-50 px-3 text-xs font-semibold text-cyan-700">
                  รอหน่วยงานตรวจรับ
                </span>
              )}
              {isCompleted && (
                <span className="flex h-9 w-full items-center justify-center whitespace-nowrap rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-600">
                  ปิดงานแล้ว
                </span>
              )}
              {isCancelled && (
                <span className="flex h-9 w-full items-center justify-center whitespace-nowrap rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-500">
                  ยกเลิกแล้ว
                </span>
              )}
            </div>
          );
        },
      },
    ],
    [openDetail, updateWorkflow.isLoading],
  );

  const table = useTable({
    key: "repair-history-table",
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
                  กำลังโหลดรายการงานซ่อม...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-sm text-rose-500"
                >
                  ไม่สามารถโหลดรายการงานซ่อมได้
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-sm text-slate-400"
                >
                  ไม่พบรายการงานซ่อมตามเงื่อนไขที่เลือก
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
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
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

      <RepairWorkflowActionDialog
        job={workflowTarget?.job || null}
        stage={workflowTarget?.stage || null}
        isLoading={updateWorkflow.isLoading}
        error={
          updateWorkflow.isError
            ? updateWorkflow.error instanceof Error
              ? updateWorkflow.error.message
              : "ไม่สามารถอัปเดตขั้นตอนงานได้"
            : undefined
        }
        onClose={() => {
          if (!updateWorkflow.isLoading) {
            updateWorkflow.reset();
            setWorkflowTarget(null);
          }
        }}
        onConfirm={() => {
          if (workflowTarget) {
            updateWorkflow.mutate({
              jobId: workflowTarget.job.jobId,
              stage: workflowTarget.stage,
            });
          }
        }}
      />
    </div>
  );
}
