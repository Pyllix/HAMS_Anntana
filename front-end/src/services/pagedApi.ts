import { apiClient } from "./apiClient";

export interface PageMeta { page: number; limit: number; total: number; totalPages: number; hasNextPage?: boolean; }
export interface Page<T> { data: T[]; meta: PageMeta; }
export type Filters = Record<string, string | number | boolean | string[] | undefined>;
export interface StatusSummary { total: number; byStatusCode: Record<string, number>; overdueCount?: number; }
export interface AssetSummary { total: number; byAssetStatusCode: Record<string, number>; byAvailabilityStatusCode: Record<string, number>; }
export interface SpareSummary { total: number; byStockStatus: Record<string, number>; }

export function apiFilters(filters: Filters): Record<string, string | number | boolean> {
  return Object.fromEntries(Object.entries(filters).flatMap(([key, value]) =>
    value === undefined || value === "" || value === "ALL" || (Array.isArray(value) && value.length === 0)
      ? [] : [[key, Array.isArray(value) ? value.join(",") : value]]));
}
export async function getPage<T>(path: string, filters: Filters, signal?: AbortSignal): Promise<Page<T>> {
  const { data } = await apiClient.get<Page<T>>(path, { params: apiFilters(filters), signal });
  if (!Array.isArray(data?.data) || !Number.isInteger(data.meta?.total) ||
      !Number.isInteger(data.meta?.totalPages) || !Number.isInteger(data.meta?.page)) {
    throw new Error("API ส่งข้อมูล pagination ไม่ครบ กรุณาลองใหม่");
  }
  return data;
}
export async function getSummary<T>(path: string, filters: Filters = {}, signal?: AbortSignal): Promise<T> {
  const { data } = await apiClient.get<T>(path, { params: apiFilters(filters), signal });
  return data;
}
export function statusCount(summary: StatusSummary | undefined, codes: readonly string[]): number | undefined {
  return summary ? codes.reduce((sum, code) => sum + (summary.byStatusCode[code] ?? 0), 0) : undefined;
}
