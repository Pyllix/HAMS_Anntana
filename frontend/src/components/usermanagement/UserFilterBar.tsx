import { Search, ChevronDown } from "lucide-react"
import { useUserManagementStore } from "@/stores/userManagementStore"
import type { SystemRole, AccountStatus } from "@/types/userManagementTypes"
import { ROLE_LABELS, ROLES_LIST } from "@/types/userManagementTypes"

type RoleFilter = SystemRole | "all"
type StatusFilter = AccountStatus | "all"

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "active", label: "ใช้งานปกติ" },
  { value: "suspended", label: "ระงับการใช้งาน" },
]

export function UserFilterBar() {
  const {
    searchQuery,
    roleFilter,
    statusFilter,
    setSearchQuery,
    setRoleFilter,
    setStatusFilter,
  } = useUserManagementStore()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            placeholder="ค้นหาชื่อ, อีเมล หรือรหัสพนักงาน..."
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-4 pl-12 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-[#00a96e]"
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Role filter dropdown */}
        <div className="relative flex min-w-[240px] items-center rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 shadow-sm focus-within:border-[#00a96e]">
          <span className="mr-1 whitespace-nowrap text-slate-400">ระดับผู้ใช้:</span>
          <select
            value={roleFilter}
            className="h-12 cursor-pointer appearance-none bg-transparent pr-7 font-semibold text-[#00a96e] outline-none"
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          >
            <option value="all">ทั้งหมด</option>
            {ROLES_LIST.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
        </div>

        {/* Status filter dropdown */}
        <div className="relative flex min-w-[220px] items-center rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 shadow-sm focus-within:border-[#00a96e]">
          <span className="mr-1 whitespace-nowrap text-slate-400">สถานะ:</span>
          <select
            value={statusFilter}
            className="h-12 cursor-pointer appearance-none bg-transparent pr-7 font-semibold text-[#00a96e] outline-none"
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
        </div>
      </div>
    </div>
  )
}
