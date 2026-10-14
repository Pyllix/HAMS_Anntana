import { getPage } from "./pagedApi";
import type { Filters, Page } from "./pagedApi";
import type { SparePartTransaction } from "../types/TypeSparePartTransaction";

// ดึงประวัติ transaction การเบิก/คืนอะไหล่ (read-only)
// รองรับ filter: search, txnType, startDate, endDate, sparepartId, jobId, userId
// เมื่อไม่ส่ง txnType จะได้เฉพาะ WITHDRAW และ RETURN (ไม่รวม PENDING_WITHDRAW)
export function getSparePartTransactions(
  filters: Filters,
  signal?: AbortSignal,
): Promise<Page<SparePartTransaction>> {
  return getPage<SparePartTransaction>(
    "/spare-parts/transactions",
    filters,
    signal,
  );
}
