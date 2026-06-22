import { useState, useEffect } from "react"
import { Calendar, Clock, Package, Heart, ShieldAlert } from "lucide-react" // 👈 นำเข้าไอคอน Lucide
import type { Asset } from "../../types/manageBorrowTypes"

interface Props {
  isOpen: boolean
  asset: Asset | null
  onClose: () => void
  onConfirm: (data: any) => void
}

export function ManageReturnDialog({
  isOpen,
  asset,
  onClose,
  onConfirm,
}: Props) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConfirm({
      returnerName: name,
      condition: cond,
      returnDate: currentDate,
      returnTime: currentTime,
      note: note || undefined,
    })
  }

  const getAssetIcon = (id: string) => {
    if (id.startsWith("BP")) return <Heart className="h-5 w-5 text-rose-500" />
    if (id.startsWith("AED"))
      return <ShieldAlert className="h-5 w-5 text-amber-500" />
    return <Package className="h-5 w-5 text-slate-400" />
  }

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 duration-150">
      <div className="relative w-full max-w-115 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4">
          <h3 className="text-lg font-bold text-slate-800">
            ทำรายการรับคืนครุภัณฑ์
          </h3>
          <button
            onClick={onClose}
            className="text-xl text-slate-400 transition-colors hover:text-slate-600"
          >
            ×
          </button>
        </div>

       
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-[#f8fafc] p-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white shadow-sm">
            {getAssetIcon(asset.id)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-slate-800">
              {asset.name}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              รหัส: {asset.id} • Status ปัจจุบัน:{" "}
              <span className="font-semibold text-[#d97706]">กำลังยืม</span>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-[#dcfce7] bg-[#f0fdf4] px-3.5 py-2.5 text-xs leading-relaxed font-medium text-[#166534]">
          ข้อมูลการยืม: พญ. ใจดี รักษา (ER) • นำไปเมื่อ{" "}
          {asset.borrowDate || "24 ก.พ. 2569"} 08:30 น.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              ชื่อ-นามสกุลผู้คืน <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="กรอกชื่อ-นามสกุล"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#00966c] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              สภาพครุภัณฑ์หลังใช้งาน <span className="text-rose-500">*</span>
            </label>
            <div className="mt-2 flex items-center gap-6">
              <label className="flex cursor-pointer items-center text-sm font-medium text-slate-700 select-none">
                <input
                  type="radio"
                  name="condition"
                  checked={cond === "ปกติ (พร้อมใช้งาน)"}
                  onChange={() => setCond("ปกติ (พร้อมใช้งาน)")}
                  className="mr-2 h-4 w-4 accent-[#00966c]"
                />
                ปกติ (พร้อมใช้งาน)
              </label>
              <label className="flex cursor-pointer items-center text-sm font-medium text-slate-600 select-none">
                <input
                  type="radio"
                  name="condition"
                  checked={cond === "ชำรุด / ส่งซ่อม"}
                  onChange={() => setCond("ชำรุด / ส่งซ่อม")}
                  className="mr-2 h-4 w-4 accent-[#00966c]"
                />
                ชำรุด / ส่งซ่อม
              </label>
            </div>
          </div>

  
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              วันที่และเวลาที่รับคืน <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={currentDate}
                  disabled
                  className="h-10 w-full cursor-not-allowed rounded-lg border border-slate-100 bg-[#f8fafc] pr-9 pl-3 text-sm text-slate-500 select-none focus:outline-none"
                />
                <Calendar className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={currentTime}
                  disabled
                  className="h-10 w-full cursor-not-allowed rounded-lg border border-slate-100 bg-[#f8fafc] pr-9 pl-3 text-sm text-slate-500 select-none focus:outline-none"
                />
                <Clock className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              หมายเหตุ (ถ้ามี)
            </label>
            <textarea
              placeholder="ระบุรายละเอียดเพิ่มเติม เช่น สายชาร์จชำรุด, มีรอยร้าว..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#00966c] focus:outline-none"
            />
          </div>

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
