/**
 * useStockAssets
 *
 * Hook นี้เป็นตัวกลางระหว่าง UI กับแหล่งข้อมูล
 * ตอนนี้ใช้ mock data, พอต่อ backend จริงแค่เปลี่ยนในนี้ที่เดียว
 *
 * TODO (Backend): แทนที่ block "── MOCK ──" ด้านล่างด้วย API call เช่น
 *   const { data } = useQuery({ queryKey: [...], queryFn: () => api.getStockAssets(params) })
 */

import { useMemo } from "react"
import type { StockFilters } from "@/components/inventory/StockFilterBar"
import type { StockAsset } from "@/types/StockType"
import {
  MOCK_STOCK_ASSETS,
  MOCK_STOCK_SUMMARY,
} from "@/mock-up/MockStockData"

// ── Return type ที่ StockPage เห็น (ไม่เปลี่ยนแม้สลับ API) ──────────────────
export interface UseStockAssetsResult {
  /** รายการที่ผ่าน filter + pagination แล้ว */
  assets: StockAsset[]
  /** จำนวนรายการทั้งหมดหลัง filter (ก่อน pagination) — ใช้คำนวณ totalPage */
  filteredTotal: number
  /** สรุปยอดรวมสำหรับ summary cards บนหน้า */
  summary: typeof MOCK_STOCK_SUMMARY
  /** TODO: เพิ่มเป็น true ตอนดึง API จริง */
  isLoading: boolean
}

interface Params {
  filters: StockFilters
  page: number
  pageSize: number
}

export function useStockAssets({ filters, page, pageSize }: Params): UseStockAssetsResult {
  // ── MOCK ─────────────────────────────────────────────────────────────────────
  // ตอนต่อ API จริง: ลบ block นี้ทิ้ง แล้วใช้ data จาก API แทน
  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase()
    return MOCK_STOCK_ASSETS.filter((a) => {
      const matchSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.pid.toLowerCase().includes(q) ||
        a.serialNumber.toLowerCase().includes(q)
      const matchCat =
        !filters.categoryCode || a.category.code === filters.categoryCode
      const matchDept =
        !filters.department || a.department === filters.department
      const matchStatus =
        filters.status === "ทั้งหมด" || a.status === filters.status
      return matchSearch && matchCat && matchDept && matchStatus
    })
  }, [filters])

  const assets = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  )

  const summary = MOCK_STOCK_SUMMARY
  // ── END MOCK ──────────────────────────────────────────────────────────────────

  return {
    assets,
    filteredTotal: filtered.length,
    summary,
    isLoading: false,
  }
}
