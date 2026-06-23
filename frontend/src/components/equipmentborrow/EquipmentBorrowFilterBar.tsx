import { Search, ChevronDown } from "lucide-react"
import type { BorrowStatusFilter } from "@/types/equipmentBorrowTypes"
import { useEquipmentBorrowStore } from "@/stores/equipmentBorrowStore"
import { BORROW_CATEGORIES } from "@/mock-up/equipmentBorrowMockData"

const BORROW_STATUS_OPTIONS: BorrowStatusFilter[] = [
  "ทั้งหมด",
  "ว่าง",
  "กำลังยืม",
  "ส่งซ่อม",
]

export function EquipmentBorrowFilterBar() {
  const {
    searchQuery,
    statusFilter,
    typeFilter,
    setSearchQuery,
    setStatusFilter,
    setTypeFilter,
  } = useEquipmentBorrowStore()

  return (
    <div className="mb-6 flex gap-3">
      <div className="relative flex-1">
        <Search className="absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          placeholder="ค้นหาชื่อ หรือรหัสครุภัณฑ์..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-4 pl-10 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-[#00a96e]"
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="relative flex items-center rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm focus-within:border-[#00a96e]">
        <span className="mr-1 text-slate-400">สถานะ:</span>
        <select
          value={statusFilter}
          className="cursor-pointer appearance-none bg-transparent py-2 pr-6 font-medium text-[#00a96e] outline-none"
          onChange={(e) =>
            setStatusFilter(e.target.value as BorrowStatusFilter)
          }
        >
          {BORROW_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
      </div>

      <div className="relative flex items-center rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm focus-within:border-[#00a96e]">
        <span className="mr-1 text-slate-400">ประเภท:</span>
        <select
          value={typeFilter}
          className="max-w-[240px] cursor-pointer appearance-none truncate bg-transparent py-2 pr-6 font-medium text-[#00a96e] outline-none"
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ทั้งหมด">ทั้งหมด</option>
          {BORROW_CATEGORIES.map((category) => {
            const value = `${category.code}-${category.name}`

            return (
              <option key={category.code} value={value}>
                {value}
              </option>
            )
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
      </div>
    </div>
  )
}
