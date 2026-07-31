import { useState, useEffect } from "react"
import { Calendar, Clock, X } from "lucide-react"
import type { Asset } from "../../types/manageBorrowTypes"

interface ReturnProps {
  isOpen: boolean
  asset: Asset | null
  onClose: () => void
  onConfirm: (data: {
    returnerName: string
    condition: "ปกติ (พร้อมใช้งาน)" | "ชำรุด / ส่งซ่อม"
    returnDate: string
    returnTime: string
    note?: string
  }) => void
}

export function ManageReturnDialog({
  isOpen,
  asset,
  onClose,
  onConfirm,
}: ReturnProps) {
  const [name, setName] = useState("")
  const [cond, setCond] = useState<"ปกติ (พร้อมใช้งาน)" | "ชำรุด / ส่งซ่อม">(
    "ปกติ (พร้อมใช้งาน)"
  )
  const [note, setNote] = useState("")
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
      setCond("ปกติ (พร้อมใช้งาน)")
      setNote("")
    }
  }, [isOpen])

  if (!isOpen || !asset) return null

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    onConfirm({
      returnerName: name,
      condition: cond,
      returnDate: currentDate,
      returnTime: currentTime,
      note: note || undefined,
    })
  }

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            ทำรายการรับคืนครุภัณฑ์
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Asset Info Card */}
        <div className="mb-3 flex items-center gap-3.5 rounded-xl bg-gray-50/80 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white">
            <div className="h-3.5 w-3.5 rounded border border-gray-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mt-0.5 text-[14px] font-semibold text-slate-900">
              {asset.name}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
              รหัส: {asset.code} • สถานะปัจจุบัน:{" "}
              <span className="mt-0.5 text-[11px] font-semibold text-amber-600">
                {asset.status}
              </span>
            </p>
          </div>
        </div>

        {/* Borrow Info Banner */}
        <div className="mb-4 rounded-xl border border-emerald-100/60 bg-[#f0fdf4] p-3 text-xs font-semibold text-slate-900">
          ข้อมูลการยืม:{" "}
          <span className="font-semibold text-slate-900">
            {asset.borrower} ({asset.department})
          </span>{" "}
          • นำไปเมื่อ {asset.borrowDate} {asset.borrowTime}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* ชื่อ-นามสกุล */}
          <div>
            <label className="mt-0.5 mb-1 block text-[14px] font-semibold text-slate-800">
              ชื่อ-นามสกุลผู้คืน <span className="text-rose-500">*</span>
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

          {/* สภาพครุภัณฑ์ */}
          <div>
            <label className="mt-0.5 mb-1 block text-[14px] font-semibold text-slate-800">
              สภาพครุภัณฑ์หลังใช้งาน <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-6">
              <label className="flex cursor-pointer items-center gap-2 select-none">
                <input
                  type="radio"
                  name="condition"
                  checked={cond === "ปกติ (พร้อมใช้งาน)"}
                  onChange={() => setCond("ปกติ (พร้อมใช้งาน)")}
                  className="h-4 w-4 accent-[#00966c]"
                />
                <span className="text-[12px] font-semibold text-gray-500">
                  ปกติ (พร้อมใช้งาน)
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 select-none">
                <input
                  type="radio"
                  name="condition"
                  checked={cond === "ชำรุด / ส่งซ่อม"}
                  onChange={() => setCond("ชำรุด / ส่งซ่อม")}
                  className="h-4 w-4 accent-[#00966c]"
                />
                <span className="text-[12px] font-semibold text-gray-500">
                  ชำรุด / ส่งซ่อม
                </span>
              </label>
            </div>
          </div>

          {/* วันที่และเวลาที่รับคืน */}
          <div>
            <label className="mt-0.5 mb-1 block text-[14px] font-semibold text-slate-800">
              วันที่และเวลาที่รับคืน <span className="text-rose-500">*</span>
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

          {/* หมายเหตุ */}
          <div>
            <label className="mt-0.5 mb-1 block text-[14px] font-semibold text-slate-800">
              หมายเหตุ (ถ้ามี)
            </label>
            <textarea
              rows={2}
              placeholder="ระบุรายละเอียดเพิ่มเติม เช่น สายชาร์จชำรุด, มีรอยร้าว..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="font-semi w-full resize-none rounded-xl border border-gray-200 p-2.5 text-gray-800 outline-none focus:border-[#00966c]"
            />
          </div>

          {/* Action Buttons */}
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
              ยืนยันรับคืน
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
