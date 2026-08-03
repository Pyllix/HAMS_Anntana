import { useEffect } from "react"
import { useBorrowHistoryStore } from "@/stores/borrowHistoryStore"

import { BorrowHistoryFilterBar } from "@/components/borrowhistory/BorrowHistoryFilterBar"
import { BorrowHistoryTable } from "@/components/borrowhistory/BorrowHistoryTable"
import { BorrowHistoryPagination } from "@/components/borrowhistory/BorrowHistoryPagination"

export default function BorrowHistoryPage() {
  const store = useBorrowHistoryStore()

  useEffect(() => {
    store.fetchHistoryAssets()
  }, [])

  return (
    <div className="flex w-full flex-col gap-5 bg-[#f8fafc] p-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <BorrowHistoryFilterBar />

        {/* ดึง Paginated Data จาก Store มาแสดง */}
        <BorrowHistoryTable assets={store.getPaginatedHistoryAssets()} />

        {/* ดึง State Pagination จาก Store */}
        <BorrowHistoryPagination
          page={store.currentPage}
          pageSize={store.pageSize}
          total={store.getFilteredHistoryAssets().length}
          onPageChange={(p: number) => store.setCurrentPage(p)}
        />
      </div>
    </div>
  )
}
