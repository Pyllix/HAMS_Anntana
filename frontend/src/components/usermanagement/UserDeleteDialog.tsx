import { TriangleAlert } from "lucide-react"
import type { ManagedUser } from "@/types/userManagementTypes"
import { ROLE_LABELS } from "@/types/userManagementTypes"

interface Props {
  isOpen: boolean
  user: ManagedUser | null
  onClose: () => void
  onConfirm: () => void
}

export function UserDeleteDialog({ isOpen, user, onClose, onConfirm }: Props) {
  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
        {/* Warning icon */}
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <TriangleAlert className="h-8 w-8 text-red-500" />
        </div>

        <h3 className="text-lg font-bold text-slate-800">
          ยืนยันการลบผู้ใช้งาน?
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-400">
          คุณแน่ใจหรือไม่ที่จะลบผู้ใช้งานรายนี้ออกจากระบบ
          <br />
          ข้อมูลประวัติการทำงานของเขาจะยังคงถูกเก็บไว้เป็นประวัติการทำรายการ
        </p>

        {/* User info card */}
        <div className="mx-auto mt-4 flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
              {user.name.charAt(0)}
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-700">
                {user.name}
              </p>
              <p className="text-[10px] text-slate-400">
                {user.empCode} · {user.department}
              </p>
            </div>
          </div>
          <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600">
            {ROLE_LABELS[user.role]}
          </span>
        </div>

        {/* Buttons */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 flex-1 rounded-lg bg-red-500 text-sm font-bold text-white transition-all hover:bg-red-600 active:scale-[0.98]"
          >
            ยืนยันการลบข้อมูล
          </button>
        </div>

        {/* Warning text */}
        <p className="mt-3 text-[10px] text-red-400">
          * การกระทำนี้ไม่สามารถย้อนกลับได้
        </p>
      </div>
    </div>
  )
}
