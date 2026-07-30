import type { Asset } from "../../types/manageBorrowTypes"
import { ManageBorrowStatusBadge } from "./ManageBorrowStatusBadge"

interface Props {
  assets: Asset[]
  onBorrow: (asset: Asset) => void
  onReturn: (asset: Asset) => void
}

const COLUMNS = [
  "รูปภาพ",
  "รายการ / รหัส",
  "ประเภท",
  "ผู้ยืม / แผนก",
  "วันที่ยืม",
  "สถานะ",
  "จัดการ",
]

export function ManageBorrowTable({ assets, onBorrow, onReturn }: Props) {
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
                {/*รูปภาพ*/}
                <td className="px-5 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-100 bg-slate-50">
                    {asset.image === "circle" ? (
                      <div className="h-4 w-4 rounded-full border-2 border-slate-300" />
                    ) : asset.image === "square" ? (
                      <div className="h-3.5 w-4 rounded-full border-2 border-slate-300" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full bg-slate-300" />
                    )}
                  </div>
                </td>

                {/*รายการ / รหัส */}
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-800">{asset.name}</p>
                  <p className="text-xs text-slate-400">{asset.code}</p>
                </td>

                {/*ประเภท*/}
                <td className="px-5 py-3">
                  <span className="font-mono text-sm text-slate-700">
                    {asset.category?.name}
                  </span>
                </td>

                {/*ผู้ยืม / แผนก */}
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-800">
                    {asset.borrower || "-"}{" "}
                  </p>
                  {asset.department && (
                    <p className="text-xs text-slate-400">{asset.department}</p>
                  )}
                </td>

                {/*วันที่ยืม */}
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-800">
                    {asset.borrowDate || "-"}
                  </p>
                </td>

                {/*สถานะ */}
                <td className="px-5 py-3">
                  <ManageBorrowStatusBadge status={asset.status} />
                </td>

                {/*ปุ่มจัดการ */}
                <td className="px-5 py-3">
                  {asset.status === "ว่าง" ? (
                    <button
                      onClick={() => onBorrow(asset)}
                      className="h-8 w-20 rounded-lg bg-[#00966c] text-xs font-bold text-white shadow-sm transition-all hover:bg-[#007d5a] active:scale-95"
                    >
                      ยืมของ
                    </button>
                  ) : asset.status === "กำลังยืม" ? (
                    <button
                      onClick={() => onReturn(asset)}
                      className="h-8 w-20 rounded-lg border border-emerald-500 bg-white text-xs font-bold text-emerald-600 shadow-sm transition-all hover:bg-emerald-50 active:scale-95"
                    >
                      รับคืน
                    </button>
                  ) : (
                    <button
                      disabled
                      className="h-8 w-20 cursor-not-allowed rounded-lg bg-slate-100 text-xs font-bold text-slate-400"
                    >
                      งดยืม
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
