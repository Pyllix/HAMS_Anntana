import { Plus, CheckCircle2, XCircle } from "lucide-react"

interface SummaryData {
  total: number
  normal: number
  needsAttention: number
}

interface Props {
  summary: SummaryData
}

function SummaryCard({
  icon,
  label,
  value,
  iconBg,
  valueColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  iconBg: string
  valueColor: string
}) {
  return (
    <div className="flex flex-1 items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`mt-0.5 text-2xl font-bold ${valueColor}`}>{value}</p>
      </div>
    </div>
  )
}

export function StockSummaryCards({ summary }: Props) {
  return (
    <div className="flex gap-4">
      <SummaryCard
        icon={<Plus className="h-5 w-5 text-slate-500" />}
        label="จำนวนครุภัณฑ์ทั้งหมด (รายการ)"
        value={summary.total.toLocaleString()}
        iconBg="bg-slate-100"
        valueColor="text-slate-800"
      />
      <SummaryCard
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        label="ใช้งานได้ปกติ (รายการ)"
        value={summary.normal.toLocaleString()}
        iconBg="bg-emerald-50"
        valueColor="text-emerald-600"
      />
      <SummaryCard
        icon={<XCircle className="h-5 w-5 text-red-500" />}
        label="กำลังรอ / ซ่อม (รายการ)"
        value={summary.needsAttention.toLocaleString()}
        iconBg="bg-red-50"
        valueColor="text-red-500"
      />
    </div>
  )
}
