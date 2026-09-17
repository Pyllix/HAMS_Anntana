import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { useConfirmRepairModalStore } from "../../stores/useConfirmRepairModalStore";
import { RepairConfirmationDto } from "../../Types/TypeRepairWorkflow";
import {
  confirmRepair,
  getRepairReceivers,
} from "../../services/confirmRepairService";

function localDateString(): string {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

export default function ConfirmRepairDialog() {
  const queryClient = useQueryClient();
  const { isOpen, selectedJob: job, closeModal } = useConfirmRepairModalStore();
  const [completedDate, setCompletedDate] = useState(localDateString());
  const [receiverId, setReceiverId] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState(6);
  const [repairSummary, setRepairSummary] = useState("");
  const [validationError, setValidationError] = useState("");

  const { data: receiverOptions = [] } = useQuery({
    queryKey: ["repairReceivers", job?.sectionId, job?.reporterId],
    queryFn: () => (job ? getRepairReceivers(job) : Promise.resolve([])),
    enabled: isOpen && Boolean(job),
  });

  useEffect(() => {
    if (!isOpen || !job) return;
    setCompletedDate(job.confirmation?.completedDate || localDateString());
    setReceiverId(job.confirmation?.receiverId || job.reporter?.userId || "");
    setWarrantyMonths(job.confirmation?.warrantyMonths ?? 6);
    setRepairSummary(job.confirmation?.repairSummary || job.solution || "");
    setValidationError("");
  }, [isOpen, job]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeModal]);

  const mutation = useMutation({
    mutationFn: (dto: RepairConfirmationDto) => confirmRepair(dto),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["repairConfirmations"] }),
        queryClient.invalidateQueries({ queryKey: ["repairHistory"] }),
      ]);
      closeModal();
    },
  });

  if (!isOpen || !job) return null;

  const availableReceivers =
    receiverOptions.length > 0
      ? receiverOptions
      : job.reporter
        ? [job.reporter]
        : [];
  const selectedReceiver = availableReceivers.find(
    (receiver) => receiver.userId === receiverId,
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!completedDate) {
      setValidationError("กรุณาระบุวันที่ซ่อมเสร็จ");
      return;
    }
    if (!receiverId || !selectedReceiver) {
      setValidationError("กรุณาเลือกผู้รับมอบครุภัณฑ์");
      return;
    }
    if (!repairSummary.trim()) {
      setValidationError("กรุณาระบุรายละเอียดการซ่อมหรืออะไหล่ที่เปลี่ยน");
      return;
    }

    setValidationError("");
    mutation.mutate({
      jobId: job.jobId,
      completedDate,
      receiverId,
      receiverName: `${selectedReceiver.firstName} ${selectedReceiver.lastName}`,
      warrantyMonths,
      repairSummary: repairSummary.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !mutation.isLoading) {
          closeModal();
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-5 sm:px-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              ตรวจรับและปิดงานซ่อม
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              หน่วยงานเจ้าของครุภัณฑ์ตรวจรับก่อนบันทึกปิดงาน
            </p>
          </div>
          <button
            type="button"
            aria-label="ปิดหน้าต่าง"
            disabled={mutation.isLoading}
            onClick={closeModal}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-wait"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[0.95fr_1.1fr]">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
            <h3 className="text-sm font-bold text-slate-900">
              ข้อมูลการแจ้งซ่อม
            </h3>
            <div className="mt-5 space-y-5">
              <ReadOnlyInfo label="เลขที่ใบแจ้งซ่อม" value={job.jobNo} strong />
              <ReadOnlyInfo
                label="ครุภัณฑ์ที่ชำรุด"
                value={job.asset?.assetName || "-"}
                secondary={`หมายเลขเครื่อง (Serial No.): ${job.asset?.serialNumber || "-"}`}
                strong
              />
              <ReadOnlyInfo label="อาการที่พบ" value={job.symptom} danger />
              <ReadOnlyInfo
                label="ผู้แจ้งซ่อม"
                value={
                  job.reporter
                    ? `${job.reporter.firstName} ${job.reporter.lastName}`
                    : "-"
                }
                secondary={`วันที่แจ้ง: ${new Intl.DateTimeFormat("th-TH", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(job.createdAt))}`}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              ระบุรายละเอียดผลการซ่อม
            </h3>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                วันที่ซ่อมเสร็จ <span className="text-rose-500">*</span>
              </span>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={completedDate}
                  max={localDateString()}
                  onChange={(event) => setCompletedDate(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                ผู้รับมอบครุภัณฑ์ <span className="text-rose-500">*</span>
              </span>
              <div className="relative">
                <select
                  value={receiverId}
                  onChange={(event) => setReceiverId(event.target.value)}
                  className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">เลือกผู้รับมอบ</option>
                  {availableReceivers.map((receiver) => (
                    <option key={receiver.userId} value={receiver.userId}>
                      {receiver.firstName} {receiver.lastName} ·{" "}
                      {receiver.sectionName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </label>

            <label className="block max-w-[220px]">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                ระยะเวลารับประกันงานซ่อม
              </span>
              <div className="relative">
                <select
                  value={warrantyMonths}
                  onChange={(event) =>
                    setWarrantyMonths(Number(event.target.value))
                  }
                  className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value={0}>ไม่มีประกัน</option>
                  <option value={3}>3 เดือน</option>
                  <option value={6}>6 เดือน</option>
                  <option value={12}>12 เดือน</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                รายละเอียดการซ่อม / อะไหล่ที่เปลี่ยน{" "}
                <span className="text-rose-500">*</span>
              </span>
              <textarea
                rows={4}
                value={repairSummary}
                placeholder="ระบุวิธีดำเนินการ ผลการทดสอบ และอะไหล่ที่เปลี่ยน..."
                onChange={(event) => setRepairSummary(event.target.value)}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </label>

            {(validationError || mutation.isError) && (
              <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {validationError ||
                  (mutation.error instanceof Error
                    ? mutation.error.message
                    : "ไม่สามารถบันทึกผลการซ่อมได้")}
              </div>
            )}
          </section>
        </div>

        <footer className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 sm:px-8">
          <button
            type="button"
            disabled={mutation.isLoading}
            onClick={closeModal}
            className="h-10 cursor-pointer rounded-lg bg-slate-100 px-6 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-wait"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={mutation.isLoading}
            className="h-10 cursor-pointer rounded-lg bg-emerald-600 px-6 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            {mutation.isLoading ? "กำลังบันทึก..." : "บันทึกตรวจรับ"}
          </button>
        </footer>
      </form>
    </div>
  );
}

interface ReadOnlyInfoProps {
  label: string;
  value: string;
  secondary?: string;
  strong?: boolean;
  danger?: boolean;
}

function ReadOnlyInfo({
  label,
  value,
  secondary,
  strong,
  danger,
}: ReadOnlyInfoProps) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p
        className={`mt-1 text-sm ${
          danger
            ? "font-medium text-rose-500"
            : strong
              ? "font-bold text-slate-900"
              : "text-slate-700"
        }`}
      >
        {value}
      </p>
      {secondary && (
        <p className="mt-1 text-xs leading-5 text-slate-500">{secondary}</p>
      )}
    </div>
  );
}
