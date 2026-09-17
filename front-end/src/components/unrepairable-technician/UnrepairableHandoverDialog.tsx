import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TechnicianConfirmDialog from "./TechnicianConfirmDialog";
import { canHandOverUnrepairable, getTechnicianUnrepairableJob, handOverUnrepairable } from "../../services/unrepairableTechnicianService";
import { receiptError } from "../../services/unrepairableReceiptService";

export default function UnrepairableHandoverDialog({ jobId, onClose, onSuccess }: { jobId: string; onClose: () => void; onSuccess: () => void }) {
  const client = useQueryClient();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const query = useQuery({ queryKey: ["unrepairable-handover", jobId], queryFn: ({ signal }) => getTechnicianUnrepairableJob(jobId, signal), retry: false, cacheTime: 0 });
  const job = query.data;
  const allowed = !!job && canHandOverUnrepairable(job);
  async function confirm() {
    if (lock.current || !checked || !allowed || query.isFetching || query.isError) return;
    lock.current = true; setBusy(true); setError("");
    try { await handOverUnrepairable(jobId, note); }
    catch (cause) { setError(receiptError(cause)); setBusy(false); lock.current = false; void query.refetch(); return; }
    void client.invalidateQueries();
    onSuccess();
  }
  return <TechnicianConfirmDialog title="ยืนยันส่งคืนครุภัณฑ์ให้พัสดุ" busy={busy} disabled={!checked || !allowed || query.isFetching || query.isError} error={error} confirmLabel="ยืนยันส่งคืน" cancelLabel="ยกเลิก" onClose={onClose} onConfirm={confirm}>
    {query.isFetching && <p role="status" className="text-sm text-slate-500">กำลังตรวจสอบขั้นตอนล่าสุด…</p>}
    {query.isError && <p role="alert" className="text-sm text-red-600">{receiptError(query.error)}</p>}
    {job && <><div className="rounded-xl bg-slate-50 p-4 text-sm"><p className="font-semibold text-emerald-700">{job.jobNo} · {job.asset?.noid}</p><p className="mt-1 font-bold">{job.asset?.name}</p></div><div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">เหตุผลที่ไม่สามารถซ่อมได้</p><p className="mt-2 whitespace-pre-wrap break-words">{job.unrepairableReason || "ไม่ระบุ"}</p></div>{!allowed && <p role="alert" className="text-sm text-amber-700">งานนี้ไม่อยู่ในขั้นรอส่งคืน อาจมีการส่งคืนหรือปิดงานแล้ว</p>}</>}
    <label className="block text-sm font-semibold text-slate-700" htmlFor="technician-handover-note">หมายเหตุส่งคืน (ไม่บังคับ)<textarea id="technician-handover-note" rows={3} maxLength={2000} disabled={busy} value={note} onChange={(event) => setNote(event.target.value)} placeholder="เช่น นำส่งตัวเครื่องพร้อมสายไฟที่ห้องพัสดุแล้ว" className="mt-2 w-full rounded-lg border border-slate-200 p-3 font-normal outline-none focus:border-emerald-500" /></label>
    <label className="flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" disabled={busy} checked={checked} onChange={(event) => setChecked(event.target.checked)} className="mt-1 accent-emerald-600" />นำส่งครุภัณฑ์ชิ้นนี้ให้เจ้าหน้าที่พัสดุแล้ว</label>
    <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">เมื่อยืนยัน รายการจะไปยังหน้ารับคืนของพัสดุ ใบงานยังไม่ปิดจนกว่าเจ้าหน้าที่พัสดุจะตรวจรับ ไม่ใช่การขอซื้อเครื่องทดแทน</p>
  </TechnicianConfirmDialog>;
}
