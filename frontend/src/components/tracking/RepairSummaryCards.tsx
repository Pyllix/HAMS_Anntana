import type { RepairRequest } from "@/types/repairTrackingTypes"
import { CheckCircle2, Clock3, ListChecks, Wrench } from "lucide-react"

interface Props {
  requests: RepairRequest[]
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
  value: number
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

export function RepairSummaryCards({ requests }: Props) {
  const pending = requests.filter(
    (request) => request.status === "รอดำเนินการ"
  ).length
  const inProgress = requests.filter(
    (request) =>
      request.status === "กำลังดำเนินการ" || request.status === "รออะไหล่"
  ).length
  const completed = requests.filter(
    (request) => request.status === "เสร็จสิ้น"
  ).length

  return (
    <div className="flex gap-4">
      <SummaryCard
        icon={<ListChecks className="h-5 w-5 text-slate-500" />}
        label="รายการทั้งหมด"
        value={requests.length}
        iconBg="bg-slate-100"
        valueColor="text-slate-800"
      />
      <SummaryCard
        icon={<Clock3 className="h-5 w-5 text-amber-600" />}
        label="รอดำเนินการ"
        value={pending}
        iconBg="bg-amber-50"
        valueColor="text-amber-600"
      />
      <SummaryCard
        icon={<Wrench className="h-5 w-5 text-blue-600" />}
        label="กำลังดำเนินการ"
        value={inProgress}
        iconBg="bg-blue-50"
        valueColor="text-blue-600"
      />
      <SummaryCard
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        label="ซ่อมเสร็จสิ้น"
        value={completed}
        iconBg="bg-emerald-50"
        valueColor="text-emerald-600"
      />
    </div>
  )
}
