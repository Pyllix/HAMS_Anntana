import { useState, useMemo, useEffect } from "react"
import { useManageBorrowStore } from "../../stores/manageBorrowStore"
import type { Asset } from "../../types/manageBorrowTypes"

import { ManageBorrowFilterBar } from "../../components/manageborrow/ManageBorrowFilterBar"
import { ManageBorrowTable } from "../../components/manageborrow/ManageBorrowTable"
import { ManageBorrowPagination } from "../../components/manageborrow/ManageBorrowPagination"
import { ManageBorrowDialog } from "../../components/manageborrow/ManageBorrowDialog"
import { ManageReturnDialog } from "../../components/manageborrow/ManageReturnDialog"

const PAGE_SIZE = 10

export default function ManagePage() {
  const store = useManageBorrowStore()
  const [page, setPage] = useState(1)

  const [selected, setSelected] = useState<Asset | null>(null)
  const [modals, setModals] = useState({ borrow: false, return: false })

  useEffect(() => {
    setPage(1)
  }, [store.searchQuery, store.statusFilter, store.typeFilter])

  const filteredAssets = useMemo(() => {
    const assetsList = store?.assets || []
    const q = (store?.searchQuery || "").toLowerCase().trim()

    return assetsList.filter((item) => {
      const matchSearch =
        !q ||
        item.name?.toLowerCase().includes(q) ||
        item.id?.toLowerCase().includes(q) ||
        (item.borrower && item.borrower.toLowerCase().includes(q))

      const matchStatus =
        store.statusFilter === "ทั้งหมด" || item.status === store.statusFilter
      const matchType =
        store.typeFilter === "ทั้งหมด" ||
        store.typeFilter === "" ||
        item.categoryCode === store.typeFilter

      return matchSearch && matchStatus && matchType
    })
  }, [
    store?.assets,
    store?.searchQuery,
    store?.statusFilter,
    store?.typeFilter,
  ])

  const pagedAssets = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE
    return filteredAssets.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredAssets, page])

  return (
    <div className="flex w-full flex-col gap-5 bg-[#f8fafc] p-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ManageBorrowFilterBar />

        <ManageBorrowTable
          assets={pagedAssets}
          onBorrow={(asset) => {
            setSelected(asset)
            setModals((m) => ({ ...m, borrow: true }))
          }}
          onReturn={(asset) => {
            setSelected(asset)
            setModals((m) => ({ ...m, return: true }))
          }}
        />

        <ManageBorrowPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={filteredAssets.length}
          onPageChange={setPage}
        />
      </div>

      <ManageBorrowDialog
        isOpen={modals.borrow}
        asset={selected}
        onClose={() => setModals((m) => ({ ...m, borrow: false }))}
        onConfirm={(data) => {
          if (selected) store.checkOutAsset(selected.id, data)
          setModals((m) => ({ ...m, borrow: false }))
        }}
      />

      <ManageReturnDialog
        isOpen={modals.return}
        asset={selected}
        onClose={() => setModals((m) => ({ ...m, return: false }))}
        onConfirm={(data) => {
          if (selected) store.checkInAsset(selected.id, data)
          setModals((m) => ({ ...m, return: false }))
        }}
      />
    </div>
  )
}
