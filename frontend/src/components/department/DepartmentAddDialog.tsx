import { useState, useEffect } from "react"
import type { CreateSectionInput } from "@/types/SectionType"

interface Props {
  isOpen: boolean
  isLoading?: boolean
  onClose: () => void
  onConfirm: (data: CreateSectionInput) => void
}

const EMPTY: CreateSectionInput = { code: "", name: "", tel: "", building: "" }
const EMPTY_REMARK = ""

export function DepartmentAddDialog({ isOpen, isLoading, onClose, onConfirm }: Props) {
  const [form, setForm] = useState<CreateSectionInput>(EMPTY)
  const [remark, setRemark] = useState(EMPTY_REMARK)

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY)
      setRemark(EMPTY_REMARK)
    }
  }, [isOpen])

  if (!isOpen) return null

  function handleChange(field: keyof CreateSectionInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onConfirm(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">เพิ่มแผนกใหม่</h3>
            <p className="text-xs text-slate-400">กรอกข้อมูลรายละเอียด</p>
          </div>
          <button
            onClick={onClose}
            className="text-xl text-slate-400 transition-colors hover:text-slate-600"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ชื่อแผนก + รหัสแผนก */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                ชื่อแผนก <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น ศูนย์คอมพิวเตอร์"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#00966c] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                รหัสแผนก / ตัวย่อ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น ADM, IT, ER"
                value={form.code}
                onChange={(e) => handleChange("code", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#00966c] focus:outline-none"
              />
            </div>
          </div>

          {/* เบอร์โทร + อาคาร */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                เบอร์โทรศัพท์ภายใน <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="123, 116"
                value={form.tel}
                onChange={(e) => handleChange("tel", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#00966c] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                อาคาร / สถานที่ตั้ง <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น อาคาร 1 ชั้น 2"
                value={form.building}
                onChange={(e) => handleChange("building", e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#00966c] focus:outline-none"
              />
            </div>
          </div>

          {/* หมายเหตุ */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              หมายเหตุ
            </label>
            <textarea
              rows={4}
              placeholder="กรอกข้อมูลเพิ่มเติม..."
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-[#00966c] focus:outline-none"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 min-w-20 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="h-9 min-w-28 rounded-lg bg-[#00966c] px-4 text-xs font-bold text-white transition-all hover:bg-[#007d5a] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
