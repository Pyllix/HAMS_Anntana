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
  const { filters, setFilters } = useManageBorrowStore()

  return (
<<<<<<< HEAD
    <div className="flex h-16 items-center gap-4 rounded-lg border border-slate-200 bg-white px-6">
      <InputGroup className="w-64 rounded-xl border border-slate-200 bg-slate-50">
=======
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
      <InputGroup className="w-64 border border-slate-200 bg-slate-50">
>>>>>>> bd3eba2e4e4590b2f71a4647ee54562ce97502ea
        <InputGroupInput
          placeholder="ค้นหาชื่อ, รหัส หรือผู้ยืมครุภัณฑ์..."
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
        />
        <InputGroupAddon>
          <Search className="h-4 w-4 text-slate-400" />
        </InputGroupAddon>
      </InputGroup>

      {/* เลือกประเภท */}
      <NativeSelect
        value={filters.categoryCode}
        onChange={(e) => setFilters({ categoryCode: e.target.value })}
        className="rounded-xl"
      >
        <NativeSelectOption value="ทั้งหมด">ประเภท: ทั้งหมด</NativeSelectOption>
        {BORROW_CATEGORIES.map((c) => (
          <NativeSelectOption key={c.code} value={c.code}>
            {c.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      {/* เลือกสถานะ */}
      <NativeSelect
        value={filters.status}
        onChange={(e) =>
          setFilters({ status: e.target.value as BorrowStatusFilter })
        }
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
