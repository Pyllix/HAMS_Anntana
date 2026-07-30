import { useState, useEffect } from "react"
import { useManageBorrowStore } from "../../stores/manageBorrowStore"
import type { Asset } from "../../types/manageBorrowTypes"

import { ManageBorrowFilterBar } from "../../components/manageborrow/ManageBorrowFilterBar"
import { ManageBorrowTable } from "../../components/manageborrow/ManageBorrowTable"
import { ManageBorrowPagination } from "../../components/manageborrow/ManageBorrowPagination"
import { ManageBorrowDialog } from "../../components/manageborrow/ManageBorrowDialog"
import { ManageReturnDialog } from "../../components/manageborrow/ManageReturnDialog"

export default function ManagePage() {
  const store = useManageBorrowStore()
  const [selected, setSelected] = useState<Asset | null>(null)
  const [modals, setModals] = useState({ borrow: false, return: false })

  useEffect(() => {
    store.fetchAssets()
  }, [])

  return (
    <div className="flex w-full flex-col gap-5 bg-[#f8fafc] p-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ManageBorrowFilterBar />

        {/* ดึง Paginated Data จาก Store มาแสดง */}
        <ManageBorrowTable
          assets={store.getPaginatedAssets()}
          onBorrow={(asset) => {
            setSelected(asset)
            setModals((m) => ({ ...m, borrow: true }))
          }}
          onReturn={(asset) => {
            setSelected(asset)
            setModals((m) => ({ ...m, return: true }))
          }}
        />

        {/* ดึง State Pagination จาก Store*/}
        <ManageBorrowPagination
          page={store.currentPage}
          pageSize={store.pageSize}
          total={store.getFilteredAssets().length}
          onPageChange={(p: number) => store.setCurrentPage(p)}
        />
      </div>

      <ManageBorrowDialog
        isOpen={modals.borrow}
        asset={selected}
        onClose={() => setModals((m) => ({ ...m, borrow: false }))}
        onConfirm={async (data) => {
          if (selected) {
            await store.borrowAsset({ assetId: selected.id, ...data })
          }
          setModals((m) => ({ ...m, borrow: false }))
        }}
      />

      <ManageReturnDialog
        isOpen={modals.return}
        asset={selected}
        onClose={() => setModals((m) => ({ ...m, return: false }))}
        onConfirm={async (data) => {
          if (selected) {
            await store.returnAsset({ assetId: selected.id, ...data })
          }
          setModals((m) => ({ ...m, return: false }))
        }}
      />
    </div>
  )
}
