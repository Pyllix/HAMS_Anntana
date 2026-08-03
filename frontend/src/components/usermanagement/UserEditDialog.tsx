import { useState, useEffect } from "react"
import { X, Lock, Eye, EyeOff } from "lucide-react"
import type {
  ManagedUser,
  UpdateUserInput,
  SystemRole,
  AccountStatus,
} from "@/types/userManagementTypes"
import { ROLE_LABELS, ROLES_LIST } from "@/types/userManagementTypes"
import { mockSections } from "@/mock-up/mockSectionData"

interface Props {
  isOpen: boolean
  user: ManagedUser | null
  onClose: () => void
  onConfirm: (id: string, data: UpdateUserInput) => void
}

export function UserEditDialog({ isOpen, user, onClose, onConfirm }: Props) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [department, setDepartment] = useState("")
  const [role, setRole] = useState<SystemRole>("department_officer")
  const [status, setStatus] = useState<AccountStatus>("active")

  useEffect(() => {
    if (isOpen && user) {
      setName(user.name)
      setEmail(user.email)
      setDepartment(user.department)
      setRole(user.role)
      setStatus(user.status)
    }
  }, [isOpen, user])

  if (!isOpen || !user) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onConfirm(user!.id, { name, email, department, role, status })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <h3 className="text-lg font-bold text-slate-800">
            แก้ไขข้อมูลผู้ใช้งาน
          </h3>
          <button
            onClick={onClose}
            className="text-xl text-slate-400 transition-colors hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* รหัสพนักงาน (readonly) */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500">
              รหัสพนักงาน (ไม่สามารถแก้ไขได้)
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={user.empCode}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
              />
              <Lock className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* ชื่อ-นามสกุล */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              ชื่อ-นามสกุล <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#00966c] focus:outline-none"
            />
          </div>

          {/* อีเมล */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              อีเมล (Email) <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#00966c] focus:outline-none"
            />
          </div>

          {/* หน่วยงาน + ระดับสิทธิ์ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                หน่วยงาน / แผนก
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#00966c] focus:outline-none"
              >
                {mockSections.map((sec) => (
                  <option key={sec.id} value={sec.name}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                ระดับสิทธิ์
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as SystemRole)}
                className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#00966c] focus:outline-none"
              >
                {ROLES_LIST.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* สถานะบัญชี */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              สถานะบัญชี
            </label>
            <div className="flex items-center gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="status"
                  checked={status === "active"}
                  onChange={() => setStatus("active")}
                  className="h-4 w-4 accent-[#00966c]"
                />
                ใช้งานปกติ (Active)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500">
                <input
                  type="radio"
                  name="status"
                  checked={status === "suspended"}
                  onChange={() => setStatus("suspended")}
                  className="h-4 w-4 accent-[#00966c]"
                />
                ระงับการใช้งาน (Suspend)
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 min-w-24 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="h-10 min-w-32 rounded-lg bg-[#00966c] px-4 text-sm font-bold text-white transition-all hover:bg-[#007d5a] active:scale-[0.98]"
            >
              บันทึกการเปลี่ยนแปลง
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
