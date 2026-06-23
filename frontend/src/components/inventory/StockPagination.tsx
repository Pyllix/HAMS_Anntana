import { ChevronLeft, ChevronRight } from "lucide-react"

interface Props {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function StockPagination({ page, pageSize, total, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, total)

  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
      {/* จำนวนแถว */}
      <p className="text-sm text-slate-400">
        แสดง{" "}
        <span className="font-medium text-slate-600">{from}</span> ถึง{" "}
        <span className="font-medium text-slate-600">{to}</span> จาก{" "}
        <span className="font-medium text-slate-600">
          {total.toLocaleString()}
        </span>{" "}
        รายการ
      </p>

      {/* ปุ่ม pagination */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(
          (n) => (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                n === safePage
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {n}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
