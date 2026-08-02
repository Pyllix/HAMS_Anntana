import { Search } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { RepairStatusFilter } from "@/types/repairTrackingTypes"

const STATUS_OPTIONS: RepairStatusFilter[] = [
  "ทั้งหมด",
  "รอดำเนินการ",
  "กำลังดำเนินการ",
  "รออะไหล่",
  "เสร็จสิ้น",
]

interface Props {
  search: string
  status: RepairStatusFilter
  onSearchChange: (value: string) => void
  onStatusChange: (value: RepairStatusFilter) => void
}

export function RepairFilterBar({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <InputGroup className="w-full max-w-md border border-slate-200 bg-slate-50">
        <InputGroupAddon>
          <Search className="h-4 w-4 text-slate-400" />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="ค้นหาด้วยรหัสแจ้งซ่อม หรือ ชื่อครุภัณฑ์..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </InputGroup>

      <NativeSelect
        className="w-40"
        value={status}
        onChange={(event) =>
          onStatusChange(event.target.value as RepairStatusFilter)
        }
      >
        {STATUS_OPTIONS.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option === "ทั้งหมด" ? "สถานะทั้งหมด" : option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}
