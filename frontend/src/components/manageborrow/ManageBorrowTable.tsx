import type { Asset } from "../../types/manageBorrowTypes"
import { BORROW_CATEGORIES } from "../../mock-up/manageBorrowMockData"
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
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
            {COLUMNS.map((col) => (
              <th
                key={col}
                className={`px-5 py-3 ${col === "รูปภาพ" || col === "จัดการ" ? "text-center" : ""}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {assets.length === 0 ? (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="py-16 text-center text-sm font-medium text-slate-400"
              >
                ไม่พบรายการที่ตรงกับเงื่อนไข
              </td>
            </tr>
          ) : (
            assets.map((asset) => {
              const cat = BORROW_CATEGORIES.find(
                (c) => c.code === asset.categoryCode.code
              )
              return (
                <tr
                  key={asset.id}
                  className="transition-colors hover:bg-slate-50/50"
                >
                
                  <td className="px-5 py-3.5 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center text-base font-medium text-slate-400">
                    
                      {asset.image === "circle"
                        ? "-"
                        : asset.image === "square"
                          ? "-"
                          : asset.image === "ellipse"
                            ? "-"
                            : "-"}
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="font-bold text-slate-800">{asset.name}</div>
                    <div className="mt-0.5 font-mono text-[11px] font-medium text-slate-400">
                      {asset.id}
                    </div>
                  </td>

                  <td className="px-5 py-3.5 text-xs font-medium text-slate-500">
                    {cat ? cat.name : asset.categoryCode.code}
                  </td>

                  <td className="px-5 py-3.5 text-xs leading-relaxed font-semibold whitespace-pre-line text-slate-600">
                    {asset.borrower || "-"}
                  </td>

                  <td className="px-5 py-3.5 text-xs font-medium text-slate-500">
                    {asset.borrowDate || "-"}
                  </td>

                  <td className="px-5 py-3.5">
                    <ManageBorrowStatusBadge status={asset.status} />
                  </td>

                  <td className="px-5 py-3.5 text-center">
                    <div className="flex justify-center">
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
                          className="h-8 w-20 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
                        >
                          รับคืน
                        </button>
                      ) : (
                        <button
                          disabled
                          className="h-8 w-20 cursor-not-allowed rounded-lg bg-slate-100 text-xs font-medium text-slate-400"
                        >
                          งดยืม
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
