import { useState } from "react"
import { StockSummaryCards } from "@/components/inventory/StockSummaryCards"
import {
  StockFilterBar,
  DEFAULT_STOCK_FILTERS,
  type StockFilters,
} from "@/components/inventory/StockFilterBar"
import { StockTable } from "@/components/inventory/StockTable"
import { StockPagination } from "@/components/inventory/StockPagination"
import { StockDetailDialog } from "@/components/inventory/StockDetailDialog"
import { useStockAssets } from "@/hooks/useStockAssets"
import type { StockAsset } from "@/types/StockType"

const PAGE_SIZE = 10

function StockPage() {
  const [filters, setFilters] = useState<StockFilters>(DEFAULT_STOCK_FILTERS)
  const [page, setPage] = useState(1)
  const [selectedAsset, setSelectedAsset] = useState<StockAsset | null>(null)

  // reset หน้าเมื่อ filter เปลี่ยน
  function handleFiltersChange(next: StockFilters) {
    setFilters(next)
    setPage(1)
  }

  // ── ข้อมูลมาจาก hook (ไม่รู้ว่า mock หรือ API) ──────────────────────────────
  const { assets, filteredTotal, summary } = useStockAssets({
    filters,
    page,
    pageSize: PAGE_SIZE,
  })

  return (
    <div className="flex flex-col gap-5 p-6">
      <StockSummaryCards summary={summary} />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <StockFilterBar filters={filters} onChange={handleFiltersChange} />
        <StockTable assets={assets} onViewDetail={setSelectedAsset} />
        <StockPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={filteredTotal}
          onPageChange={setPage}
        />
      </div>

      <StockDetailDialog
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
      />
    </div>
  )
}

export default StockPage
