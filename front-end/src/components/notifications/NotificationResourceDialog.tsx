import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useAuthStore } from "../../stores/authStore";
import {
  findBorrowExtensionById,
  getBorrowingById,
  type BorrowExtension,
  type BorrowingDetail,
} from "../../services/borrowService";
import { getRepairById, type TrackRes } from "../../services/trackingService";
import { isActionAlreadyHandled } from "../../services/notificationTargets";

type ResourceDetail =
  | { kind: "BORROW_TRANSACTION"; data: BorrowingDetail }
  | { kind: "BORROW_EXTENSION"; data: BorrowExtension | null }
  | { kind: "REPAIR_JOB"; data: TrackRes };

const EXTENSION_STATUS_LABELS: Record<string, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ถูกปฏิเสธ",
  CANCELLED: "ยกเลิก",
};

async function fetchResourceDetail(
  resourceType: string,
  resourceId: string,
): Promise<ResourceDetail> {
  switch (resourceType) {
    case "BORROW_TRANSACTION":
      return { kind: resourceType, data: await getBorrowingById(resourceId) };
    case "BORROW_EXTENSION":
      return { kind: resourceType, data: await findBorrowExtensionById(resourceId) };
    case "REPAIR_JOB":
      return { kind: resourceType, data: await getRepairById(resourceId) };
    default:
      throw new Error("UNKNOWN_RESOURCE_TYPE");
  }
}

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const fullName = (person?: { firstname?: string; lastname?: string } | null) =>
  person ? `${person.firstname ?? ""} ${person.lastname ?? ""}`.trim() || "-" : "-";

const TITLES: Record<string, string> = {
  BORROW_TRANSACTION: "รายละเอียดการยืม",
  BORROW_EXTENSION: "รายละเอียดคำขอต่ออายุ",
  REPAIR_JOB: "รายละเอียดงานซ่อม",
};

function latestStatusCode(detail: ResourceDetail): string | undefined {
  if (detail.kind === "BORROW_TRANSACTION") return detail.data.borrowStatus?.code;
  if (detail.kind === "BORROW_EXTENSION") return detail.data?.status;
  return undefined;
}

export default function NotificationResourceDialog({
  resourceType,
  resourceId,
  notificationType,
  onClose,
}: {
  resourceType: string;
  resourceId: string;
  notificationType?: string | null;
  onClose: () => void;
}) {
  const userId = useAuthStore((state) => state.user?.id);
  const query = useQuery({
    queryKey: ["notification-resource", userId, resourceType, resourceId],
    queryFn: () => fetchResourceDetail(resourceType, resourceId),
    enabled: Boolean(userId),
    retry: false,
  });

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-800/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-resource-title"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white text-gray-800 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 id="notification-resource-title" className="text-lg font-bold text-gray-800">
            {TITLES[resourceType] ?? "รายละเอียด"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 text-sm">
          {query.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
            </div>
          ) : query.isError ? (
            <p role="alert" className="py-6 text-center text-rose-600">
              ไม่พบข้อมูล หรือคุณไม่มีสิทธิ์เข้าถึงรายการนี้
            </p>
          ) : query.data ? (
            <>
              {isActionAlreadyHandled(notificationType, latestStatusCode(query.data)) && (
                <p
                  role="status"
                  className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
                >
                  รายการนี้ได้รับการดำเนินการแล้ว ข้อมูลด้านล่างเป็นสถานะล่าสุด
                </p>
              )}
              <ResourceDetailBody detail={query.data} notificationType={notificationType} />
            </>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-gray-100 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

function ResourceDetailBody({ detail, notificationType }: {
  detail: ResourceDetail;
  notificationType?: string | null;
}) {
  if (detail.kind === "BORROW_TRANSACTION") {
    const borrow = detail.data;
    const lastExtension = borrow.extensions?.at(-1);
    return (
      <DetailList
        rows={[
          ["เลขที่คำขอ", borrow.borrowNo],
          ["ครุภัณฑ์", `${borrow.asset?.name ?? "-"} (${borrow.asset?.noid || borrow.asset?.model || "-"})`],
          ["ผู้ยืม", fullName(borrow.borrower)],
          ["สถานะ", borrow.borrowStatus?.name ?? "-"],
          ["วันที่ยืม", formatDate(borrow.handover_date ?? borrow.createdAt)],
          [
            "กำหนดคืน",
            <span className={borrow.isOverdue ? "font-semibold text-rose-600" : undefined}>
              {formatDate(borrow.expectedReturnDate)}
              {borrow.isOverdue ? ` (เกินกำหนด ${borrow.overdueDays ?? 0} วัน)` : ""}
            </span>,
          ],
          ...(lastExtension
            ? ([
                [
                  "ต่ออายุล่าสุด",
                  `รอบที่ ${lastExtension.roundNumber} – ${EXTENSION_STATUS_LABELS[lastExtension.status] ?? lastExtension.status}`,
                ],
              ] as Array<[string, ReactNode]>)
            : []),
        ]}
      />
    );
  }

  if (detail.kind === "BORROW_EXTENSION") {
    const extension = detail.data;
    if (!extension) {
      return (
        <p className="py-6 text-center text-slate-500">
          ไม่พบคำขอต่ออายุนี้ในรายการล่าสุด กรุณาตรวจสอบสถานะจากรายการยืม
        </p>
      );
    }
    return (
      <DetailList
        rows={[
          ["เลขที่คำขอยืม", extension.borrowTransaction?.borrowNo ?? "-"],
          ["ครุภัณฑ์", extension.borrowTransaction?.asset?.name ?? "-"],
          ["รอบที่", String(extension.roundNumber)],
          ["สถานะ", EXTENSION_STATUS_LABELS[extension.status] ?? extension.status],
          ["กำหนดคืนเดิม", formatDate(extension.currentReturnDate)],
          ["กำหนดคืนที่ขอ", formatDate(extension.requestedReturnDate)],
          ["เหตุผล", extension.reason || "-"],
          ...(extension.rejectReason
            ? ([["เหตุผลที่ปฏิเสธ", extension.rejectReason]] as Array<[string, ReactNode]>)
            : []),
          ["ผู้ขอ", fullName(extension.requestedByUser)],
        ]}
      />
    );
  }

  const job = detail.data;
  const isUnrepairableReceipt = notificationType === "REPAIR_UNREPAIRABLE_RECEIVED";
  const receivedByParcel = isUnrepairableReceipt && !!job.unrepairableReason && job.jobStatus?.code === "COMPLETED" && !!job.returnDate;
  return (
    <DetailList
      rows={[
        ["รหัสแจ้งซ่อม", job.jobNo],
        ["ครุภัณฑ์", `${job.asset?.name ?? "-"} (${job.asset?.noid ?? "-"})`],
        ["แผนก", job.section?.name ?? "-"],
        ["ผู้แจ้ง", fullName(job.reporter)],
        ["อาการ", job.symptom || "-"],
        ["สถานะ", receivedByParcel ? "ซ่อมไม่ได้ / พัสดุรับมอบแล้ว" : job.jobStatus?.name ?? "-"],
        ...(isUnrepairableReceipt
          ? ([
              ["เหตุผลที่ซ่อมไม่ได้", job.unrepairableReason || "-"],
              ["พัสดุผู้รับมอบ", fullName(job.receiver)],
              ["วันที่พัสดุรับมอบ", formatDate(job.returnDate)],
            ] as Array<[string, ReactNode]>)
          : []),
        ["วันที่แจ้ง", formatDate(job.createdAt)],
      ]}
    />
  );
}

function DetailList({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-slate-500">{label}</dt>
          <dd className="font-medium text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
