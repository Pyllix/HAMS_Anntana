import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, PackageCheck, RefreshCw, Search } from "lucide-react";
import type { SpareApprovalRequest } from "../Types/TypeSpareApproval";
import SpareApprovalTable from "../components/spare-approval/SpareApprovalTable";
import SpareApprovalDialog, { type SpareApprovalDialogMode } from "../components/spare-approval/SpareApprovalDialog";
import { getSpareApprovalRequests, spareApprovalError } from "../services/spareApprovalService";

const QUERY_KEY = ["spare-approval-requests"];
const PAGE_SIZE = 5;

export default function SparePartApprovals({ embedded = false }: { embedded?: boolean }) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SpareApprovalRequest | null>(null);
  const [mode, setMode] = useState<SpareApprovalDialogMode>("DETAIL");
  const [success, setSuccess] = useState("");
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: ({ signal }) => getSpareApprovalRequests(signal), retry: false });
  const requests = query.data || [];

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return requests.filter((request) => {
      const matchesTerm = !term || [request.requestNo, request.jobNo, request.assetCode, request.assetName, request.requester, ...request.parts.flatMap((part) => [part.code, part.name])].some((value) => value.toLocaleLowerCase().includes(term));
      const hasInternal = request.parts.some((part) => part.source === "INTERNAL");
      const hasExternal = request.parts.some((part) => part.source === "EXTERNAL");
      const matchesSource = source === "ALL" || (source === "INTERNAL" && hasInternal && !hasExternal) || (source === "EXTERNAL" && hasExternal && !hasInternal) || (source === "MIXED" && hasInternal && hasExternal);
      return matchesTerm && matchesSource;
    });
  }, [requests, search, source]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const pageNumbers = Array.from({ length: Math.min(3, totalPages) }, (_, index) => Math.max(1, Math.min(currentPage - 1, totalPages - 2)) + index);

  function open(request: SpareApprovalRequest, nextMode: SpareApprovalDialogMode) {
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
    <section className={`flex flex-col bg-[#f8f9fb] text-slate-800 ${embedded ? "min-h-0 flex-1 px-0 py-0" : "min-h-[calc(100vh-120px)] px-4 py-6 lg:px-7"}`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">รายการขออนุมัติการเบิกอะไหล่</h2>
        <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-white disabled:opacity-50"><RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} />รีเฟรช</button>
      </div>
      {success && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} />{success}</div>}
      <div className="mb-2 flex flex-wrap items-center gap-4 rounded-xl border border-slate-100 bg-white px-5 py-3">
        <label className="relative w-full sm:max-w-sm"><span className="sr-only">ค้นหาคำขอเบิกอะไหล่</span><Search size={18} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="ค้นหารหัส / ชื่ออะไหล่ / เลขงานซ่อม" className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500" /></label>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-500">ประเภท:<select aria-label="ประเภทแหล่งอะไหล่" value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }} className="bg-white font-semibold text-emerald-700 outline-none"><option value="ALL">ทั้งหมด</option><option value="INTERNAL">ในคลัง</option><option value="EXTERNAL">ภายนอก</option><option value="MIXED">แบบผสม</option></select></label>
      </div>
      <div className="min-h-[380px] flex-1 overflow-hidden rounded-b-xl bg-white">
        {query.isError ? <div role="alert" className="m-6 rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700"><p>{spareApprovalError(query.error)}</p><button type="button" onClick={() => void query.refetch()} className="mt-3 font-semibold underline">ลองโหลดอีกครั้ง</button></div>
          : query.isLoading ? <div role="status" className="flex justify-center gap-2 py-24 text-sm text-slate-500"><Loader2 size={20} className="animate-spin" />กำลังโหลดคำขอเบิกอะไหล่…</div>
            : <><SpareApprovalTable rows={visible} onDetail={(request) => open(request, "DETAIL")} onApprove={(request) => open(request, "APPROVE")} onReject={(request) => open(request, "REJECT")} />{visible.length === 0 && <div className="flex flex-col items-center px-5 py-20 text-center text-slate-400"><PackageCheck size={42} strokeWidth={1.3} /><p className="mt-4 font-semibold text-slate-600">{search || source !== "ALL" ? "ไม่พบรายการที่ตรงกับการค้นหา" : "ยังไม่มีคำขอเบิกอะไหล่รออนุมัติ"}</p><p className="mt-2 text-xs">รายการจะปรากฏเมื่อช่างบันทึกผลประเมินเป็น “ขอเบิกอะไหล่”</p></div>}</>}
      </div>
      {!query.isError && !query.isLoading && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><p>แสดง {filtered.length ? start + 1 : 0} ถึง {Math.min(start + PAGE_SIZE, filtered.length)} จาก {filtered.length.toLocaleString("th-TH")} รายการ</p><nav aria-label="หน้ารายการอนุมัติเบิกอะไหล่" className="flex gap-2"><button type="button" aria-label="หน้าก่อนหน้า" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40"><ChevronLeft size={16} /></button>{pageNumbers.map((number) => <button type="button" key={number} aria-current={number === currentPage ? "page" : undefined} onClick={() => setPage(number)} className={`min-w-9 rounded-lg border px-3 py-2 ${number === currentPage ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white"}`}>{number}</button>)}<button type="button" aria-label="หน้าถัดไป" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40"><ChevronRight size={16} /></button></nav></div>}
      {selected && <SpareApprovalDialog key={`${selected.id}-${mode}`} request={selected} mode={mode} onClose={() => setSelected(null)} onSuccess={(message) => void completed(message)} />}
    </section>
  );
}
