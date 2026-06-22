import { useEffect } from "react"
import { X, Wrench, FlaskConical } from "lucide-react"
import type { StockAsset } from "@/types/StockType"
import { StockStatusBadge } from "@/components/inventory/StockStatusBadge"

interface Props {
  asset: StockAsset | null
  onClose: () => void
}

export function StockDetailDialog({ asset, onClose }: Props) {
  useEffect(() => {
    if (!asset) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [asset, onClose])

  if (!asset) return null

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      {/* Dialog panel */}
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">รายละเอียดครุภัณฑ์</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Asset identity */}
          <div className="flex items-start gap-4">
            {/* Icon placeholder */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <FlaskConical size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-slate-800 leading-snug">
                {asset.name} / {asset.model}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>รหัสครุภัณฑ์ (PID) <span className="font-mono font-medium text-slate-700">{asset.pid}</span></span>
                <span>หมายเลขเครื่อง (S/N) <span className="font-mono font-medium text-slate-700">{asset.serialNumber}</span></span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StockStatusBadge status={asset.status} />
                <span className="text-xs text-slate-500">หน่วยงานที่รับผิดชอบ</span>
                <span className="text-xs font-medium text-slate-700">{asset.department}</span>

              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* ข้อมูลการจัดซื้อ */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">ข้อมูลการจัดซื้อ</p>
              <InfoRow label="วันที่ตรวจรับ (RECEIVE)" value={asset.purchase.receivedDate} />
              <InfoRow
                label="บริษัทที่จัดซื้อ (COMPANY)"
                value={asset.purchase.company}
                valueClassName="font-semibold text-slate-800"
              />
              <InfoRow
                label="ราคาจัดซื้อ (KMONEY)"
                value={`${asset.purchase.price.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`}
                valueClassName="font-semibold text-emerald-600"
              />
              <InfoRow label="ประเภทเงินงบประมาณ" value={asset.purchase.budgetType} />
            </div>

            {/* การรับประกันและค่าเสื่อม */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">การรับประกันและค่าเสื่อม</p>
              <InfoRow label="วันหมดประกัน (Warranty)" value={asset.warranty.expireDate} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">สถานะประกัน</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${asset.warranty.inWarranty
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-600"
                    }`}
                >
                  {asset.warranty.inWarranty ? "อยู่ในประกัน" : "หมดประกัน"}
                </span>
              </div>
              <InfoRow label="อายุการใช้งาน (Expired)" value={`${asset.warranty.lifetimeYears} ปี`} />
              <InfoRow label="ใช้งานมาแล้ว" value={asset.warranty.usedDuration} />
            </div>
          </div>

          {/* ประวัติเครื่อง */}
          <div>
            <p className="text-sm font-semibold text-slate-800">ประวัติเครื่อง</p>
            <p className="mt-0.5 text-xs text-slate-400">
              คลิกเพื่อดูสถานะประวัติวิธีการซ่อมและการสลอบเทียมของเครื่องนี้
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50">
                <Wrench size={13} />
                ประวัติซ่อม ({asset.repairHistoryCount})
              </button>
              <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50">
                <FlaskConical size={13} />
                ประวัติการสอบเทียบ ({asset.calibrationHistoryCount})
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-100 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  valueClassName = "text-slate-700",
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={`text-xs text-right ${valueClassName}`}>{value}</span>
    </div>
  )
}
