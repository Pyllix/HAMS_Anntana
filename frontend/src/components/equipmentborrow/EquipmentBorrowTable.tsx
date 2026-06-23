import { Eye } from "lucide-react"
import type { Asset } from "@/types/equipmentBorrowTypes"
import { EquipmentBorrowStatusBadge } from "./EquipmentBorrowStatusBadge"

interface Props {
  assets: Asset[]
  onBorrow: (asset: Asset) => void
  onReturn: (asset: Asset) => void
}

const COLUMNS = ["รูปภาพ", "รายการ / รหัส", "ประเภท", "สถานะ", "จัดการ"]

export function EquipmentBorrowTable({ assets, onBorrow, onReturn }: Props) {
  const renderAssetIcon = (item: Asset) => {
    if (item.name.includes("BP")) {
      return (
        <div className="h-4 w-4 rounded-full border-[2.5px] border-slate-300" />
      )
    }

    if (item.name.includes("AED")) {
      return (
        <div className="h-3.5 w-5 rounded border-[2.5px] border-slate-300" />
      )
    }

    return <div className="h-3.5 w-3.5 rounded-full bg-slate-400" />
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-white text-xs font-semibold text-slate-400">
            {COLUMNS.map((col) => (
              <th
                key={col}
                className={`p-4 ${
                  col === "รูปภาพ"
                    ? "w-24 pl-6"
                    : col === "สถานะ"
                      ? "w-32"
                      : col === "จัดการ"
                        ? "w-36 text-center"
                        : ""
                }`}
              >
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
                className="py-16 text-center text-sm font-medium text-slate-400"
              >
                ไม่พบรายการที่ตรงกับเงื่อนไข
              </td>
            </tr>
          ) : (
            assets.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/40">
                <td className="p-4 pl-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400">
                    {renderAssetIcon(item)}
                  </div>
                </td>

                <td className="p-4">
                  <p className="text-[14px] font-semibold text-slate-800">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-xs tracking-wide text-slate-400">
                    {item.code}
                  </p>
                </td>

                <td className="p-4 text-xs text-slate-400">{item.type}</td>

                <td className="p-4">
                  <EquipmentBorrowStatusBadge status={item.status} />
                </td>

                <td className="p-4">
                  <div className="flex items-center justify-center gap-3">
                    {item.status === "ว่าง" ? (
                      <button
                        onClick={() => onBorrow(item)}
                        className="rounded-lg bg-[#00a96e] px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#009262]"
                      >
                        ยืมของ
                      </button>
                    ) : item.status === "กำลังยืม" ? (
                      <button
                        onClick={() => onReturn(item)}
                        className="rounded-lg border border-[#00a96e] bg-white px-4 py-1.5 text-xs font-bold text-[#00a96e] shadow-sm hover:bg-emerald-50/50"
                      >
                        ส่งคืน
                      </button>
                    ) : (
                      <button
                        disabled
                        className="cursor-not-allowed rounded-lg bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-400"
                      >
                        ส่งซ่อม
                      </button>
                    )}

                    <button className="text-slate-300 hover:text-slate-500">
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
