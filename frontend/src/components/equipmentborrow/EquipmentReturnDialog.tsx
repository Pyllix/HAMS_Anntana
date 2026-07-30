import { useState } from "react"
import { X } from "lucide-react"
import type {
  Asset,
  ReturnTransactionInput,
} from "@/types/equipmentBorrowTypes"

interface Props {
  isOpen: boolean
  asset: Asset | null
  onClose: () => void
  onConfirm: (data: ReturnTransactionInput) => void
}

export function EquipmentReturnDialog({
  isOpen,
  asset,
  onClose,
  onConfirm,
}: Props) {
  const [returnMethod, setReturnMethod] = useState<
    "มาส่งคืนด้วยตนเอง" | "ให้เจ้าหน้าที่ไปรับคืน"
  >("มาส่งคืนด้วยตนเอง")

  const [returnNote, setReturnNote] = useState("")

  if (!isOpen || !asset) return null

  const handleSubmit = () => {
    onConfirm({
      equipmentId: asset.id,
      returnMethod,
      condition: "ปกติ",
      returnDate: new Date().toLocaleDateString("th-TH"),
      remark: returnNote,
    })

    setReturnMethod("มาส่งคืนด้วยตนเอง")
    setReturnNote("")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[440px] overflow-hidden rounded-[24px] border border-slate-100/80 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="text-[17px] font-bold text-slate-800">
            ทำรายการรับคืนครุภัณฑ์
          </h3>

          <button
            onClick={onClose}
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
                รหัส: {asset.code} • สถานะปัจจุบัน:{" "}
                <span className="font-bold text-amber-500">กำลังยืม</span>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#cbe7df] bg-[#e6f4f0] p-3.5 text-xs leading-relaxed font-semibold text-[#007d5a]">
            ข้อมูลการยืม: {asset.borrowerName || "ไม่ระบุ"} (
            {asset.ward || "ไม่ระบุ"}) • นำไปเมื่อ{" "}
            {asset.borrowDate || "ไม่ระบุ"}
          </div>

          <div>
            <label className="mb-2.5 block text-xs font-bold text-slate-700">
              วิธีการนำส่ง
            </label>

            <div className="flex gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="radio"
                  name="returnMethod"
                  className="sr-only"
                  checked={returnMethod === "มาส่งคืนด้วยตนเอง"}
                  onChange={() => setReturnMethod("มาส่งคืนด้วยตนเอง")}
                />
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    returnMethod === "มาส่งคืนด้วยตนเอง"
                      ? "border-[#00a96e] bg-white"
                      : "border-slate-300"
                  }`}
                >
                  {returnMethod === "มาส่งคืนด้วยตนเอง" && (
                    <div className="h-2 w-2 rounded-full bg-[#00a96e]" />
                  )}
                </div>
                มาส่งคืนด้วยตนเอง
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="radio"
                  name="returnMethod"
                  className="sr-only"
                  checked={returnMethod === "ให้เจ้าหน้าที่ไปรับคืน"}
                  onChange={() => setReturnMethod("ให้เจ้าหน้าที่ไปรับคืน")}
                />
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    returnMethod === "ให้เจ้าหน้าที่ไปรับคืน"
                      ? "border-[#00a96e] bg-white"
                      : "border-slate-300"
                  }`}
                >
                  {returnMethod === "ให้เจ้าหน้าที่ไปรับคืน" && (
                    <div className="h-2 w-2 rounded-full bg-[#00a96e]" />
                  )}
                </div>
                ให้เจ้าหน้าที่ไปรับคืน
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              หมายเหตุ (ถ้ามี)
            </label>

            <textarea
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="ระบุรายละเอียดเพิ่มเติม..."
              className="h-20 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none placeholder:text-slate-400 focus:border-[#00a96e]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-50 bg-white p-4 px-6 pb-6">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            ยกเลิก
          </button>

          <button
            onClick={handleSubmit}
            className="rounded-xl bg-[#00a96e] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#009262]"
          >
            ยืนยันการส่งคืน
          </button>
        </div>
      </div>
    </div>
  )
}
