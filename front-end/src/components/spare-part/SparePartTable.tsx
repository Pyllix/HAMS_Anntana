import { useMemo, useState, useEffect } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSpareParts } from "../../services/sparepartService";
import type { Sparepart } from "../../Types/TypeSparePart";
import { getSparePartStatus } from "../../Types/TypeSparePart";
import {
  useSparePartDetailModalStore,
  useSparePartFormModalStore,
  useSparePartDeleteModalStore,
} from "../../stores/useSparePartModalStore";
import { useAuthStore } from "../../stores/authStore";
import StockTablePagination from "../equipment-stock/StockTablePagination";

const features = tableFeatures({});

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StockStatusBadge({ item }: { item: Sparepart }) {
  const s = getSparePartStatus(item);
  const getStatusStyle = (statusCode: string) => {
    switch (statusCode) {
      case "NORMAL":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "LOW":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "OUT":
      default:
        return "bg-rose-100 text-rose-700 border-rose-200";
    }
  };

  const labelMap = {
    NORMAL: "ปกติ",
    LOW: "ต้องสั่งเพิ่ม",
    OUT: "ของหมด",
  };

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[90px] px-3 py-1 text-xs font-semibold rounded-full border ${getStatusStyle(
        s,
      )}`}
    >
      {labelMap[s]}
    </span>
  );
}

function ActionsCell({ row }: { row: Sparepart }) {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "ASSET_CENTER_STAFF" || role === "ADMIN";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        title="ดูรายละเอียด"
        onClick={() => useSparePartDetailModalStore.getState().openModal(row)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <Eye className="h-4 w-4" />
      </button>
      {canManage && (
        <>
          <button
            type="button"
            title="แก้ไข"
            onClick={() => useSparePartFormModalStore.getState().openEdit(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="ลบ"
            onClick={() => useSparePartDeleteModalStore.getState().openDelete(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const columns: Array<ColumnDef<typeof features, Sparepart>> = [
  {
    id: "code",
    header: "รหัสอะไหล่",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="font-semibold text-slate-800 font-mono whitespace-nowrap">
          {row.code}
        </span>
      );
    },
  },
  {
    id: "name",
    header: "ชื่ออะไหล่",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="font-semibold text-slate-800 leading-snug line-clamp-2 min-w-[200px] max-w-[300px] lg:max-w-[400px] whitespace-normal">
          {row.name}
        </div>
      );
    },
  },
  {
    id: "category",
    header: "หมวดหมู่",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="text-sm text-slate-600 whitespace-nowrap">
          {row.group?.name || row.category || "-"}
        </span>
      );
    },
  },
  {
    id: "qty",
    header: "คงเหลือ",
    cell: (info) => {
      const row = info.row.original;
      const st = getSparePartStatus(row);
      const color =
        st === "OUT"
          ? "text-rose-600 font-bold"
          : st === "LOW"
          ? "text-amber-600 font-bold"
          : "text-slate-800 font-semibold";
      return (
        <span className={`text-sm whitespace-nowrap ${color}`}>
          {row.qtyInStock} {row.unit || "ชิ้น"}
        </span>
      );
    },
  },
  {
    id: "minStock",
    header: "จุดสั่งซื้อขั้นต่ำ",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="text-sm text-slate-600 whitespace-nowrap">
          {row.minStock}
        </span>
      );
    },
  },
  {
    id: "price",
    header: "ราคา/หน่วย",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="text-sm text-slate-700 font-mono whitespace-nowrap">
          {Number(row.price).toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      );
    },
  },
  {
    id: "status",
    header: "สถานะ",
    cell: (info) => (
      <div className="whitespace-nowrap">
        <StockStatusBadge item={info.row.original} />
      </div>
    ),
  },
  {
    id: "actions",
    header: "จัดการ",
    cell: (info) => <ActionsCell row={info.row.original} />,
  },
];

interface SparePartTableProps {
  search?: string;
  category?: string;
  stockStatus?: string;
}

export default function SparePartTable({
  search = "",
  category = "ALL",
  stockStatus = "ALL",
}: SparePartTableProps) {
  const { data: spareParts, isLoading } = useQuery({
    queryKey: ["spareParts"],
    queryFn: getSpareParts,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, category, stockStatus]);

  const filteredData = useMemo(() => {
    if (!spareParts) return [];
    return spareParts.filter((item) => {
      const sl = search.toLowerCase();
      const matchesSearch =
        search === "" ||
        item.name?.toLowerCase().includes(sl) ||
        item.code?.toLowerCase().includes(sl);
      const matchesCategory =
        category === "ALL" ||
        item.category === category ||
        item.group?.name === category;
      const matchesStatus =
        stockStatus === "ALL" || getSparePartStatus(item) === stockStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [spareParts, search, category, stockStatus]);

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = useMemo(
    () =>
      filteredData.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
      ),
    [filteredData, currentPage],
  );

  const table = useTable({
    key: "spare-part-table",
    features,
    columns,
    data: paginatedData,
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex-1 min-h-0 table-scroll">
        <table className="w-full text-left border-collapse text-sm text-slate-600">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="py-3.5 px-4"
                  >
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12 text-slate-400"
                >
                  กำลังโหลดข้อมูลอะไหล่...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12 text-slate-400"
                >
                  ไม่พบข้อมูลอะไหล่
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="py-3.5 px-4 whitespace-nowrap align-middle">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <StockTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
