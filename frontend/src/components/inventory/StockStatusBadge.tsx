import type { StockAssetStatus } from "@/types/StockType"

interface Props {
  status: StockAssetStatus
}

const STATUS_CONFIG: Record<
  StockAssetStatus,
  { dot: string; text: string; bg: string }
> = {
  ใช้งานปกติ: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50 border border-emerald-200",
  },
  สภาพชำรุด: {
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50 border border-red-200",
  },
  รอจำหน่าย: {
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50 border border-amber-200",
  },
  ส่งคืนคลัง: {
    dot: "bg-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-50 border border-blue-200",
  },
}

export function StockStatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  )
}
