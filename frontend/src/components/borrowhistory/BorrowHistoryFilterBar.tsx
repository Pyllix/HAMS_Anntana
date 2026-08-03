import { Search } from "lucide-react"
import { useBorrowHistoryStore } from "@/stores/borrowHistoryStore"
import type { BorrowHistoryStatusFilter } from "@/types/borrowHistoryTypes"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

const BORROW_HISTORY_STATUS_OPTIONS: BorrowHistoryStatusFilter[] = [
  "ทั้งหมด",
  "คืนแล้ว",
  "ยังไม่คืน",
]

export function BorrowHistoryFilterBar() {
  const { filters, setFilters } = useBorrowHistoryStore()

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
      {/*ช่องค้นหา*/}
      <InputGroup className="w-64 border border-slate-200 bg-slate-50">
        <InputGroupInput
          placeholder="ค้นหาด้วยรหัสการยืม, รหัสครุภัณฑ์ หรือ ชื่อครุภัณฑ์..."
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
        />
        <InputGroupAddon>
          <Search className="h-4 w-4 text-slate-400" />
        </InputGroupAddon>
      </InputGroup>

      {/* เลือกสถานะ */}
      <NativeSelect
        value={filters.status}
        onChange={(e) =>
          setFilters({ status: e.target.value as BorrowHistoryStatusFilter })
        }
        className="rounded-xl"
      >
        {BORROW_HISTORY_STATUS_OPTIONS.map((s) => (
          <NativeSelectOption key={s} value={s}>
            {s === "ทั้งหมด" ? "สถานะ: ทั้งหมด" : s}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}
