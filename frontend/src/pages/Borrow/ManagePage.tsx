import { Search } from "lucide-react"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group/input-group"

function ManagePage() {
  return (
    // ช่องค้นหา ช่องตัวเลือก
    <div className="flex h-16 w-full items-center gap-6 rounded-lg border border-slate-200 bg-white px-6">
      {/* ค้นหา */}
      <InputGroup className="max-w-xs border border-slate-200 bg-slate-100">
        <InputGroupInput placeholder="ค้นหาชื่อ, อีเมล หรือรหัสพนักงาน...." />
        <InputGroupAddon>
          <Search className="text-slate-400" />
        </InputGroupAddon>
      </InputGroup>
      {/* เลือกสถานะ */}
      <NativeSelect className="">
        <NativeSelectOption value="">Select status</NativeSelectOption>
        <NativeSelectOption value="todo">Todo</NativeSelectOption>
        <NativeSelectOption value="in-progress">In Progress</NativeSelectOption>
        <NativeSelectOption value="done">Done</NativeSelectOption>
        <NativeSelectOption value="cancelled">Cancelled</NativeSelectOption>
      </NativeSelect>
      {/* เลือกสถานะ */}
      <NativeSelect className="">
        <NativeSelectOption value="">Select status</NativeSelectOption>
        <NativeSelectOption value="todo">Todo</NativeSelectOption>
        <NativeSelectOption value="in-progress">In Progress</NativeSelectOption>
        <NativeSelectOption value="done">Done</NativeSelectOption>
        <NativeSelectOption value="cancelled">Cancelled</NativeSelectOption>
      </NativeSelect>
    </div>
  )
}

export default ManagePage
