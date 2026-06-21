import { StockStatusBadge } from "@/components/inventory/StockStatusBadge"
import type { StockAsset } from "@/types/StockType"

interface Props {
  assets: StockAsset[]
}

const COLUMNS = [
  "รหัสครุภัณฑ์ (PID)",
  "ชื่อครุภัณฑ์ / ยี่ห้อ-รุ่น",
  "หมายเลขเครื่อง (S/N)",
  "หน่วยงานที่รับผิดชอบ",
  "สถานะ",
  "จัดการ",
]

export function StockTable({ assets }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium text-slate-500">
            {COLUMNS.map((col) => (
              <th key={col} className="px-5 py-3">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assets.length === 0 ? (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="py-16 text-center text-sm text-slate-400"
              >
                ไม่พบรายการที่ตรงกับเงื่อนไข
              </td>
            </tr>
          ) : (
            assets.map((asset) => (
              <tr
                key={asset.id}
                className="transition-colors hover:bg-slate-50"
              >
                {/* PID */}
                <td className="px-5 py-3">
                  <span className="font-mono text-sm font-semibold text-slate-700">
                    {asset.pid}
                  </span>
                </td>

                {/* ชื่อ / รุ่น */}
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-800">{asset.name}</p>
                  <p className="text-xs text-slate-400">{asset.model}</p>
                </td>

                {/* S/N */}
                <td className="px-5 py-3">
                  <span className="font-mono text-slate-500">
                    {asset.serialNumber}
                  </span>
                </td>

                {/* หน่วยงาน */}
                <td className="px-5 py-3">
                  <p className="text-slate-700">{asset.department}</p>
                  <p className="text-xs text-slate-400">{asset.location}</p>
                </td>

                {/* สถานะ */}
                <td className="px-5 py-3">
                  <StockStatusBadge status={asset.status} />
                </td>

                {/* จัดการ */}
                <td className="px-5 py-3">
                  {/* TODO: ต่อ router ไปหน้า /inventory/:id */}
                  <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50">
                    รายละเอียด
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
