import { Search } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group/input-group"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import {
  STOCK_CATEGORIES,
  STOCK_DEPARTMENTS,
} from "@/mock-up/MockStockData"
import type { StockStatusFilter } from "@/types/StockType"

// export ออกมาให้ Inventory.tsx ใช้กำหนด state ได้ถูก type
export interface StockFilters {
  search: string
  categoryCode: string // "" = ทั้งหมด
  department: string   // "" = ทั้งหมด
  status: StockStatusFilter
}

export const DEFAULT_STOCK_FILTERS: StockFilters = {
  search: "",
  categoryCode: "",
  department: "",
  status: "ทั้งหมด",
}

const STATUS_OPTIONS: StockStatusFilter[] = [
  "ทั้งหมด",
  "ใช้งานปกติ",
  "สภาพชำรุด",
  "รอจำหน่าย",
  "ส่งคืนคลัง",
]

interface Props {
  filters: StockFilters
  onChange: (filters: StockFilters) => void
}

export function StockFilterBar({ filters, onChange }: Props) {
  function update(partial: Partial<StockFilters>) {
    onChange({ ...filters, ...partial })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
      <InputGroup className="w-64 border border-slate-200 bg-slate-50">
        <InputGroupInput
          placeholder="ค้นหา ชื่อ, PID, Serial Number..."
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
        />
        <InputGroupAddon>
          <Search className="h-4 w-4 text-slate-400" />
        </InputGroupAddon>
      </InputGroup>

      {/* ประเภท */}
      <NativeSelect
        value={filters.categoryCode}
        onChange={(e) => update({ categoryCode: e.target.value })}
      >
        <NativeSelectOption value="">ประเภท: ทั้งหมด</NativeSelectOption>
        {STOCK_CATEGORIES.map((c) => (
          <NativeSelectOption key={c.code} value={c.code}>
            {c.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      {/* แผนก */}
      <NativeSelect
        value={filters.department}
        onChange={(e) => update({ department: e.target.value })}
      >
        <NativeSelectOption value="">แผนก: ทั้งหมด</NativeSelectOption>
        {STOCK_DEPARTMENTS.map((d) => (
          <NativeSelectOption key={d} value={d}>
            {d}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      {/* สถานะ */}
      <NativeSelect
        value={filters.status}
        onChange={(e) => update({ status: e.target.value as StockStatusFilter })}
      >
        {STATUS_OPTIONS.map((s) => (
          <NativeSelectOption key={s} value={s}>
            {s === "ทั้งหมด" ? "สถานะ: ทั้งหมด" : s}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}
