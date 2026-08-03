import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import type { SystemRole } from "@/types/userManagementTypes"
import { ROLE_LABELS } from "@/types/userManagementTypes"

interface Props {
  selected: SystemRole | "all"
  onChange: (role: SystemRole | "all") => void
}

const TABS: { value: SystemRole | "all"; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "admin", label: "1. ผู้ดูแลระบบ" },
  { value: "inventory_officer", label: "2. เจ้าหน้าที่ครุภัณฑ์" },
  { value: "department_officer", label: "3. เจ้าหน้าที่หน่วยงาน" },
  { value: "technician", label: "4. ช่าง/งานซ่อม" },
  { value: "manager", label: "5. ผู้บริหาร" },
]

export function UserRoleFilter({ selected, onChange }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "flex w-full items-center justify-center border-b border-slate-100 px-6 py-4 text-sm font-semibold transition-all last:border-b-0",
            selected === tab.value
              ? "bg-emerald-50 text-emerald-600"
              : "bg-white text-slate-700 hover:bg-slate-50"
          )}
        >
          <span className="flex-1 text-center">{tab.label}</span>
          {selected === tab.value && (
            <Check className="h-4 w-4 text-emerald-500" />
          )}
        </button>
      ))}
    </div>
  )
}
