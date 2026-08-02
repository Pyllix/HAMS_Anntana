import { Eye, Pencil, Trash2 } from "lucide-react"
import type { ManagedUser, SystemRole } from "@/types/userManagementTypes"
import { ROLE_LABELS } from "@/types/userManagementTypes"

interface Props {
  users: ManagedUser[]
  onView: (user: ManagedUser) => void
  onEdit: (user: ManagedUser) => void
  onDelete: (user: ManagedUser) => void
}

/** Role badge สีตาม role – matching mockup */
const ROLE_BADGE_STYLES: Record<SystemRole, string> = {
  admin:
    "bg-emerald-600 text-white",
  inventory_officer:
    "border border-emerald-500 bg-emerald-50 text-emerald-700",
  department_officer:
    "border border-slate-300 bg-slate-50 text-slate-600",
  technician:
    "bg-orange-500 text-white",
  manager:
    "border border-emerald-500 bg-emerald-50 text-emerald-700",
}

const COLUMNS = [
  "รหัสผู้ใช้",
  "ชื่อ-นามสกุล / อีเมล",
  "หน่วยงาน/แผนก",
  "ระดับผู้ใช้งาน",
  "รหัสผ่าน",
  "สถานะ",
  "จัดการ",
]

export function UserTable({ users, onView, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-white text-xs font-semibold text-slate-400">
            {COLUMNS.map((col) => (
              <th
                key={col}
                className={`px-5 py-4 ${col === "จัดการ" ? "text-center" : ""}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.length === 0 ? (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="py-20 text-center text-sm font-medium text-slate-400"
              >
                ไม่พบรายการที่ตรงกับเงื่อนไข
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-slate-50/40"
              >
                {/* รหัสผู้ใช้ */}
                <td className="px-5 py-5">
                  <span className="font-mono text-sm font-semibold text-slate-700">
                    {user.empCode}
                  </span>
                </td>

                {/* ชื่อ-นามสกุล / อีเมล */}
                <td className="px-5 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {user.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>

                {/* หน่วยงาน/แผนก */}
                <td className="px-5 py-5 text-sm text-slate-600">
                  {user.department}
                </td>

                {/* ระดับผู้ใช้งาน */}
                <td className="px-5 py-5">
                  <span
                    className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${ROLE_BADGE_STYLES[user.role]}`}
                  >
                    {ROLE_LABELS[user.role]}
                  </span>
                </td>

                {/* รหัสผ่าน (masked) */}
                <td className="px-5 py-5">
                  <span className="text-sm tracking-widest text-slate-400">
                    ••••••••
                  </span>
                </td>

                {/* สถานะ */}
                <td className="px-5 py-5">
                  {user.status === "active" ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      ใช้งานปกติ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-500">
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      ระงับการใช้งาน
                    </span>
                  )}
                </td>

                {/* จัดการ */}
                <td className="px-5 py-5">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => onView(user)}
                      className="text-slate-300 transition-colors hover:text-slate-500"
                      title="ดูรายละเอียด"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onEdit(user)}
                      className="text-slate-300 transition-colors hover:text-slate-500"
                      title="แก้ไข"
                    >
                      <Pencil className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onDelete(user)}
                      className="text-slate-300 transition-colors hover:text-red-500"
                      title="ลบ"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
