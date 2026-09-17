import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";

export default function TechnicianConfirmDialog({ title, children, busy, disabled, error, confirmLabel, cancelLabel = "กลับไปแก้ไข", onClose, onConfirm }: {
  title: string; children: ReactNode; busy: boolean; disabled?: boolean; error?: string;
  confirmLabel: string; cancelLabel?: string; onClose: () => void; onConfirm: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return createPortal(<div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="technician-confirm-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none" onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) { event.stopPropagation(); onClose(); }
      if (event.key === "Tab") {
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)') || []);
        const first = items[0], last = items[items.length - 1];
        if (!items.length) event.preventDefault();
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><h2 id="technician-confirm-title" className="text-lg font-bold text-slate-800">{title}</h2><button type="button" aria-label="ปิดหน้าต่าง" disabled={busy} onClick={onClose} className="rounded-lg p-1 text-slate-400 disabled:opacity-40"><X size={20} /></button></header>
      <div className="space-y-4 px-6 py-5">{children}{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</div>
      <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 disabled:opacity-40">{cancelLabel}</button><button type="button" disabled={busy || disabled} onClick={onConfirm} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">{busy && <Loader2 size={16} className="animate-spin" />}{busy ? "กำลังบันทึก…" : confirmLabel}</button></footer>
    </div>
  </div>, document.body);
}
