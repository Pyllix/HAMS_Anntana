interface QueryStatusProps {
  query: { isLoading: boolean; isError: boolean; isFetching: boolean; data?: unknown; refetch: () => unknown };
}
export default function QueryStatus({ query }: QueryStatusProps) {
  return <div aria-live="polite" className="flex shrink-0 items-center justify-end gap-3 px-3 py-1 text-xs text-slate-500">
    {query.isLoading && <span>กำลังโหลด…</span>}
    {query.isError && <span role="alert" className="text-amber-700">{query.data ? "อัปเดตไม่สำเร็จ กำลังแสดงข้อมูลล่าสุดที่โหลดได้" : "โหลดข้อมูลไม่สำเร็จ"}</span>}
    <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="underline disabled:opacity-50">{query.isFetching && !query.isLoading ? "กำลังอัปเดต…" : "รีเฟรช"}</button>
  </div>;
}
