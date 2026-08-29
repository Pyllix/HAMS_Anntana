import { Pencil, Trash2 } from "lucide-react"
import type { Section } from "@/types/SectionType"

interface Props {
  sections: Section[]
  onEdit: (section: Section) => void
  onDelete: (section: Section) => void
}

const COLUMNS = [
  "รหัสแผนก / ตัวย่อ",
  "ชื่อแผนก",
  "เบอร์โทรศัพท์ภายใน",
  "อาคาร / สถานที่ตั้ง",
  "หมายเหตุ",
  "จัดการ",
]

export function DepartmentTable({ sections, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
            {COLUMNS.map((col) => (
              <th
                key={col}
                className={`px-5 py-3 ${col === "จัดการ" ? "text-center" : ""}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {sections.length === 0 ? (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="py-16 text-center text-sm font-medium text-slate-400"
              >
                ไม่พบรายการที่ตรงกับเงื่อนไข
              </td>
            </tr>
          ) : (
            sections.map((section) => (
              <tr
                key={section.id}
                className="transition-colors hover:bg-slate-50/50"
              >
                {/* รหัสแผนก */}
                <td className="px-5 py-3.5">
                  <span className="font-mono text-sm font-semibold text-slate-700">
                    {section.code}
                  </span>
                </td>

                {/* ชื่อแผนก */}
                <td className="px-5 py-3.5 font-medium text-slate-800">
                  {section.name}
                </td>

                {/* เบอร์โทร */}
                <td className="px-5 py-3.5 text-slate-500">
                  {section.tel || "-"}
                </td>

                {/* อาคาร */}
                <td className="px-5 py-3.5 text-slate-500">
                  {section.building || "-"}
                </td>

                {/* หมายเหตุ (ไม่มีใน schema — แสดง "-") */}
                <td className="px-5 py-3.5 text-slate-400">-</td>

                {/* จัดการ */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEdit(section)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 active:scale-95"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(section)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-white text-red-400 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
