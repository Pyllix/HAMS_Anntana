import { useMemo, useState } from "react"
import { useEquipmentBorrowStore } from "@/stores/equipmentBorrowStore"
import type { Asset } from "@/types/equipmentBorrowTypes"

import { EquipmentBorrowFilterBar } from "@/components/equipmentborrow/EquipmentBorrowFilterBar"
import { EquipmentBorrowTable } from "@/components/equipmentborrow/EquipmentBorrowTable"
import { EquipmentBorrowPagination } from "@/components/equipmentborrow/EquipmentBorrowPagination"
import { EquipmentBorrowDialog } from "@/components/equipmentborrow/EquipmentBorrowDialog"
import { EquipmentReturnDialog } from "@/components/equipmentborrow/EquipmentReturnDialog"

const PAGE_SIZE = 10

export default function EquipmentBorrowPage() {
  const store = useEquipmentBorrowStore()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Asset | null>(null)

  const [modals, setModals] = useState({
    borrow: false,
    return: false,
  })

  const filteredAssets = useMemo(() => {
    const q = store.searchQuery.toLowerCase().trim()

    return store.assets.filter((item) => {
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.borrowerName?.toLowerCase().includes(q) ||
        item.ward?.toLowerCase().includes(q)

      const matchStatus =
        store.statusFilter === "ทั้งหมด" || item.status === store.statusFilter

      const matchType =
        store.typeFilter === "ทั้งหมด" || item.type === store.typeFilter

      return matchSearch && matchStatus && matchType
    })
  }, [store.assets, store.searchQuery, store.statusFilter, store.typeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pagedAssets = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE
    return filteredAssets.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredAssets, safePage])

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <EquipmentBorrowFilterBar />

      <EquipmentBorrowTable
        assets={pagedAssets}
        onBorrow={(asset) => {
          setSelected(asset)
          setModals((prev) => ({ ...prev, borrow: true }))
        }}
        onReturn={(asset) => {
          setSelected(asset)
          setModals((prev) => ({ ...prev, return: true }))
        }}
      />

      <EquipmentBorrowPagination
        page={safePage}
        pageSize={PAGE_SIZE}
        total={filteredAssets.length}
        onPageChange={setPage}
      />

      <EquipmentBorrowDialog
        isOpen={modals.borrow}
        asset={selected}
        onClose={() => setModals((prev) => ({ ...prev, borrow: false }))}
        onConfirm={(data) => {
          if (selected) {
            store.checkOutAsset(selected.id, data)
          }

          setModals((prev) => ({ ...prev, borrow: false }))
        }}
      />

      <EquipmentReturnDialog
        isOpen={modals.return}
        asset={selected}
        onClose={() => setModals((prev) => ({ ...prev, return: false }))}
        onConfirm={(data) => {
          if (selected) {
            store.checkInAsset(selected.id, data)
          }

          setModals((prev) => ({ ...prev, return: false }))
        }}
      />
    </div>
  )
}
