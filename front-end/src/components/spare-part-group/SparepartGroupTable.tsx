import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useDebouncedSearch, useServerPage } from "../../hooks/useServerPage";
import { getSparepartGroupsPage } from "../../services/sparepartGroupService";
import { useAuthStore } from "../../stores/authStore";
import type { SparepartGroup } from "../../types/TypeSparePart";
import StockTablePagination from "../equipment-stock/StockTablePagination";
import QueryStatus from "../shared/QueryStatus";
import SparepartGroupFormDialog from "./SparepartGroupFormDialog";
import SparepartGroupDeleteDialog from "./SparepartGroupDeleteDialog";

interface Props {
  search: string;
}

type Selection = { action: "edit" | "delete"; group: SparepartGroup } | null;

export default function SparepartGroupTable({ search }: Props) {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "PARCEL_STAFF" || role === "ASSET_CENTER_STAFF";
  const [selection, setSelection] = useState<Selection>(null);
  const debouncedSearch = useDebouncedSearch(search);
  const query = useServerPage<SparepartGroup>(
    "sparepartGroups",
    { search: debouncedSearch },
    (filters, signal) => getSparepartGroupsPage({
      page: Number(filters.page),
      limit: Number(filters.limit),
      search: String(filters.search ?? ""),
    }, signal),
    false,
    true,
    10,
  );

  return (
    <>
      <div className="flex flex-col min-h-0 h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <QueryStatus query={query} retry />
        <div className="flex-1 overflow-auto" aria-busy={query.isFetching}>
          <table className="w-full text-left border-collapse text-sm text-slate-600">
            <caption className="sr-only">รายการกลุ่มอะไหล่</caption>
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-700 tracking-wider border-b border-slate-200 shadow-sm">
              <tr>
                <th scope="col" className="py-3.5 px-4">ชื่อกลุ่มอะไหล่</th>
                <th scope="col" className="py-3.5 px-4 whitespace-nowrap text-right">จำนวนอะไหล่</th>
                {canManage && <th scope="col" className="py-3.5 px-4 w-28">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.rows.map((group) => (
                <tr key={group.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 align-middle font-bold text-slate-800 break-words min-w-40 max-w-sm">
                    {group.name}
                  </td>
                  <td className="py-3.5 px-4 align-middle text-right tabular-nums">
                    {group.sparepartsCount?.toLocaleString("th-TH") ?? "-"}
                  </td>
                  {canManage && (
                    <td className="py-3.5 px-4 align-middle">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title="แก้ไข"
                          aria-label={`แก้ไขกลุ่ม ${group.name}`}
                          disabled={query.isError}
                          onClick={() => setSelection({ action: "edit", group })}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="ลบ"
                          aria-label={`ลบกลุ่ม ${group.name}`}
                          disabled={query.isError}
                          onClick={() => setSelection({ action: "delete", group })}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {query.rows.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 3 : 2} className="text-center py-12 px-4 text-slate-400">
                    {query.isLoading
                      ? "กำลังโหลดกลุ่มอะไหล่..."
                      : query.isError
                        ? "ไม่สามารถแสดงรายการกลุ่มอะไหล่ได้"
                        : debouncedSearch ? "ไม่พบกลุ่มอะไหล่ที่ค้นหา" : "ยังไม่มีกลุ่มอะไหล่"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <StockTablePagination
          currentPage={query.page}
          totalPages={query.totalPages}
          onPageChange={query.setPage}
        />
      </div>
      {canManage && (
        <>
          <SparepartGroupFormDialog
            isOpen={selection?.action === "edit"}
            group={selection?.action === "edit" ? selection.group : null}
            onClose={() => setSelection(null)}
          />
          <SparepartGroupDeleteDialog
            isOpen={selection?.action === "delete"}
            group={selection?.action === "delete" ? selection.group : null}
            onClose={() => setSelection(null)}
          />
        </>
      )}
    </>
  );
}
