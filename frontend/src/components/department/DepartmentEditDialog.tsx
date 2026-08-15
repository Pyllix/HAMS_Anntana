import { useState, useEffect } from "react"
import { Lock } from "lucide-react"
import type { Section, UpdateSectionInput } from "@/types/SectionType"

interface Props {
  isOpen: boolean
  section: Section | null
  isLoading?: boolean
  onClose: () => void
  onConfirm: (id: string, data: UpdateSectionInput) => void
}

export function DepartmentEditDialog({ isOpen, section, isLoading, onClose, onConfirm }: Props) {
  const [form, setForm] = useState<UpdateSectionInput>({})
  const [remark, setRemark] = useState("")

  useEffect(() => {
    if (isOpen && section) {
      setForm({
        name: section.name,
        tel: section.tel,
        building: section.building,
      })
      setRemark("-")
    }
  }, [isOpen, section])

  if (!isOpen || !section) return null

  function handleChange(field: keyof UpdateSectionInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onConfirm(section!.id, form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <h3 className="text-lg font-bold text-slate-800">แก้ไขข้อมูลแผนก</h3>
          <button
            onClick={onClose}
            className="text-xl text-slate-400 transition-colors hover:text-slate-600"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* รหัสแผนก (ล็อก — แก้ไม่ได้) */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500">
              รหัสแผนก / ตัวย่อ (ไม่สามารถแก้ไขได้)
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                disabled
                value={section.code}
                className="h-10 w-full cursor-not-allowed rounded-lg border border-slate-100 bg-slate-50 pr-10 pl-3 text-sm text-slate-400 select-none focus:outline-none"
              />
              <Lock className="pointer-events-none absolute right-3 h-4 w-4 text-slate-300" />
            </div>
          </div>

          {/* ชื่อแผนก */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              ชื่อแผนก <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name ?? ""}
              onChange={(e) => handleChange("name", e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#00966c] focus:outline-none"
            />
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
                value={form.tel ?? ""}
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
                value={form.building ?? ""}
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
              className="h-9 min-w-36 rounded-lg bg-[#00966c] px-4 text-xs font-bold text-white transition-all hover:bg-[#007d5a] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
