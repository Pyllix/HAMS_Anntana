import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { AlertTriangle, Building2, Check, Loader2, Truck, X } from "lucide-react";
import type { OutsourceApprovalRequest } from "../../Types/TypeOutsourceApproval";
import { getCompanies } from "../../services/companyService";
import {
  approveOutsourceRequest,
  outsourceApprovalError,
  rejectOutsourceRequest,
} from "../../services/outsourceApprovalService";

export type OutsourceApprovalDialogMode = "DETAIL" | "APPROVE" | "REJECT";

export default function OutsourceApprovalDialog({
  request,
  mode,
  onClose,
  onSuccess,
}: {
  request: OutsourceApprovalRequest;
  mode: OutsourceApprovalDialogMode;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const [companyId, setCompanyId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const companies = useQuery({
    queryKey: ["companies", "outsource-approval"],
    queryFn: getCompanies,
    enabled: mode === "APPROVE",
    retry: false,
  });

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

    const parsedCost = Number(repairCost);
    if (
      mode === "APPROVE" &&
      (!companyId || !billNo.trim() || repairCost === "" || !Number.isFinite(parsedCost) || parsedCost < 0)
    ) {
      setError("กรุณากรอกบริษัท เลขที่เอกสาร และค่าซ่อมให้ครบถ้วน");
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      if (mode === "APPROVE") {
        await approveOutsourceRequest(request.id, {
          companyId,
          billNo,
          repairCost: parsedCost,
          note,
        });
        onSuccess(`อนุมัติ ${request.requestNo} และส่งงานไปบริษัทภายนอกแล้ว`);
      } else {
        await rejectOutsourceRequest(request.id, { reason });
        onSuccess(`ปฏิเสธ ${request.requestNo} และส่งเหตุผลกลับให้ช่างแล้ว`);
      }
    } catch (cause) {
      setError(outsourceApprovalError(cause));
      setSaving(false);
      inFlight.current = false;
    }
  }

  const title =
    mode === "APPROVE"
      ? "ยืนยันอนุมัติส่งซ่อมภายนอก"
      : mode === "REJECT"
        ? "ปฏิเสธการส่งซ่อมภายนอก"
        : "รายละเอียดคำขอส่งซ่อมภายนอก";
  const availableCompanies = (companies.data || []).filter(
    (company) => !company.deletedAt && company.isActive !== false,
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="outsource-approval-title"
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !saving) onClose();
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className={`rounded-xl p-3 ${mode === "REJECT" ? "bg-rose-50 text-rose-600" : "bg-violet-50 text-violet-600"}`}>
              {mode === "REJECT" ? <AlertTriangle size={22} /> : <Truck size={22} />}
            </span>
            <div>
              <h2 id="outsource-approval-title" className="text-lg font-bold text-slate-800">{title}</h2>
              <p className="mt-1 text-xs text-slate-500">{request.requestNo} · {request.jobNo}</p>
            </div>
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="ปิดหน้าต่าง" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40"><X size={20} /></button>
        </div>

        <form onSubmit={submit}>
          <div className="space-y-5 px-6 py-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-violet-700">{request.assetCode}</p>
              <h3 className="mt-1 font-bold text-slate-800">{request.assetName}</h3>
              <p className="mt-1 text-xs text-slate-500">{request.assetModel} · S/N {request.serialNumber}</p>
            </div>

            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">เลขที่ใบงานซ่อม</dt><dd className="mt-1 font-semibold text-sky-600">{request.jobNo}</dd></div>
              <div><dt className="text-xs text-slate-500">ช่างผู้ขอส่งซ่อม</dt><dd className="mt-1 font-medium">{request.requester}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">อาการที่แจ้ง</dt><dd className="mt-1 whitespace-pre-wrap">{request.symptom}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">ผลการวินิจฉัย</dt><dd className="mt-1 whitespace-pre-wrap">{request.diagnosis}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">แนวทางดำเนินการ</dt><dd className="mt-1 whitespace-pre-wrap">{request.solution}</dd></div>
            </dl>

            {mode === "APPROVE" && (
              <section className="space-y-4 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Building2 size={17} className="text-violet-600" />ข้อมูลการจัดส่งซ่อมภายนอก</div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="outsource-company">บริษัทที่รับซ่อม <span className="text-rose-500">*</span>
                  <select id="outsource-company" required value={companyId} disabled={saving || companies.isLoading} onChange={(event) => setCompanyId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
                    <option value="">{companies.isLoading ? "กำลังโหลดรายชื่อบริษัท…" : "เลือกบริษัทที่รับซ่อม"}</option>
                    {availableCompanies.map((company) => <option key={company.id} value={String(company.id)}>{company.code ? `${company.code} · ` : ""}{company.name}</option>)}
                  </select>
                </label>
                {companies.isError && <p className="text-xs text-rose-600">ไม่สามารถโหลดรายชื่อบริษัทได้ กรุณาปิดหน้าต่างแล้วลองใหม่</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="outsource-bill">เลขที่ใบสั่งจ้าง / เอกสารอ้างอิง <span className="text-rose-500">*</span><input id="outsource-bill" required value={billNo} disabled={saving} onChange={(event) => setBillNo(event.target.value)} placeholder="เช่น PO-2026-001" className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" /></label>
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="outsource-cost">ค่าซ่อมตามเอกสาร (บาท) <span className="text-rose-500">*</span><input id="outsource-cost" required type="number" min="0" step="0.01" value={repairCost} disabled={saving} onChange={(event) => setRepairCost(event.target.value)} placeholder="0.00" className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-right font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" /></label>
                </div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="outsource-note">หมายเหตุการอนุมัติ <span className="font-normal text-slate-400">(ไม่บังคับ)</span><textarea id="outsource-note" rows={3} value={note} disabled={saving} onChange={(event) => setNote(event.target.value)} placeholder="เช่น ตรวจสอบใบเสนอราคาและเงื่อนไขเรียบร้อยแล้ว" className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" /></label>
              </section>
            )}

            {mode === "REJECT" && <label className="block text-sm font-semibold text-slate-700" htmlFor="outsource-rejection-reason">เหตุผลที่ปฏิเสธ <span className="text-rose-500">*</span><textarea id="outsource-rejection-reason" required rows={4} value={reason} disabled={saving} onChange={(event) => setReason(event.target.value)} placeholder="ระบุเหตุผลเพื่อให้ช่างคนเดิมประเมินและวางแผนใหม่" className="mt-2 w-full resize-y rounded-lg border border-rose-200 px-3 py-2.5 font-normal outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100" /></label>}

            {mode !== "DETAIL" && <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><input type="checkbox" checked={confirmed} disabled={saving} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />{mode === "APPROVE" ? "ตรวจสอบข้อมูลบริษัท เอกสาร และค่าซ่อมแล้ว ยืนยันส่งซ่อมภายนอก" : "ยืนยันการปฏิเสธและส่งเหตุผลกลับให้ช่างคนเดิมประเมินใหม่"}</label>}
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </div>

          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
            <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-600 disabled:opacity-40">{mode === "DETAIL" ? "ปิด" : "ยกเลิก"}</button>
            {mode !== "DETAIL" && <button type="submit" disabled={saving || !confirmed || (mode === "REJECT" && !reason.trim()) || (mode === "APPROVE" && (companies.isLoading || companies.isError))} className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${mode === "REJECT" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>{saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}{saving ? "กำลังบันทึก…" : mode === "REJECT" ? "ยืนยันปฏิเสธ" : "ยืนยันอนุมัติ"}</button>}
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
