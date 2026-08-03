import { useMemo, useState } from "react"
import { RepairFilterBar } from "@/components/tracking/RepairFilterBar"
import { RepairPagination } from "@/components/tracking/RepairPagination"
import { RepairSummaryCards } from "@/components/tracking/RepairSummaryCards"
import { RepairTable } from "@/components/tracking/RepairTable"
import { REPAIR_REQUESTS } from "@/mock-up/repairTrackingMockData"
import type { RepairStatusFilter } from "@/types/repairTrackingTypes"

const PAGE_SIZE = 4

export default function Track() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<RepairStatusFilter>("ทั้งหมด")
  const [page, setPage] = useState(1)

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase()

    return REPAIR_REQUESTS.filter((request) => {
      const matchesSearch =
        !query ||
        request.requestCode.toLowerCase().includes(query) ||
        request.assetCode.toLowerCase().includes(query) ||
        request.assetName.toLowerCase().includes(query)
      const matchesStatus = status === "ทั้งหมด" || request.status === status

      return matchesSearch && matchesStatus
    })
  }, [search, status])

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const requests = filteredRequests.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleStatusChange(value: RepairStatusFilter) {
    setStatus(value)
    setPage(1)
  }

  return (
    <div className="flex w-full flex-col gap-5 bg-[#f8fafc] p-6">
      <RepairSummaryCards requests={REPAIR_REQUESTS} />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <RepairFilterBar
          search={search}
          status={status}
          onSearchChange={handleSearchChange}
          onStatusChange={handleStatusChange}
        />
        <RepairTable requests={requests} />
        <RepairPagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={filteredRequests.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
