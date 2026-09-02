import { useEffect } from "react";
import { ClipboardList, Package, PenLine, X } from "lucide-react";
import { useRepairHistoryModalStore } from "../../stores/useRepairHistoryModalStore";
import {
  RepairActionType,
  RepairJobStatusCode,
} from "../../Types/TypeRepairWorkflow";

const actionLabels: Record<RepairActionType, string> = {
  SELF_REPAIR: "ซ่อมเองได้",
  INTERNAL_STOCK: "ขอเบิกอะไหล่ภายใน",
  EXTERNAL_STOCK: "ขอจัดหาอะไหล่ภายนอก",
  OUTSOURCE: "ส่งซ่อมภายนอก",
  PURCHASE_REPLACEMENT: "เสนอซื้อทดแทน",
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

function formatDateTimeTH(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function personName(
  user?: { firstName: string; lastName: string } | null,
): string {
  return user ? `${user.firstName} ${user.lastName}` : "-";
}

export default function RepairHistoryDetailModal() {
  const { isOpen, selectedJob: job, closeModal } = useRepairHistoryModalStore();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeModal]);

  if (!isOpen || !job) return null;

  const statusCode = job.status?.statusCode || "IN_PROGRESS";
  const withdrawnParts =
    job.sparePartTransactions?.filter(
      (item) => item.transactionType === "WITHDRAW",
    ) || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5 sm:px-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              รายละเอียดประวัติงาน
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              ข้อมูลผลการประเมินที่บันทึกไว้ ไม่สามารถแก้ไขจากหน้านี้
            </p>
          </div>
          <button
            type="button"
            aria-label="ปิดรายละเอียด"
            onClick={closeModal}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5 px-6 py-5 sm:px-8">
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="font-mono text-xs font-bold text-blue-600">
                {job.jobNo}
              </p>
              <h3 className="mt-1 text-base font-bold text-slate-900">
                {job.asset?.assetName || "ไม่ระบุครุภัณฑ์"} · {job.symptom}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs text-slate-500">
                <span className="block">ประเมินเมื่อ</span>
                <strong className="mt-0.5 block text-slate-900">
                  {formatDateTimeTH(job.evaluatedAt)}
                </strong>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${statusStyles[statusCode]}`}
              >
                <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                {job.status?.statusName || "กำลังดำเนินการ"}
              </span>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 p-5">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <h3 className="font-bold text-slate-900">
                  ข้อมูลครุภัณฑ์และรายการแจ้งซ่อม
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <Info label="รหัสครุภัณฑ์" value={job.asset?.assetCode} />
                <Info
                  label="ประเภทการแจ้ง"
                  value="ซ่อมเครื่องมือแพทย์"
                  accent
                />
                <Info
                  className="col-span-2"
                  label="ชื่อครุภัณฑ์ / รุ่น / ยี่ห้อ"
                  value={`${job.asset?.assetName || "-"}${job.asset?.model ? ` (${job.asset.model})` : ""}`}
                />
                <Info label="หมายเลขเครื่อง" value={job.asset?.serialNumber} />
                <Info label="สถานที่ตั้ง" value={job.asset?.location} />
                <Info label="ผู้แจ้งซ่อม" value={personName(job.reporter)} />
                <Info
                  label="ความเร่งด่วน"
                  value={
                    job.urgencyStatus === "EMERGENCY"
                      ? "ด่วนมาก"
                      : job.urgencyStatus === "URGENT"
                        ? "ด่วน"
                        : "ปกติ"
                  }
                  danger={job.urgencyStatus === "EMERGENCY"}
                />
                <Info
                  label="วันที่แจ้ง"
                  value={formatDateTimeTH(job.createdAt)}
                />
                <Info
                  className="col-span-2"
                  label="อาการที่แจ้ง"
                  value={job.symptom}
                />
              </div>
            </section>

            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 p-5">
                <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <PenLine className="h-5 w-5" />
                  </span>
                  <h3 className="font-bold text-slate-900">
                    ผลการประเมินที่บันทึกไว้
                  </h3>
                </div>
                <div className="space-y-3 text-xs">
                  <Info label="อาการ / สาเหตุที่ตรวจพบ" value={job.diagnosis} />
                  <Info label="วิธีแก้ไขที่ดำเนินการ" value={job.solution} />
                  <div className="grid grid-cols-3 gap-3">
                    <Info
                      label="วิเคราะห์สาเหตุ"
                      value={job.cause?.causeName}
                    />
                    <Info
                      label="ซ่อมซ้ำ"
                      value={job.isRepeatRepair ? "ใช่" : "ไม่"}
                    />
                    <Info
                      label="กำหนดแล้วเสร็จ"
                      value={formatDateTimeTH(job.dueDate)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Info
                      label="ผลการประเมิน"
                      value={
                        job.actionType ? actionLabels[job.actionType] : "-"
                      }
                      accent
                    />
                    <Info
                      label="ผู้ประเมิน"
                      value={personName(job.evaluator)}
                    />
                  </div>
                </div>
              </section>

              {(withdrawnParts.length > 0 || job.company) && (
                <section className="rounded-2xl border border-slate-200 p-5">
                  <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Package className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900">
                        ข้อมูลเฉพาะตามผลการประเมิน
                      </h3>
                      {job.company && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          บริษัทผู้รับซ่อม: {job.company.name}
                        </p>
                      )}
                    </div>
                  </div>

                  {withdrawnParts.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-slate-100">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-3 py-2 font-semibold">
                              รายการอะไหล่
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              จำนวน
                            </th>
                            <th className="px-3 py-2 text-right font-semibold">
                              มูลค่า
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {withdrawnParts.map((part) => (
                            <tr key={part.transactionId}>
                              <td className="px-3 py-2">
                                <strong className="block text-slate-800">
                                  {part.sparePartName}
                                </strong>
                                <span className="font-mono text-[10px] text-slate-400">
                                  {part.sparePartCode}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center text-slate-600">
                                {part.quantity}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600">
                                {(
                                  part.quantity * part.unitPrice
                                ).toLocaleString("th-TH")}{" "}
                                บาท
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      เลขที่เอกสาร/ใบเสนอราคา: {job.billNo || "-"}
                    </p>
                  )}
                </section>
              )}
            </div>
          </div>

          {job.confirmation && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
              <h3 className="font-bold text-emerald-900">
                ผลการส่งมอบและปิดงาน
              </h3>
              <div className="mt-3 grid gap-3 text-xs sm:grid-cols-4">
                <Info
                  label="วันที่ซ่อมเสร็จ"
                  value={job.confirmation.completedDate}
                />
                <Info label="ผู้รับมอบ" value={job.confirmation.receiverName} />
                <Info
                  label="รับประกันงานซ่อม"
                  value={`${job.confirmation.warrantyMonths} เดือน`}
                />
                <Info
                  label="ผู้บันทึก"
                  value={personName(job.confirmation.confirmedBy)}
                />
              </div>
              <p className="mt-3 text-xs leading-6 text-emerald-900">
                {job.confirmation.repairSummary}
              </p>
            </section>
          )}
        </div>

        <footer className="sticky bottom-0 flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4 sm:px-8">
          <p className="text-[11px] text-slate-400">
            ข้อมูลนี้เป็นประวัติ ณ เวลาที่บันทึกผลการประเมิน
          </p>
          <button
            type="button"
            onClick={closeModal}
            className="cursor-pointer rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            ปิดรายละเอียด
          </button>
        </footer>
      </div>
    </div>
  );
}

interface InfoProps {
  label: string;
  value?: string | number | null;
  className?: string;
  accent?: boolean;
  danger?: boolean;
}

function Info({ label, value, className = "", accent, danger }: InfoProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="mb-1 text-[11px] font-medium text-slate-400">{label}</p>
      <div
        className={`rounded-lg border px-3 py-2 leading-5 ${
          accent
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : danger
              ? "border-rose-100 bg-rose-50 text-rose-600"
              : "border-slate-100 bg-slate-50 text-slate-800"
        }`}
      >
        {value ?? "-"}
      </div>
    </div>
  );
}
