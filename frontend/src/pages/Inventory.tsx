import { useState, useMemo } from "react"
import { StockSummaryCards } from "@/components/inventory/StockSummaryCards"
import {
  StockFilterBar,
  DEFAULT_STOCK_FILTERS,
  type StockFilters,
} from "@/components/inventory/StockFilterBar"
import { StockTable } from "@/components/inventory/StockTable"
import { StockPagination } from "@/components/inventory/StockPagination"
import {
  MOCK_STOCK_ASSETS,
  MOCK_STOCK_SUMMARY,
} from "@/mock-up/MockStockData"

const PAGE_SIZE = 10

function Inventory() {
  const [filters, setFilters] = useState<StockFilters>(DEFAULT_STOCK_FILTERS)
  const [page, setPage] = useState(1)

  // reset หน้าเมื่อ filter เปลี่ยน
  function handleFiltersChange(next: StockFilters) {
    setFilters(next)
    setPage(1)
  }

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

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-5 p-6">
      <StockSummaryCards summary={MOCK_STOCK_SUMMARY} />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <StockFilterBar filters={filters} onChange={handleFiltersChange} />
        <StockTable assets={paged} />
        <StockPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}

export default Inventory