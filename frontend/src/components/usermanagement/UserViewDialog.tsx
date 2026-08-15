import { X } from "lucide-react"
import type { ManagedUser } from "@/types/userManagementTypes"
import { ROLE_LABELS } from "@/types/userManagementTypes"
import { Pencil } from "lucide-react"

interface Props {
  isOpen: boolean
  user: ManagedUser | null
  onClose: () => void
  onEdit: (user: ManagedUser) => void
}

function formatThaiDate(dateStr: string): string {
  if (!dateStr || dateStr === "-") return "-"
  const d = new Date(dateStr)
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ]
  const day = d.getDate().toString().padStart(2, "0")
  const month = months[d.getMonth()]
  const year = d.getFullYear() + 543
  return `${day} ${month} ${year}`
}

function formatLastLogin(dateStr: string): string {
  if (!dateStr || dateStr === "-") return "-"
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const hours = d.getHours().toString().padStart(2, "0")
  const mins = d.getMinutes().toString().padStart(2, "0")

  if (diffDays === 0) return `วันนี้, ${hours}:${mins} น.`
  if (diffDays === 1) return `เมื่อวาน, ${hours}:${mins} น.`
  return `${diffDays} วันที่แล้ว, ${hours}:${mins} น.`
}

export function UserViewDialog({ isOpen, user, onClose, onEdit }: Props) {
  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <h3 className="text-lg font-bold text-slate-800">
            รายละเอียดผู้ใช้งาน
          </h3>
          <button
            onClick={onClose}
            className="text-xl text-slate-400 transition-colors hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User info header */}
        <div className="flex items-center gap-4 pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-600">
            {user.name.charAt(0)}
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">{user.name}</p>
            <p className="text-xs text-slate-400">{user.email}</p>
            <div className="mt-1 flex items-center gap-1.5">
              {user.status === "active" ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  ใช้งานปกติ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  ระงับการใช้งาน
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Detail card */}
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-y-4">
            <div>
              <p className="text-[10px] font-medium uppercase text-slate-400">
                รหัสพนักงาน
              </p>
              <p className="text-sm font-semibold text-slate-700">
                {user.empCode}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase text-slate-400">
                เบอร์โทรศัพท์
              </p>
              <p className="text-sm font-semibold text-slate-700">
                {user.phone || "-"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase text-slate-400">
                หน่วยงาน / แผนก
              </p>
              <p className="text-sm font-semibold text-slate-700">
                {user.department}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase text-slate-400">
                ระดับสิทธิ์ (Role)
              </p>
              <p className="text-sm font-semibold text-slate-700">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase text-slate-400">
                วันที่เพิ่มเข้าระบบ
              </p>
              <p className="text-sm font-semibold text-slate-700">
                {formatThaiDate(user.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase text-slate-400">
                เข้าสู่ระบบล่าสุด
              </p>
              <p className="text-sm font-semibold text-slate-700">
                {formatLastLogin(user.lastLogin)}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 min-w-28 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98]"
          >
            ปิดหน้าต่าง
          </button>
          <button
            type="button"
            onClick={() => onEdit(user)}
            className="flex h-10 min-w-32 items-center justify-center gap-2 rounded-lg bg-[#00966c] px-4 text-sm font-bold text-white transition-all hover:bg-[#007d5a] active:scale-[0.98]"
          >
            <Pencil className="h-4 w-4" />
            แก้ไขข้อมูล
          </button>
        </div>
      </div>
    </div>
  )
}
