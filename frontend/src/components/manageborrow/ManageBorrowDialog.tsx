import { useState, useEffect } from "react"
import { Calendar, Clock, X, ChevronDown } from "lucide-react"
import type { Asset } from "../../types/manageBorrowTypes"

interface BorrowProps {
  isOpen: boolean
  asset: Asset | null
  onClose: () => void
  onConfirm: (data: {
    borrowerName: string
    department: string
    borrowDate: string
    borrowTime: string
  }) => void
}

export function ManageBorrowDialog({
  isOpen,
  asset,
  onClose,
  onConfirm,
}: BorrowProps) {
  const [name, setName] = useState("")
  const [dept, setDept] = useState("")
  const [currentDate, setCurrentDate] = useState("")
  const [currentTime, setCurrentTime] = useState("")

  useEffect(() => {
    if (isOpen) {
      const now = new Date()
      const dateStr = now.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
      const timeStr =
        now.toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        }) + " น."

      setCurrentDate(dateStr)
      setCurrentTime(timeStr)
      setName("")
      setDept("")
    }
  }, [isOpen])

  if (!isOpen || !asset) return null

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    onConfirm({
      borrowerName: name,
      department: dept,
      borrowDate: currentDate,
      borrowTime: currentTime,
    })
    setName("")
    setDept("")
  }

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            ทำรายการยืมครุภัณฑ์
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Asset Info Card */}
        <div className="mb-5 flex items-center gap-3.5 rounded-xl bg-gray-50/80 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white">
            <div className="h-3.5 w-3.5 rounded border border-gray-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mt-0.5 text-[14px] font-semibold text-slate-900">
              {asset.name}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
              รหัส: {asset.code} • สถานะ:{" "}
              <span className="mt-0.5 text-[11px] font-semibold text-emerald-600">
                {asset.status}
              </span>
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* ชื่อ-นามสกุล */}
          <div>
            <label className="mt-0.5 mb-1 block text-[14px] font-semibold text-slate-800">
              ชื่อ-นามสกุลผู้ยืม <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="กรอกชื่อ-นามสกุล"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-0.5 w-full rounded-xl border border-gray-200 p-2.5 text-[12px] font-semibold text-slate-800 outline-none focus:border-[#00966c]"
            />
          </div>

          {/* แผนก / วอร์ด */}
          <div>
            <label className="mt-0.5 mb-1 block text-[14px] font-semibold text-slate-800">
              แผนก / วอร์ด (Ward) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                required
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-white p-2.5 pr-8 font-semibold text-gray-700 outline-none focus:border-[#00966c]"
              >
                <option value="" disabled>
                  เลือกแผนกที่นำไปใช้...
                </option>
                <option value="ER (ฉุกเฉิน)">ER (ฉุกเฉิน)</option>
                <option value="OR (ห้องผ่าตัด)">OR (ห้องผ่าตัด)</option>
                <option value="ICU">ICU</option>
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-400"
              />
            </div>
          </div>

          {/* วันที่และเวลาที่ยืม */}
          <div>
            <label className="mt-0.5 mb-1 block text-[14px] font-semibold text-slate-800">
              วันที่และเวลาที่ยืม <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-gray-700">
                <span>{currentDate}</span>
                <Calendar size={16} className="shrink-0 text-gray-400" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-gray-700">
                <span>{currentTime}</span>
                <Clock size={16} className="shrink-0 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-slate-50 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 min-w-20 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="h-9 min-w-27.5 rounded-lg bg-[#00966c] px-4 text-xs font-bold text-white transition-all hover:bg-[#007d5a] active:scale-[0.98]"
            >
              ยืนยันการยืม
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
