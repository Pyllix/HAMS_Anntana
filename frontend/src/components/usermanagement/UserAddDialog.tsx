import { useState, useEffect } from "react"
import { X, Eye, EyeOff, Info } from "lucide-react"
import type {
  CreateUserInput,
  SystemRole,
} from "@/types/userManagementTypes"
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLES_LIST,
} from "@/types/userManagementTypes"
import { mockSections } from "@/mock-up/mockSectionData"

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: CreateUserInput) => void
}

const EMPTY: CreateUserInput = {
  name: "",
  empCode: "",
  email: "",
  department: "",
  role: "department_officer",
  password: "",
}

export function UserAddDialog({ isOpen, onClose, onConfirm }: Props) {
  const [form, setForm] = useState<CreateUserInput>(EMPTY)
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY)
      setConfirmPassword("")
      setShowPassword(false)
      setPasswordError("")
    }
  }, [isOpen])

  if (!isOpen) return null

  function handleChange(field: keyof CreateUserInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== confirmPassword) {
      setPasswordError("รหัสผ่านไม่ตรงกัน")
      return
    }
    setPasswordError("")
    onConfirm(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              เพิ่มผู้ใช้งานใหม่
            </h3>
            <p className="text-xs text-slate-400">
              กรอกข้อมูลรายละเอียดผู้ใช้งานและกำหนดสิทธิ์การเข้าถึงระบบ
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xl text-slate-400 transition-colors hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ชื่อ-นามสกุล + รหัสพนักงาน */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                ชื่อ-นามสกุล <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น สมชาย ระยมดี"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#00966c] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                รหัสพนักงาน <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น EMP-001"
                value={form.empCode}
                onChange={(e) => handleChange("empCode", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#00966c] focus:outline-none"
              />
            </div>
          </div>

          {/* อีเมล + หน่วยงาน */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                อีเมล (Email) <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="email@company.com"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#00966c] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                หน่วยงาน/แผนก <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={form.department}
                onChange={(e) => handleChange("department", e.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#00966c] focus:outline-none"
              >
                <option value="">-- โปรดเลือกหน่วยงาน --</option>
                {mockSections.map((sec) => (
                  <option key={sec.id} value={sec.name}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ระดับผู้ใช้งาน (Role) */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              ระดับผู้ใช้งาน (Role) <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={form.role}
              onChange={(e) =>
                handleChange("role", e.target.value)
              }
              className="h-10 w-full appearance-none rounded-lg border border-emerald-400 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 focus:border-[#00966c] focus:outline-none"
            >
              {ROLES_LIST.map((r, i) => (
                <option key={r} value={r}>
                  {i + 1}. {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            {/* Role description */}
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
              <p className="text-[11px] leading-relaxed text-blue-600">
                {ROLE_DESCRIPTIONS[form.role as SystemRole]}
              </p>
            </div>
          </div>

          {/* รหัสผ่าน */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                รหัสผ่าน <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-10 text-sm text-slate-800 focus:border-[#00966c] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                ยืนยันรหัสผ่าน <span className="text-rose-500">*</span>
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 focus:border-[#00966c] focus:outline-none"
              />
            </div>
          </div>
          {passwordError && (
            <p className="text-xs text-red-500">{passwordError}</p>
          )}

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
              className="h-10 min-w-28 rounded-lg bg-[#00966c] px-4 text-sm font-bold text-white transition-all hover:bg-[#007d5a] active:scale-[0.98]"
            >
              บันทึกข้อมูล
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
