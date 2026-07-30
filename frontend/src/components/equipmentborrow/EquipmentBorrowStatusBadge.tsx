import type { BorrowAssetStatus } from "@/types/equipmentBorrowTypes"

interface Props {
  status: BorrowAssetStatus
}

const STATUS_CONFIG: Record<
  BorrowAssetStatus,
  { dot: string; text: string; bg: string; border: string }
> = {
  ว่าง: {
    dot: "bg-[#00a96e]",
    text: "text-[#00a96e]",
    bg: "bg-[#e6f7f0]",
    border: "border-emerald-100",
  },
  กำลังยืม: {
    dot: "bg-amber-500",
    text: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
  ส่งซ่อม: {
    dot: "bg-rose-500",
    text: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-100",
  },
}

export function EquipmentBorrowStatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  )
}
