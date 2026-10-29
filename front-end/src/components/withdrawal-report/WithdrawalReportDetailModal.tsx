import { useEffect } from "react";
import { Package, Wrench, X } from "lucide-react";
import type {
  SparePartStockType,
  SparePartTransaction,
  SparePartTxnType,
} from "../../types/TypeSparePartTransaction";

function formatDateTimeTH(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const txnTypeLabel: Record<SparePartTxnType, string> = {
  WITHDRAW: "เบิกอะไหล่",
  RETURN: "คืนอะไหล่",
  PENDING_WITHDRAW: "รอเบิก",
};

const txnTypeStyle: Record<SparePartTxnType, string> = {
  WITHDRAW: "bg-blue-50 text-blue-700",
  RETURN: "bg-emerald-50 text-emerald-700",
  PENDING_WITHDRAW: "bg-amber-50 text-amber-700",
};

const stockTypeLabel: Record<Exclude<SparePartStockType, null>, string> = {
  INTERNAL: "คลังภายใน",
  EXTERNAL: "จัดหาภายนอก",
};

interface WithdrawalReportDetailModalProps {
  transaction: SparePartTransaction | null;
  onClose: () => void;
}

export default function WithdrawalReportDetailModal({
  transaction,
  onClose,
}: WithdrawalReportDetailModalProps) {
  useEffect(() => {
    if (!transaction) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [transaction, onClose]);

  if (!transaction) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5 sm:px-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              รายละเอียดรายการเบิกอะไหล่
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              ข้อมูล transaction ที่บันทึกไว้ ไม่สามารถแก้ไขจากหน้านี้
            </p>
          </div>
          <button
            type="button"
            aria-label="ปิดรายละเอียด"
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5 px-6 py-5 sm:px-8">
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="font-mono text-xs font-bold text-blue-600">
                #{transaction.id}
              </p>
              <h3 className="mt-1 text-base font-bold text-slate-900">
                {transaction.sparepart.name}
              </h3>
              <p className="mt-0.5 font-mono text-xs text-slate-400">
                {transaction.sparepart.code}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${txnTypeStyle[transaction.txnType]}`}
            >
              <span className="h-2 w-2 rounded-full bg-current opacity-70" />
              {txnTypeLabel[transaction.txnType]}
            </span>
          </section>

          <section className="rounded-2xl border border-slate-200 p-5">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Package className="h-5 w-5" />
              </span>
              <h3 className="font-bold text-slate-900">ข้อมูลอะไหล่และจำนวน</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Info label="รหัสอะไหล่" value={transaction.sparepart.code} />
              <Info label="ชื่ออะไหล่" value={transaction.sparepart.name} />
              <Info
                label="จำนวน"
                value={`${transaction.qty} ${transaction.sparepart.unit}`}
                accent
              />
              <Info
                label="แหล่งอะไหล่"
                value={
                  transaction.stockType
                    ? stockTypeLabel[transaction.stockType]
                    : "ไม่ระบุ"
                }
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-5">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Wrench className="h-5 w-5" />
              </span>
              <h3 className="font-bold text-slate-900">
                ข้อมูลการบันทึกและงานซ่อม
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Info
                label="ประเภทรายการ"
                value={txnTypeLabel[transaction.txnType]}
              />
              <Info
                label="วันที่/เวลา"
                value={formatDateTimeTH(transaction.txnDate)}
              />
              <Info
                label="รหัสงานซ่อม"
                value={transaction.repairJob?.jobNo ?? "ไม่มีงานซ่อมอ้างอิง"}
              />
              <Info
                label="ผู้บันทึก"
                value={transaction.recordedBy?.name ?? "-"}
              />
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-400">
              หมายเหตุ: ผู้บันทึกคือบัญชีที่บันทึก/ยืนยันรายการสต็อก
              ไม่ใช่ผู้ขอเบิกหรือผู้คืนของจริง
            </p>
          </section>
        </div>

        <footer className="sticky bottom-0 flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4 sm:px-8">
          <p className="text-[11px] text-slate-400">
            ข้อมูลนี้เป็นประวัติ ณ เวลาที่บันทึกรายการ
          </p>
          <button
            type="button"
            onClick={onClose}
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
}

function Info({ label, value, className = "", accent }: InfoProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="mb-1 text-[11px] font-medium text-slate-400">{label}</p>
      <div
        className={`rounded-lg border px-3 py-2 leading-5 ${
          accent
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-100 bg-slate-50 text-slate-800"
        }`}
      >
        {value ?? "-"}
      </div>
    </div>
  );
}
