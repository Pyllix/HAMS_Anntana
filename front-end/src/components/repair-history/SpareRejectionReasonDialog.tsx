import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import type { RepairActionType } from "../../types/TypeRepairWorkflow";

export default function SpareRejectionReasonDialog({
  jobNo,
  reason,
  actionType,
  onClose,
}: {
  jobNo: string;
  reason: string;
  actionType?: RepairActionType | null;
  onClose: () => void;
}) {
  const isOutsource = actionType === "OUTSOURCE";
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="rejection-title" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-rose-50 p-3 text-rose-600"><AlertTriangle size={21} /></span><div><h2 id="rejection-title" className="font-bold text-slate-800">{isOutsource ? "ปฏิเสธการส่งซ่อมภายนอก" : "ปฏิเสธการขอเบิกอะไหล่"}</h2><p className="mt-1 text-xs text-slate-500">{jobNo}</p></div></div>
          <button type="button" onClick={onClose} aria-label="ปิดหน้าต่าง" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="px-6 py-5"><p className="text-xs font-semibold text-slate-500">เหตุผลจากเจ้าหน้าที่พัสดุ</p><p className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm leading-6 text-rose-800">{reason}</p><p className="mt-4 text-xs leading-5 text-slate-500">งานยังอยู่กับช่างคนเดิม กรุณากด “ประเมินใหม่” เพื่อปรับแผนและส่งคำขออีกครั้ง</p></div>
        <div className="flex justify-end border-t border-slate-100 px-6 py-4"><button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-900">ปิด</button></div>
      </div>
    </div>,
    document.body,
  );
}
