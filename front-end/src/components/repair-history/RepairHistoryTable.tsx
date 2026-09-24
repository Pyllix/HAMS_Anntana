import { useEffect, useMemo, useState } from "react";
import {
  tableFeatures,
  useTable,
  rowPaginationFeature,       
  createPaginatedRowModel,    
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardEdit,
  Eye,
} from "lucide-react";

import {
  getNextWorkflowStage,
  getWorkflowProgress,
} from "../../config/repairWorkflow";
import RepairWorkflowActionDialog from "./RepairWorkflowActionDialog";
import UnrepairableHandoverDialog from "../unrepairable-technician/UnrepairableHandoverDialog";
import SpareRejectionReasonDialog from "./SpareRejectionReasonDialog";
import type { RepairListItem } from "../../types/TypeAssessment";
import {
  RepairActionFilter,
  RepairActionType,
  RepairJob,
  RepairJobStatusCode,
  RepairStatusFilter,
  RepairWorkflowStage,
} from "../../types/TypeRepairWorkflow";
import { useRepairHistoryModalStore } from "../../stores/useRepairHistoryModalStore";
import { useAssessmentStore } from "../../stores/useAssessmentModalStore";
import { useAuthStore } from "../../stores/authStore";
import {
  advanceRepairWorkflow,
  getRepairHistory,
} from "../../services/repairHistoryService";
import {
  publishOutsourceApprovalNotificationOnce,
  publishSpareApprovalNotificationOnce,
  publishWorkflowNotification,
} from "../../services/notificationService";

// เปิดใช้งาน Pagination Feature ใน tableFeatures ตามรูปแบบเดิม
const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

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
  WITH_PARTS: "ขอเบิกอะไหล่",
  INTERNAL_STOCK: "ขอเบิกอะไหล่ภายใน",
  EXTERNAL_STOCK: "ขอจัดหาอะไหล่ภายนอก",
  OUTSOURCE: "ส่งซ่อมภายนอก",
  UNREPAIRABLE: "ไม่สามารถซ่อมได้",
};

const actionStyles: Record<RepairActionType, string> = {
  SELF_REPAIR: "bg-emerald-50 text-emerald-700",
  WITH_PARTS: "bg-amber-50 text-amber-700",
  INTERNAL_STOCK: "bg-blue-50 text-blue-700",
  EXTERNAL_STOCK: "bg-amber-50 text-amber-700",
  OUTSOURCE: "bg-violet-50 text-violet-700",
  UNREPAIRABLE: "bg-rose-50 text-rose-700",
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
  const rejected = getWorkflowRejectionReason(job);
  if (rejected) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
        {job.actionType === "OUTSOURCE"
          ? "ปฏิเสธการส่งซ่อมภายนอก"
          : "ปฏิเสธการขอเบิกอะไหล่"}
      </span>
    );
  }
  if (job.actionType === "WITH_PARTS") {
    const approved = (job.workflowStep || 0) >= 5;
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          approved
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
        {approved ? "อนุมัติแล้ว — รอช่างรับอะไหล่" : "รอเจ้าหน้าที่พัสดุอนุมัติ"}
      </span>
    );
  }
  if (job.actionType === "OUTSOURCE") {
    const completedStep = job.workflowStep || 0;
    if (completedStep < 5) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
          รอเจ้าหน้าที่พัสดุอนุมัติส่งซ่อมภายนอก
        </span>
      );
    }
    if (completedStep === 5) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
          อนุมัติแล้ว — อยู่ระหว่างส่งซ่อมภายนอก
        </span>
      );
    }
  }
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

function getWorkflowRejectionReason(job: RepairJob): string | null {
  if (job.actionType !== "WITH_PARTS" && job.actionType !== "OUTSOURCE")
    return null;

  const apiReason = job.rejectReason?.trim();
  if (job.isRejected) {
    if (apiReason) return apiReason;
    const rejectedNote = job.steps?.find((step) =>
      step.note?.startsWith("[ไม่อนุมัติ]"),
    )?.note;
    return rejectedNote
      ? rejectedNote.replace(/^\[ไม่อนุมัติ\]\s*/, "")
      : "ไม่ระบุเหตุผล";
  }

  const legacyNote = job.steps?.find((step) =>
    step.note?.startsWith("[ไม่อนุมัติ]"),
  )?.note;
  return legacyNote ? legacyNote.replace(/^\[ไม่อนุมัติ\]\s*/, "") : null;
}

function isAssignedToUser(
  job: RepairJob,
  userId?: string | number,
  mechanicId?: string | number,
): boolean {
  const currentUserId = String(userId ?? "");
  const currentMechanicId = String(mechanicId ?? userId ?? "");

  return (job.mechanics || []).some((mechanic) => {
    const assignedUserId = String(mechanic.user?.userId ?? "");
    return (
      Boolean(assignedUserId) &&
      (assignedUserId === currentUserId || assignedUserId === currentMechanicId)
    );
  });
}

function toReassessmentListItem(
  job: RepairJob,
  rejectionReason: string,
): RepairListItem {
  return {
    id: job.jobId,
    jobNo: job.jobNo,
    symptom: job.symptom,
    urgencyStatus: job.urgencyStatus,
    createdAt: job.createdAt,
    isReassessment: true,
    rejectionReason,
    mechanicRepairs: (job.mechanics || []).map((mechanic) => ({
      id: mechanic.mechanicRepairId,
      jobId: mechanic.jobId,
      userId: mechanic.user.userId,
      createdAt: mechanic.createdAt,
      updatedAt: mechanic.updatedAt,
    })),
    asset: job.asset
      ? {
          id: job.asset.assetId,
          name: job.asset.assetName,
          noid: job.asset.assetCode,
        }
      : undefined,
  };
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
  const openAssessmentForm = useAssessmentStore(
    (state) => state.openAssessmentForm,
  );
  const user = useAuthStore((state) => state.user);
  const [currentPage, setCurrentPage] = useState(1);
  const [workflowTarget, setWorkflowTarget] = useState<{
    job: RepairJob;
    stage: RepairWorkflowStage;
  } | null>(null);
  const [handoverJobId, setHandoverJobId] = useState<string | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<{
    jobNo: string;
    reason: string;
    actionType?: RepairActionType | null;
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
    jobs.forEach((job) => {
      publishSpareApprovalNotificationOnce(job);
      publishOutsourceApprovalNotificationOnce(job);
    });
  }, [jobs]);

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
          <span className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
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
            <div className="min-w-[200px]">
              <p className="text-sm font-semibold text-slate-900">
                {job.asset?.assetName || "-"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{job.symptom}</p>
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
          const rejectionReason = getWorkflowRejectionReason(job);
          const canReassess = Boolean(
            rejectionReason &&
              isAssignedToUser(
                job,
                user?.id,
                (user as { mechanicId?: string | number } | undefined)
                  ?.mechanicId,
              ),
          );
          const canUpdateStage =
            !rejectionReason && nextStage?.actor === "MAINTENANCE";
          const progress = getWorkflowProgress(job);

          return (
            <div className="flex items-center justify-start gap-2.5 min-w-[240px]">
              <button
                type="button"
                title="ดูรายละเอียดประวัติงาน"
                onClick={() => openDetail(job)}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <Eye className="h-4 w-4" />
              </button>
              <div className="flex-1">
                {rejectionReason && (
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setRejectionTarget({
                          jobNo: job.jobNo,
                          reason: rejectionReason,
                          actionType: job.actionType,
                        })
                      }
                      className="flex h-8 w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      ดูเหตุผลการปฏิเสธ
                    </button>
                    {canReassess && (
                      <button
                        type="button"
                        onClick={() =>
                          openAssessmentForm(
                            toReassessmentListItem(job, rejectionReason),
                          )
                        }
                        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700"
                      >
                        <ClipboardEdit className="h-3.5 w-3.5" />
                        ประเมินใหม่
                      </button>
                    )}
                  </div>
                )}
                {nextStage && !rejectionReason && canUpdateStage && (
                  <div className="w-full text-center">
                    <button
                      type="button"
                      disabled={updateWorkflow.isLoading}
                      onClick={() => {
                        if (
                          job.actionType === "UNREPAIRABLE" &&
                          nextStage.stepNumber === 5
                        ) {
                          setHandoverJobId(job.jobId);
                        } else {
                          setWorkflowTarget({ job, stage: nextStage });
                        }
                      }}
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
                {nextStage && !rejectionReason && !canUpdateStage && (
                  <div className="w-full text-center">
                    <span className="flex min-h-[36px] w-full items-center justify-center rounded-lg bg-amber-50 px-2 py-1.5 text-center text-xs font-semibold leading-4 text-amber-700">
                      {pendingActorLabel(nextStage)}
                    </span>
                    <p className="mt-1 text-center text-[10px] leading-3 text-slate-400">
                      {pendingActorHint(nextStage)}
                    </p>
                  </div>
                )}
                {isWaitingDelivery && (
                  <span className="flex h-8 w-full items-center justify-center whitespace-nowrap rounded-lg bg-cyan-50 px-2.5 text-xs font-semibold text-cyan-700">
                    รอหน่วยงานตรวจรับ
                  </span>
                )}
                {isCompleted && (
                  <span className="flex h-8 w-full items-center justify-center whitespace-nowrap rounded-lg bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-600">
                    ปิดงานแล้ว
                  </span>
                )}
                {isCancelled && (
                  <span className="flex h-8 w-full items-center justify-center whitespace-nowrap rounded-lg bg-slate-100 px-2.5 text-xs font-semibold text-slate-500">
                    ยกเลิกแล้ว
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
    ],
    [openAssessmentForm, openDetail, updateWorkflow.isLoading, user],
  );

  const table = useTable({
    key: "confirm-repair-table",
    features,
    columns,
    data: filteredData,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mt-4">
      {/* Scrollable Container สำหรับตัวตาราง */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-sm text-slate-600">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200 shadow-xs">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3.5 whitespace-nowrap">
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
                  className="py-12 text-center text-slate-400"
                >
                  กำลังโหลดรายการงานซ่อม...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-rose-500 text-sm"
                >
                  ไม่สามารถโหลดรายการงานซ่อมได้
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-slate-400"
                >
                  ไม่พบรายการงานซ่อมตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3.5 whitespace-nowrap align-middle"
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

      {/* Pagination - ใช้โครงสร้างเดียวกับ AvailableAssetsTable */}
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
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

          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
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
      {handoverJobId && (
        <UnrepairableHandoverDialog
          jobId={handoverJobId}
          onClose={() => setHandoverJobId(null)}
          onSuccess={() => {
            setHandoverJobId(null);
            void queryClient.invalidateQueries();
          }}
        />
      )}
      {rejectionTarget && (
        <SpareRejectionReasonDialog
          jobNo={rejectionTarget.jobNo}
          reason={rejectionTarget.reason}
          actionType={rejectionTarget.actionType}
          onClose={() => setRejectionTarget(null)}
        />
      )}
    </div>
  );
}