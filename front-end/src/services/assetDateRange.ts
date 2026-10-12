export function assetDateRange(date: Date | null, label: string, enabled: boolean, now = new Date()): { updatedAtFrom?: string; updatedAtTo?: string } {
  if (!enabled || (!date && label !== "เดือนนี้")) return {};
  const anchor = date ?? now;
  const start = date ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
    : new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = date ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 1)
    : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  return { updatedAtFrom: start.toISOString(), updatedAtTo: new Date(end.getTime() - 1).toISOString() };
}
