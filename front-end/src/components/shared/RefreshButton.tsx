import { useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { refreshQueryFamilies } from "../../services/queryRefreshPolicy";

type RefreshButtonProps =
  | { families: readonly string[]; query?: never }
  | { query: { isFetching: boolean; refetch: () => unknown }; families?: never };

export default function RefreshButton({ families, query }: RefreshButtonProps) {
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const fetching = useIsFetching({
    predicate: (cached) => families?.includes(String(cached.queryKey[0])) ?? false,
  });
  const busy = refreshing || (query ? query.isFetching : fetching > 0);

  async function refresh() {
    setRefreshing(true);
    setFailed(false);
    try {
      if (query) await query.refetch();
      else await refreshQueryFamilies(client, new Set(families));
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {failed && <span role="alert" className="text-xs text-amber-700">รีเฟรชไม่สำเร็จ กรุณาลองอีกครั้ง</span>}
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={busy}
        aria-label="รีเฟรชข้อมูล"
        aria-busy={busy}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-xs transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw aria-hidden="true" className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        รีเฟรช
      </button>
    </div>
  );
}
