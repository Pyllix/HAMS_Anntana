import type { BorrowAssetStatus } from "../../types/manageBorrowTypes"

interface Props {
  status: BorrowAssetStatus
}

const STATUS_CONFIG: Record<
  BorrowAssetStatus,
  { dot: string; text: string; bg: string }
> = {
  ว่าง: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50 border border-emerald-200",
  },
  กำลังยืม: {
    dot: "bg-slate-500",
    text: "text-slate-700",
    bg: "bg-white border border-slate-200",
  },
  ส่งซ่อม: {
    dot: "bg-red-500",
    text: "text-white",
    bg: "bg-slate-900 border border-slate-900",
  },
}

export function ManageBorrowStatusBadge({ status }: Props) {
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
