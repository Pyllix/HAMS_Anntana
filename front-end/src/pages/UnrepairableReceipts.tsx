import { getAssetTypes } from "../services/assetService";
import { useQuery } from "@tanstack/react-query";
import { useServerPage, useDebouncedSearch } from "../hooks/useServerPage";
import { getUnrepairableReceiptsPage } from "../services/unrepairableReceiptService";
import QueryStatus from "../components/shared/QueryStatus";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, PackageCheck, RefreshCw, Search } from "lucide-react";
import type { UnrepairableReceipt } from "../types/TypeUnrepairableReceipt";
import { getUnrepairableReceipts, receiptError } from "../services/unrepairableReceiptService";
import UnrepairableReceiptTable from "../components/unrepairable-receipt/UnrepairableReceiptTable";
import ConfirmUnrepairableReceiptDialog from "../components/unrepairable-receipt/ConfirmUnrepairableReceiptDialog";

const PAGE_SIZE = 5;
const QUERY_KEY = ["unrepairable-receipts"];

export default function UnrepairableReceipts({ embedded = false }: { embedded?: boolean }) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const [selected, setSelected] = useState<UnrepairableReceipt | null>(null);
  const [success, setSuccess] = useState("");
  const term = useDebouncedSearch(search);
  const { data: assetTypes } = useQuery({ queryKey: ["assetTypes"], queryFn: getAssetTypes });
  const categories = (assetTypes ?? []).map((t) => t.name);
  const query = useServerPage(QUERY_KEY[0], { search: term, stepActionType: "UNREPAIRABLE", statusCode: "UNREPAIRABLE", workflowStep: 5, assetTypeId: category ? assetTypes?.find((t) => t.name === category)?.id : undefined }, getUnrepairableReceiptsPage, true);
  const { page: currentPage, setPage, totalPages } = query;
  const totalItems = query.total;
  const start = (currentPage - 1) * query.pageSize;
  const visible = query.rows;
  const firstPage = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
  const pages = Array.from({ length: Math.min(3, totalPages) }, (_, index) => firstPage + index);

  function completed(job: UnrepairableReceipt) {
    setSelected(null);
    setSuccess(`รับคืน ${job.assetCode} สำเร็จ ครุภัณฑ์อยู่ในสถานะรอจำหน่ายแล้ว`);

    // Other shared screens must not retain asset/job data from before receipt.
    void client.invalidateQueries();
  }

  return <section className={`flex flex-col bg-[#f8f9fb] text-slate-800 ${embedded ? "min-h-0 flex-1 px-0 py-0" : "min-h-[calc(100vh-120px)] px-4 py-6 lg:px-7"}`}>
      <QueryStatus query={query} />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">รายการครุภัณฑ์ที่ส่งคืน</h2><button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-white disabled:opacity-50"><RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} />รีเฟรช</button></div>
    {success && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} />{success}</div>}
    <div className="mb-2 flex flex-wrap items-center gap-4 rounded-xl border border-slate-100 bg-white px-5 py-3">
      <label className="relative w-full sm:max-w-sm"><span className="sr-only">ค้นหารหัสหรือชื่อครุภัณฑ์</span><Search size={18} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="ค้นหารหัส / ชื่อครุภัณฑ์ / เลขงานซ่อม" className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500" /></label>
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-500">หมวดหมู่:<select aria-label="หมวดหมู่ครุภัณฑ์" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="max-w-52 bg-white font-semibold text-emerald-700 outline-none"><option value="">ทั้งหมด</option>{categories.map((name) => <option key={name} value={name}>{name}</option>)}{category && !categories.includes(category) && <option value={category}>{category}</option>}</select></label>
    </div>
    <div className="min-h-[360px] flex-1 overflow-hidden rounded-b-xl bg-white">
      {query.isError && !query.data ? <div role="alert" className="m-6 rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700"><p>{receiptError(query.error)}</p><button type="button" onClick={() => void query.refetch()} className="mt-3 font-semibold underline">ลองโหลดอีกครั้ง</button></div>
        : query.isLoading ? <div role="status" className="flex justify-center gap-2 py-24 text-sm text-slate-500"><Loader2 size={20} className="animate-spin" />กำลังโหลดรายการรับคืน…</div>
          : <><UnrepairableReceiptTable rows={visible} onConfirm={(job) => { setSelected(job); setSuccess(""); }} />
            {visible.length === 0 && <div className="flex flex-col items-center px-5 py-20 text-center text-slate-400"><PackageCheck size={40} strokeWidth={1.3} /><p className="mt-4 font-semibold text-slate-600">{term || category ? "ไม่พบรายการที่ตรงกับการค้นหา" : "ยังไม่มีครุภัณฑ์รอรับคืน"}</p><p className="mt-2 text-xs">รายการจะปรากฏเมื่อช่างส่งคืนครุภัณฑ์ที่ไม่สามารถซ่อมได้แล้ว</p>{(term || category) && <button onClick={() => { setSearch(""); setCategory(""); setPage(1); }} className="mt-4 text-sm text-emerald-600 underline">ล้างตัวกรอง</button>}</div>}</>}
    </div>
    {!!query.data && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><p>แสดง {totalItems ? start + 1 : 0} ถึง {Math.min(start + query.pageSize, totalItems)} จาก {totalItems.toLocaleString("th-TH")} รายการ</p><nav aria-label="หน้ารายการรับคืน" className="flex gap-2"><button type="button" aria-label="หน้าก่อนหน้า" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40"><ChevronLeft size={16} /></button>{pages.map((number) => <button type="button" key={number} aria-label={`หน้า ${number}`} aria-current={number === currentPage ? "page" : undefined} onClick={() => setPage(number)} className={`min-w-9 rounded-lg border px-3 py-2 ${number === currentPage ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white"}`}>{number}</button>)}<button type="button" aria-label="หน้าถัดไป" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40"><ChevronRight size={16} /></button></nav></div>}
    {selected && <ConfirmUnrepairableReceiptDialog key={selected.id} selected={selected} onClose={() => setSelected(null)} onSuccess={completed} />}
  </section>;
}
