import { useEffect } from "react"
import { useEquipmentStore } from "@/stores/useEquipmentStore"
// input seach
import { Search } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

// selection
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

// Table
import { columns } from "@/components/equipment/columns"
import { DataTable } from "@/components/equipment/data-table"

export default function ManagePage() {
  const equipments = useEquipmentStore((state) => state.equipments)
  const status = useEquipmentStore((state) => state.equipmentStatus)
  const category = useEquipmentStore((state) => state.equipmentCategories)
  const fetchInitialData = useEquipmentStore((state) => state.fechInitailData)

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  return (
    <div className="flex flex-col">
      {/* กรอบ seach */}
      <div className="flex h-16 items-center gap-4 rounded-xl border border-slate-200 bg-white px-6">
        {/* ช่อง search */}
        <InputGroup className="max-w-xs">
          <InputGroupInput placeholder="Search..." />
          <InputGroupAddon>
            <Search className="text-slate-400" />
          </InputGroupAddon>
        </InputGroup>
        {/* selection */}
        <NativeSelect>
          <NativeSelectOption value="all">สถานะ: ทั้งหมด</NativeSelectOption>
          {Object.entries(status).map(([Key, label]) => (
            <NativeSelectOption key={Key} value={Key}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {/* selection */}
        <NativeSelect>
          <NativeSelectOption value="all">ประเภท: ทั้งหมด</NativeSelectOption>
          {category.map((cat) => (
            <NativeSelectOption key={cat} value={cat}>
              {cat}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {/* กรอบ Table */}
      <div className="container mx-auto py-4">
        <DataTable columns={columns} data={equipments} />
      </div>
    </div>
  )
}
