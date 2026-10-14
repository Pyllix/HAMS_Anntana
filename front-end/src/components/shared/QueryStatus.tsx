interface QueryStatusProps {
  query: { isLoading: boolean; isError: boolean; isFetching: boolean; data?: unknown; refetch: () => unknown };
  retry?: boolean;
}
export default function QueryStatus({ query, retry = false }: QueryStatusProps) {
  if (!query.isLoading && !query.isError) return null;

  return <div aria-live="polite" className={`flex shrink-0 flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs ${query.isError ? "border border-amber-200 bg-amber-50 text-amber-700" : "text-slate-500"}`}>
    {query.isLoading && !query.isError && <span>กำลังโหลด…</span>}
    {query.isError && <span role="alert" className="text-amber-700">{query.data ? "อัปเดตไม่สำเร็จ กำลังแสดงข้อมูลล่าสุดที่โหลดได้" : "โหลดข้อมูลไม่สำเร็จ"}</span>}
    {retry && query.isError && <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="font-medium underline disabled:opacity-50">ลองอีกครั้ง</button>}
  </div>;
}
