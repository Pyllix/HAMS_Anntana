import { RepairStatusBadge } from "@/components/tracking/RepairStatusBadge"
import type { RepairRequest, RepairUrgency } from "@/types/repairTrackingTypes"

const COLUMNS = [
  "รหัสแจ้งซ่อม",
  "ข้อมูลครุภัณฑ์",
  "อาการขัดข้อง",
  "วันที่แจ้ง",
  "สถานะ",
  "จัดการ",
]

const URGENCY_COLOR: Record<RepairUrgency, string> = {
  ด่วนมาก: "text-red-500",
  ด่วน: "text-amber-500",
  ปกติ: "text-emerald-500",
}

export function RepairTable({ requests }: { requests: RepairRequest[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium text-slate-500">
            {COLUMNS.map((column) => (
              <th key={column} className="px-5 py-3">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {requests.length === 0 ? (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="py-16 text-center text-sm text-slate-400"
              >
                ไม่พบรายการที่ตรงกับเงื่อนไข
              </td>
            </tr>
          ) : (
            requests.map((request) => (
              <tr
                key={request.id}
                className="transition-colors hover:bg-slate-50"
              >
                <td className="px-5 py-3 font-semibold whitespace-nowrap text-slate-800">
                  {request.requestCode}
                </td>
                <td className="min-w-52 px-5 py-3">
                  <p className="font-medium text-slate-700">
                    {request.assetCode}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {request.assetName}
                  </p>
                </td>
                <td className="min-w-72 px-5 py-3">
                  <p className="text-slate-700">{request.problem}</p>
                  <p
                    className={`mt-1 text-xs ${URGENCY_COLOR[request.urgency]}`}
                  >
                    ความเร่งด่วน: {request.urgency}
                  </p>
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-slate-500">
                  {request.reportedAt}
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <RepairStatusBadge status={request.status} />
                </td>
                <td className="px-5 py-3">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium whitespace-nowrap text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    ดูข้อมูล
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
