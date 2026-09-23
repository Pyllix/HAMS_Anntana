import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import type { OutsourceApprovalRequest } from "../types/TypeOutsourceApproval";
import OutsourceApprovalDialog, {
  type OutsourceApprovalDialogMode,
} from "../components/outsource-approval/OutsourceApprovalDialog";
import OutsourceApprovalTable from "../components/outsource-approval/OutsourceApprovalTable";
import {
  getOutsourceApprovalRequests,
  outsourceApprovalError,
} from "../services/outsourceApprovalService";

const QUERY_KEY = ["outsource-approval-requests"];
const PAGE_SIZE = 5;

export default function OutsourceApprovals({ embedded = false }: { embedded?: boolean }) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<OutsourceApprovalRequest | null>(null);
  const [mode, setMode] = useState<OutsourceApprovalDialogMode>("DETAIL");
  const [success, setSuccess] = useState("");
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) => getOutsourceApprovalRequests(signal),
    retry: false,
  });
  const requests = query.data || [];

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return requests;
    return requests.filter((request) =>
      [
        request.requestNo,
        request.jobNo,
        request.assetCode,
        request.assetName,
        request.assetModel,
        request.requester,
        request.diagnosis,
      ].some((value) => value.toLocaleLowerCase().includes(term)),
    );
  }, [requests, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const firstPage = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
  const pages = Array.from(
    { length: Math.min(3, totalPages) },
    (_, index) => firstPage + index,
  );

  function open(
    request: OutsourceApprovalRequest,
    nextMode: OutsourceApprovalDialogMode,
  ) {
    setSelected(request);
    setMode(nextMode);
    setSuccess("");
  }

  async function completed(message: string) {
    setSelected(null);
    setSuccess(message);
    await Promise.all([
      client.invalidateQueries({ queryKey: QUERY_KEY }),
      client.invalidateQueries({ queryKey: ["repairHistory"] }),
    ]);
  }

  return (
    <section
      className={`flex flex-col bg-[#f8f9fb] text-slate-800 ${
        embedded
          ? "min-h-0 flex-1 px-0 py-0"
          : "min-h-[calc(100vh-120px)] px-4 py-6 lg:px-7"
      }`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">รายการขออนุมัติส่งซ่อมภายนอก</h2>
          <p className="mt-1 text-xs text-slate-500">
            ตรวจสอบงาน เลือกบริษัท และบันทึกเอกสารก่อนส่งครุภัณฑ์ออกซ่อม
          </p>
        </div>
        <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-white disabled:opacity-50"><RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} />รีเฟรช</button>
      </div>

      {success && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} />{success}</div>}

      <div className="mb-2 flex flex-wrap items-center gap-4 rounded-xl border border-slate-100 bg-white px-5 py-3">
        <label className="relative w-full sm:max-w-lg"><span className="sr-only">ค้นหาคำขอส่งซ่อมภายนอก</span><Search size={18} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="ค้นหาเลขคำขอ / เลขงาน / ครุภัณฑ์ / ชื่อช่าง" className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500" /></label>
      </div>

      <div className="min-h-[380px] flex-1 overflow-hidden rounded-b-xl bg-white">
        {query.isError ? (
          <div role="alert" className="m-6 rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700"><p>{outsourceApprovalError(query.error)}</p><button type="button" onClick={() => void query.refetch()} className="mt-3 font-semibold underline">ลองโหลดอีกครั้ง</button></div>
        ) : query.isLoading ? (
          <div role="status" className="flex justify-center gap-2 py-24 text-sm text-slate-500"><Loader2 size={20} className="animate-spin" />กำลังโหลดคำขอส่งซ่อมภายนอก…</div>
        ) : (
          <>
            <OutsourceApprovalTable rows={visible} onDetail={(request) => open(request, "DETAIL")} onApprove={(request) => open(request, "APPROVE")} onReject={(request) => open(request, "REJECT")} />
            {visible.length === 0 && <div className="flex flex-col items-center px-5 py-20 text-center text-slate-400"><Truck size={44} strokeWidth={1.3} /><p className="mt-4 font-semibold text-slate-600">{search ? "ไม่พบรายการที่ตรงกับการค้นหา" : "ยังไม่มีคำขอส่งซ่อมภายนอกรออนุมัติ"}</p><p className="mt-2 text-xs">รายการจะปรากฏเมื่อช่างบันทึกผลประเมินเป็น “ส่งซ่อมภายนอก”</p></div>}
          </>
        )}
      </div>

      {!query.isError && !query.isLoading && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><p>แสดง {filtered.length ? start + 1 : 0} ถึง {Math.min(start + PAGE_SIZE, filtered.length)} จาก {filtered.length.toLocaleString("th-TH")} รายการ</p><nav aria-label="หน้ารายการอนุมัติส่งซ่อมภายนอก" className="flex gap-2"><button type="button" aria-label="หน้าก่อนหน้า" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40"><ChevronLeft size={16} /></button>{pages.map((number) => <button type="button" key={number} aria-current={number === currentPage ? "page" : undefined} onClick={() => setPage(number)} className={`min-w-9 rounded-lg border px-3 py-2 ${number === currentPage ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white"}`}>{number}</button>)}<button type="button" aria-label="หน้าถัดไป" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40"><ChevronRight size={16} /></button></nav></div>}

      {selected && <OutsourceApprovalDialog key={`${selected.id}-${mode}`} request={selected} mode={mode} onClose={() => setSelected(null)} onSuccess={(message) => void completed(message)} />}
    </section>
  );
}
