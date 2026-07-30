import { useMemo, useState } from "react"
import { Calendar, Clock, ChevronDown, X } from "lucide-react"
import type {
  Asset,
  BorrowTransactionInput,
} from "@/types/equipmentBorrowTypes"

interface Props {
  isOpen: boolean
  asset: Asset | null
  onClose: () => void
  onConfirm: (data: BorrowTransactionInput) => void
}

export function EquipmentBorrowDialog({
  isOpen,
  asset,
  onClose,
  onConfirm,
}: Props) {
  const [borrowerName, setBorrowerName] = useState("")
  const [ward, setWard] = useState("")

  const deliveryMethod: BorrowTransactionInput["deliveryMethod"] =
    "มารับด้วยตนเอง"

  const { borrowDate, borrowTime } = useMemo(() => {
    const now = new Date()

    return {
      borrowDate: now.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      borrowTime:
        now.toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        }) + " น.",
    }
  }, [isOpen, asset?.id])

  const resetForm = () => {
    setBorrowerName("")
    setWard("")
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!isOpen || !asset) return null

  const handleSubmit = () => {
    if (!borrowerName || !ward) return

    onConfirm({
      equipmentId: asset.id,
      borrowerName,
      ward,
      borrowDate,
      borrowTime,
      deliveryMethod,
    })

    resetForm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[440px] overflow-hidden rounded-[24px] border border-slate-100/80 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="text-[17px] font-bold text-slate-800">
            ทำรายการยืมครุภัณฑ์
          </h3>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#f8fafc] p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-400">
              <div className="h-4 w-6 rounded border-[2.5px] border-slate-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">{asset.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                รหัส: {asset.code} • สถานะ: {asset.status}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              ชื่อ-นามสกุลผู้ยืม <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              placeholder="กรอกชื่อ-นามสกุลผู้ยืม..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#00a96e]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              แผนก / วอร์ด (Ward) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#00a96e]"
              >
                <option value="">เลือกแผนกที่นำไปใช้...</option>
                <option value="ER">ER (แผนกฉุกเฉิน)</option>
                <option value="ICU">ICU (หอผู้ป่วยวิกฤต)</option>
                <option value="OPD">OPD (ผู้ป่วยนอก)</option>
                <option value="Central Supply">Central Supply</option>
              </select>
              <ChevronDown className="pointer-events-none absolute top-3.5 right-3.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              วันที่และเวลาที่ยืม <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative w-1/2">
                <input
                  type="text"
                  value={borrowDate}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-3 text-sm text-slate-600 outline-none"
                />
                <Calendar className="absolute top-3.5 right-3 h-4 w-4 text-slate-400" />
              </div>
              <div className="relative w-1/2">
                <input
                  type="text"
                  value={borrowTime}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-3 text-sm text-slate-600 outline-none"
                />
                <Clock className="absolute top-3.5 right-3 h-4 w-4 text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-50 bg-white p-4 px-6 pb-6">
          <button
            onClick={handleClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={!borrowerName || !ward}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm ${
              borrowerName && ward
                ? "bg-[#00a96e] hover:bg-[#009262]"
                : "cursor-not-allowed bg-slate-300"
            }`}
          >
            ยืนยันการขอยืม
          </button>
        </div>
      </div>
    </div>
  )
}
