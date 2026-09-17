import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, Loader2, PackageCheck, X } from "lucide-react";
import type { SpareApprovalRequest } from "../../Types/TypeSpareApproval";
import {
  approveSpareRequest,
  rejectSpareRequest,
  spareApprovalError,
} from "../../services/spareApprovalService";

export type SpareApprovalDialogMode = "DETAIL" | "APPROVE" | "REJECT";

export default function SpareApprovalDialog({
  request,
  mode,
  onClose,
  onSuccess,
}: {
  request: SpareApprovalRequest;
  mode: SpareApprovalDialogMode;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "DETAIL" || inFlight.current || !confirmed) return;
    if (mode === "REJECT" && !reason.trim()) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      if (mode === "APPROVE") {
        await approveSpareRequest(request.id, { note });
        onSuccess(`อนุมัติ ${request.requestNo} เรียบร้อยแล้ว`);
      } else {
        await rejectSpareRequest(request.id, { reason });
        onSuccess(`ปฏิเสธ ${request.requestNo} และส่งเหตุผลกลับแล้ว`);
      }
    } catch (cause) {
      setError(spareApprovalError(cause));
      setSaving(false);
      inFlight.current = false;
    }
  }

  const title =
    mode === "APPROVE"
      ? "ยืนยันอนุมัติการเบิกอะไหล่"
      : mode === "REJECT"
        ? "ปฏิเสธการขอเบิกอะไหล่"
        : "รายละเอียดคำขอเบิกอะไหล่";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spare-approval-title"
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !saving) onClose();
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className={`rounded-xl p-3 ${mode === "REJECT" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
              {mode === "REJECT" ? <AlertTriangle size={22} /> : <PackageCheck size={22} />}
            </span>
            <div>
              <h2 id="spare-approval-title" className="text-lg font-bold text-slate-800">{title}</h2>
              <p className="mt-1 text-xs text-slate-500">{request.requestNo} · {request.jobNo}</p>
            </div>
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="ปิดหน้าต่าง" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40"><X size={20} /></button>
        </div>

        <form onSubmit={submit}>
          <div className="space-y-5 px-6 py-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-emerald-700">{request.assetCode}</p>
              <h3 className="mt-1 font-bold text-slate-800">{request.assetName}</h3>
              <p className="mt-1 text-xs text-slate-500">{request.assetModel}</p>
            </div>

            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">เลขที่ใบงานซ่อม</dt><dd className="mt-1 font-semibold text-sky-600">{request.jobNo}</dd></div>
              <div><dt className="text-xs text-slate-500">ผู้ขอเบิก</dt><dd className="mt-1 font-medium">{request.requester}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">ผลการวินิจฉัย</dt><dd className="mt-1 whitespace-pre-wrap">{request.diagnosis}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">แนวทางดำเนินการ</dt><dd className="mt-1 whitespace-pre-wrap">{request.solution}</dd></div>
            </dl>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3">รายการอะไหล่</th><th className="px-3 py-3 text-center">แหล่ง</th><th className="px-3 py-3 text-center">จำนวน</th><th className="px-4 py-3 text-right">ราคา/หน่วย</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {request.parts.map((part) => <tr key={part.id}><td className="px-4 py-3"><p className="font-semibold text-slate-800">{part.name}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{part.code}</p></td><td className="px-3 py-3 text-center"><span className={`rounded-full px-2 py-1 font-semibold ${part.source === "INTERNAL" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{part.source === "INTERNAL" ? "ในคลัง" : "ภายนอก"}</span></td><td className="px-3 py-3 text-center">{part.quantity} {part.unit || "ชิ้น"}</td><td className="px-4 py-3 text-right font-mono">{part.unitPrice.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</td></tr>)}
                </tbody>
              </table>
            </div>

            {mode === "APPROVE" && <label className="block text-sm font-semibold text-slate-700" htmlFor="approval-note">หมายเหตุการอนุมัติ <span className="font-normal text-slate-400">(ไม่บังคับ)</span><textarea id="approval-note" rows={3} value={note} disabled={saving} onChange={(event) => setNote(event.target.value)} placeholder="เช่น ตรวจสอบจำนวนและรายการเรียบร้อยแล้ว" className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>}

            {mode === "REJECT" && <label className="block text-sm font-semibold text-slate-700" htmlFor="rejection-reason">เหตุผลที่ปฏิเสธ <span className="text-rose-500">*</span><textarea id="rejection-reason" required rows={4} value={reason} disabled={saving} onChange={(event) => setReason(event.target.value)} placeholder="ระบุเหตุผลเพื่อให้ช่างและหัวหน้าช่างตรวจสอบ" className="mt-2 w-full resize-y rounded-lg border border-rose-200 px-3 py-2.5 font-normal outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100" /></label>}

            {mode !== "DETAIL" && <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><input type="checkbox" checked={confirmed} disabled={saving} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />{mode === "APPROVE" ? "ตรวจสอบรายการและยืนยันอนุมัติการเบิกอะไหล่" : "ยืนยันการปฏิเสธและส่งเหตุผลกลับไปยังงานซ่อม"}</label>}
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </div>

          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
            <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-600 disabled:opacity-40">{mode === "DETAIL" ? "ปิด" : "ยกเลิก"}</button>
            {mode !== "DETAIL" && <button type="submit" disabled={saving || !confirmed || (mode === "REJECT" && !reason.trim())} className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${mode === "REJECT" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>{saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}{saving ? "กำลังบันทึก…" : mode === "REJECT" ? "ยืนยันปฏิเสธ" : "ยืนยันอนุมัติ"}</button>}
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
