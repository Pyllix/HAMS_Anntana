import type { QueryClient } from "@tanstack/react-query";

const assets = ["assets", "equipment-assets-paginated", "kpi-status", "kpi-total-assets", "kpi-normal-assets", "kpi-damaged-assets", "asset-viability-list", "asset-viability-detail", "asset-viability", "assetViability", "borrowRecommendations"];
const repairs = ["pendingEvaluations", "repairHistory", "repairConfirmations", "repairsHistory", "spare-approval-requests", "outsource-approval-requests", "unrepairable-receipts", "mechanicWorkloads", "repairMechanics", "mechanics"];
export function queryFamiliesForWrite(path: string): string[] {
  if (path.startsWith("/borrowings")) return [...assets, "borrowHistory", "borrowExtensions"];
  if (path.startsWith("/repairs")) return [...repairs, ...assets, "borrowHistory", "spareParts"];
  if (path.startsWith("/spare-parts")) return ["spareParts", "partOrders", ...repairs];
  if (path.startsWith("/asset")) return assets;
  if (path.startsWith("/users")) return ["users", "mechanics", "repairMechanics", "mechanicWorkloads"];
  return [];
}
export interface DataChange { families: string[]; completedAt: number; }

export async function refreshQueryFamilies(client: QueryClient, families: ReadonlySet<string>): Promise<void> {
  const filters = { predicate: (query: { queryKey: readonly unknown[] }) => families.has(String(query.queryKey[0])) };
  // Invalidation alone reuses a pending initial read in React Query v4.
  await client.cancelQueries(filters);
  await client.invalidateQueries(filters);
}
