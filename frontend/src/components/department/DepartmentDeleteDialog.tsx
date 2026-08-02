import { TriangleAlert } from "lucide-react"
import type { Section } from "@/types/SectionType"

interface Props {
  isOpen: boolean
  section: Section | null
  isLoading?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function DepartmentDeleteDialog({ isOpen, section, isLoading, onClose, onConfirm }: Props) {
  if (!isOpen || !section) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
        {/* Warning icon */}
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <TriangleAlert className="h-7 w-7 text-red-500" />
        </div>

        <h3 className="text-base font-bold text-slate-800">ยืนยันการลบแผนก?</h3>
        <p className="mt-1 text-xs text-slate-400">
          คุณแน่ใจหรือไม่ที่จะลบแผนกนี้ออกจากระบบ
        </p>

        {/* ชื่อแผนกที่จะลบ */}
        <div className="mx-auto mt-4 w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          {section.code} / {section.name}
        </div>

        {/* ปุ่ม */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 h-9 rounded-lg bg-red-500 text-xs font-bold text-white transition-all hover:bg-red-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "กำลังลบ..." : "ยืนยันการลบข้อมูล"}
          </button>
        </div>

        {/* คำเตือน */}
        <p className="mt-3 text-[10px] text-red-400">
          หากมีผู้ใช้ หรือ ครุภัณฑ์ ที่อาจจะไม่สามารถลบได้
          เนื่องจากยังมีข้อมูลผู้ใช้หรือครุภัณฑ์ที่ผูกกันอยู่
        </p>
      </div>
    </div>
  )
}
