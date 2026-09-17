import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2, PackageCheck, X } from "lucide-react";
import type { UnrepairableReceipt } from "../../Types/TypeUnrepairableReceipt";
import { confirmUnrepairableReceipt, getUnrepairableReceipt, receiptError } from "../../services/unrepairableReceiptService";
import { receiptDate } from "../../services/unrepairableReceiptMapper";
import { ReceiptAssetImage } from "./UnrepairableReceiptTable";

export default function ConfirmUnrepairableReceiptDialog({ selected, onClose, onSuccess }: {
  selected: UnrepairableReceipt;
  onClose: () => void;
  onSuccess: (job: UnrepairableReceipt) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const [storageLocation, setStorageLocation] = useState("");
  const [note, setNote] = useState("");
  const [received, setReceived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const detail = useQuery({ queryKey: ["unrepairable-receipt", selected.id], queryFn: ({ signal }) => getUnrepairableReceipt(selected.id, signal), retry: false, cacheTime: 0 });
  const job = detail.data || selected;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !received || !storageLocation.trim() || !detail.data || detail.isFetching || detail.isError) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      await confirmUnrepairableReceipt(job.id, { storageLocation, note });
    } catch (cause) {
      setError(receiptError(cause));
      setSaving(false);
      inFlight.current = false;
      void detail.refetch();
      return;
    }
    onSuccess(job);
  }

  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="receipt-dialog-title" tabIndex={-1}
      className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !inFlight.current) { event.stopPropagation(); onClose(); }
        if (event.key === "Tab") {
          const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []);
          const first = items[0]; const last = items[items.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><PackageCheck size={24} /></span><div><h2 id="receipt-dialog-title" className="text-lg font-bold text-slate-800">ยืนยันรับคืนครุภัณฑ์</h2><p className="mt-1 text-xs text-slate-500">รับคืนจากช่าง · ไม่สามารถซ่อมได้</p></div></div>
        <button type="button" disabled={saving} onClick={onClose} aria-label="ปิดหน้าต่าง" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40"><X size={21} /></button>
      </div>
      <form onSubmit={submit}>
        <div className="space-y-5 px-6 py-5">
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><ReceiptAssetImage src={job.imageUrl} /><div><p className="text-xs font-semibold text-emerald-700">{job.assetCode}</p><h3 className="mt-1 font-bold text-slate-800">{job.assetName}</h3><p className="mt-1 text-xs text-slate-500">{job.model} · S/N: {job.serialNo}</p></div></div>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-slate-500">เลขที่ใบงานซ่อม</dt><dd className="mt-1 font-medium text-sky-600">{job.jobNo}</dd></div>
            <div><dt className="text-xs text-slate-500">วันที่ส่งคืน</dt><dd className="mt-1">{receiptDate(job.sentAt)} · {receiptDate(job.sentAt, true)} น.</dd></div>
            <div><dt className="text-xs text-slate-500">ช่างผู้ส่งคืน</dt><dd className="mt-1">{job.sender}</dd></div>
            <div><dt className="text-xs text-slate-500">หมวดหมู่ครุภัณฑ์</dt><dd className="mt-1">{job.category}</dd></div>
          </dl>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><AlertTriangle size={17} />เหตุผลที่ไม่สามารถซ่อมได้</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-amber-900">{job.reason}</p></div>
          <details className="text-sm text-slate-600"><summary className="cursor-pointer font-medium">ผลการประเมินและหมายเหตุส่งคืน</summary><p className="mt-2 whitespace-pre-wrap break-words">ผลการประเมิน: {job.diagnosis}</p><p className="mt-2 whitespace-pre-wrap break-words">หมายเหตุส่งคืน: {job.handoverNote}</p></details>
          {detail.isFetching && <p role="status" className="text-sm text-slate-500">กำลังตรวจสอบสถานะล่าสุด…</p>}
          {detail.isError && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{receiptError(detail.error)} <button type="button" onClick={() => void detail.refetch()} className="underline">ตรวจสอบอีกครั้ง</button></div>}
          <label className="block text-sm font-semibold text-slate-700" htmlFor="receipt-location">สถานที่เก็บรอจำหน่าย <span className="text-red-500">*</span><input id="receipt-location" required maxLength={250} disabled={saving} value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} placeholder="เช่น ห้องพักครุภัณฑ์รอจำหน่าย อาคาร A" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="receipt-note">หมายเหตุการตรวจรับ <span className="font-normal text-slate-400">(ไม่บังคับ)</span><textarea id="receipt-note" maxLength={2000} disabled={saving} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="สภาพครุภัณฑ์หรืออุปกรณ์ที่ได้รับคืน" className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={received} required disabled={saving} onChange={(event) => setReceived(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />ตรวจสอบและได้รับครุภัณฑ์ชิ้นนี้แล้ว</label>
          <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">เมื่อยืนยัน ระบบจะปิดใบงานซ่อมและเปลี่ยนครุภัณฑ์เป็น “รอจำหน่าย” และ “ไม่พร้อมใช้งาน” ไม่ใช่การยืนยันว่าซ่อมสำเร็จ</p>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-600 disabled:opacity-40">ยกเลิก</button>
          <button type="submit" disabled={saving || !received || !storageLocation.trim() || !detail.data || detail.isFetching || detail.isError} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">{saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}{saving ? "กำลังบันทึก…" : "ยืนยันรับคืน"}</button>
        </div>
      </form>
    </div>
  </div>, document.body);
}
