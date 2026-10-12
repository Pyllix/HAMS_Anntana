import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Page, Filters } from "../services/pagedApi";
import { apiFilters } from "../services/pagedApi";
import { useAuthStore } from "../stores/authStore";

export function useDebouncedSearch(value: string): string {
  const [search, setSearch] = useState(value.trim());
  useEffect(() => { const timer = setTimeout(() => setSearch(value.trim()), 300); return () => clearTimeout(timer); }, [value]);
  return search;
}
export function useForegroundQuery<T>(key: readonly unknown[], queryFn: (signal: AbortSignal) => Promise<T>, live = false, enabled = true) {
  const userId = useAuthStore((s) => s.user?.id);
  const authenticated = useAuthStore((s) => s.isAuthenticated);
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return useQuery({
    queryKey: [key[0], userId, ...key.slice(1)],
    queryFn: ({ signal }) => queryFn(signal),
    enabled: enabled && authenticated && !!userId && visible,
    staleTime: 10_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: live && visible ? 30_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
export function useServerPage<T>(key: string, filters: Filters, load: (filters: Filters, signal: AbortSignal) => Promise<Page<T>>, live = false, enabled = true, pageSize = 20) {
  const scope = JSON.stringify(apiFilters(filters));
  const [cursor, setCursor] = useState({ scope, page: 1 });
  const page = cursor.scope === scope ? cursor.page : 1;
  const setPage = (value: number | ((old: number) => number)) => setCursor({ scope, page: Math.max(1, typeof value === "function" ? value(page) : value) });
  const query = useForegroundQuery([key, "page", scope, page, pageSize],
    (signal) => load({ ...filters, page, limit: pageSize }, signal), live, enabled);
  const totalPages = Math.max(1, query.data?.meta.totalPages ?? 1);
  useEffect(() => {
    if (query.isSuccess && query.data && page > Math.max(1, query.data.meta.totalPages))
      setCursor({ scope, page: Math.max(1, query.data.meta.totalPages) });
  }, [page, scope, query.isSuccess, query.data]);
  const tableOptions = {
    manualPagination: true, autoResetPageIndex: false, pageCount: totalPages,
    rowCount: query.data?.meta.total ?? 0,
    state: { pagination: { pageIndex: page - 1, pageSize } },
    onPaginationChange: (update: { pageIndex: number; pageSize: number } | ((old: { pageIndex: number; pageSize: number }) => { pageIndex: number; pageSize: number })) => {
      const next = typeof update === "function" ? update({ pageIndex: page - 1, pageSize }) : update;
      setPage(next.pageIndex + 1);
    },
  };
  return { ...query, page, setPage, pageSize, totalPages, total: query.data?.meta.total ?? 0, rows: query.data?.data ?? [], tableOptions };
}
