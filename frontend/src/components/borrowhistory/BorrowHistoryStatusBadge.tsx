import type { BorrowHistoryStatus } from "@/types/borrowHistoryTypes"

interface Props {
  status: BorrowHistoryStatus
}

const STATUS_CONFIG: Record<
  BorrowHistoryStatus,
  { dot: string; text: string; bg: string }
> = {
  คืนแล้ว: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50 border border-emerald-200",
  },
  ยังไม่คืน: {
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50 border border-amber-200",
  },
}

export function BorrowHistoryStatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return null

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  )
}
