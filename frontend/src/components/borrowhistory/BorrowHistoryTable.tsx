import type { BorrowHistoryAsset } from "@/types/borrowHistoryTypes"
import { BorrowHistoryStatusBadge } from "./BorrowHistoryStatusBadge"

interface Props {
  assets: BorrowHistoryAsset[]
}

const COLUMNS = [
  "รหัสการยืม",
  "ข้อมูลครุภัณฑ์",
  "ชื่อผู้ยืม",
  "วันที่ยืม",
  "วันที่คืน",
  "สถานะ",
]

export function BorrowHistoryTable({ assets }: Props) {
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
            assets.map((assets) => (
              <tr
                key={assets.id}
                className="transition-colors hover:bg-slate-50"
              >
                {/* รหัสการยืม */}
                <td className="px-5 py-3">
                  <span className="font-mono text-sm font-semibold text-slate-700">
                    {assets.borrowCode}
                  </span>
                </td>

                {/* ข้อมูลครุภัณฑ์ */}
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-800">
                    {assets.assetName}
                  </p>
                  <p className="text-xs text-slate-400">{assets.assetCode}</p>
                </td>

                {/* ชื่อผู้ยืม / แผนก */}
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-800">
                    {assets.borrowerName}
                  </p>
                  <p className="text-xs text-slate-400">
                    แผนก: {assets.department}
                  </p>
                </td>

                {/* วันที่ยืม */}
                <td className="px-5 py-3">
                  <p className="font-sm text-slate-800">
                    {assets.borrowDate}
                    {assets.borrowTime ? `, ${assets.borrowTime}` : ""}
                  </p>
                </td>

                {/* วันที่คืน */}
                <td className="px-5 py-3">
                  <p className="font-sm text-slate-800">
                    {assets.returnDate === "-"
                      ? "-"
                      : `${assets.returnDate}${
                          assets.returnTime ? `, ${assets.returnTime}` : ""
                        }`}
                  </p>
                </td>

                {/* สถานะ */}
                <td className="px-5 py-3">
                  <BorrowHistoryStatusBadge status={assets.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
