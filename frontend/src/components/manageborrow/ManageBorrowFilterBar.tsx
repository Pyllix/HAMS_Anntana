import { Search } from "lucide-react"
import { useManageBorrowStore } from "../../stores/manageBorrowStore"
import type { BorrowStatusFilter } from "../../types/manageBorrowTypes"
import { BORROW_CATEGORIES } from "../../mock-up/manageBorrowMockData"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

const BORROW_STATUS_OPTIONS: BorrowStatusFilter[] = [
  "ทั้งหมด",
  "ว่าง",
  "กำลังยืม",
  "ส่งซ่อม",
]

export function ManageBorrowFilterBar() {
  const {
    searchQuery,
    statusFilter,
    typeFilter,
    setSearchQuery,
    setStatusFilter,
    setTypeFilter,
  } = useManageBorrowStore()

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-white px-5 py-3">
      <InputGroup className="w-64 rounded-xl border border-slate-200 bg-slate-50">
        <InputGroupInput
          placeholder="ค้นหาชื่อ, รหัส หรือผู้ยืมครุภัณฑ์..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <InputGroupAddon>
          <Search className="h-4 w-4 text-slate-400" />
        </InputGroupAddon>
      </InputGroup>

      <NativeSelect
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        className="rounded-xl"
      >
        <NativeSelectOption value="ทั้งหมด">ประเภท: ทั้งหมด</NativeSelectOption>
        {BORROW_CATEGORIES.map((c) => (
          <NativeSelectOption key={c.code} value={c.code}>
            {c.code}-{c.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <NativeSelect
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as BorrowStatusFilter)}
        className="rounded-xl"
      >
        {BORROW_STATUS_OPTIONS.map((s) => (
          <NativeSelectOption key={s} value={s}>
            {s === "ทั้งหมด" ? "สถานะ: ทั้งหมด" : s}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}
