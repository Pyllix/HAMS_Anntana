import { ChevronLeft, ChevronRight } from "lucide-react";

interface StockTablePaginationProps {
  currentPage: number; // เริ่มที่ 1
  totalPages: number;
  onPageChange: (page: number) => void;
}

// Pagination แบบเดียวกับตารางหน้ายืม-คืน (components/borrow-return/assetsTable.tsx)
export default function StockTablePagination({
  currentPage,
  totalPages,
  onPageChange,
}: StockTablePaginationProps) {
  const pageCount = Math.max(totalPages, 1);

  return (
    <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
      <div className="text-xs text-slate-500 hidden sm:block">
        หน้า <span className="font-semibold text-slate-700">{currentPage}</span>{" "}
        จาก <span className="font-semibold text-slate-700">{pageCount}</span>
      </div>

      <div className="flex items-center space-x-1.5 ml-auto sm:ml-0">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {Array.from({ length: pageCount }, (_, i) => i + 1)
          .filter((p) => Math.abs(p - currentPage) <= 2)
          .map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
                p === currentPage
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= pageCount}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
