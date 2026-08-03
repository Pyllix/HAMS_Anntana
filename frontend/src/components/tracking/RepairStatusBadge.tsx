import type { RepairStatus } from "@/types/repairTrackingTypes"

const STATUS_CONFIG: Record<
  RepairStatus,
  { dot: string; text: string; background: string }
> = {
  รอดำเนินการ: {
    dot: "bg-amber-500",
    text: "text-amber-700",
    background: "border border-amber-200 bg-amber-50",
  },
  กำลังดำเนินการ: {
    dot: "bg-blue-500",
    text: "text-blue-700",
    background: "border border-blue-200 bg-blue-50",
  },
  รออะไหล่: {
    dot: "bg-red-500",
    text: "text-red-700",
    background: "border border-red-200 bg-red-50",
  },
  เสร็จสิ้น: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    background: "border border-emerald-200 bg-emerald-50",
  },
}

export function RepairStatusBadge({ status }: { status: RepairStatus }) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.background} ${config.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  )
}
