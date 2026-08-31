import { useMemo, useState, useEffect } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSpareParts } from "../../services/sparepartService";
import type { Sparepart } from "../../types/TypeSparePart";
import { getSparePartStatus } from "../../types/TypeSparePart";
import {
  useSparePartDetailModalStore,
  useSparePartFormModalStore,
  useSparePartDeleteModalStore,
} from "../../stores/useSparePartModalStore";

const features = tableFeatures({});

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StockStatusBadge({ item }: { item: Sparepart }) {
  const s = getSparePartStatus(item);
  const getStatusStyle = (statusCode: string) => {
    switch (statusCode) {
      case "NORMAL":
        return "bg-emerald-100 text-emerald-700";
      case "LOW":
        return "bg-amber-100 text-amber-700";
      case "OUT":
      default:
        return "bg-red-100 text-red-700";
    }
  };

  const labelMap = {
    NORMAL: "ปกติ",
    LOW: "ต้องสั่งเพิ่ม",
    OUT: "ของหมด",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${getStatusStyle(
        s,
      )}`}
    >
      {labelMap[s]}
    </span>
  );
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const columns: Array<ColumnDef<typeof features, Sparepart>> = [
  {
    accessorKey: "imageUrl",
    header: "รูปภาพ",
    cell: (info) => (
      <img
        src={(info.getValue() as string) || "/placeholder.png"}
        alt="Sparepart"
        className="h-10 w-10 rounded-md object-cover bg-gray-100 border border-gray-200"
      />
    ),
  },
  {
    id: "code",
    header: "รหัสอะไหล่",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="font-semibold text-gray-900 font-mono text-sm">
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
        <div className="font-semibold text-gray-900 text-sm">{row.name}</div>
      );
    },
  },
  {
    id: "category",
    header: "หมวดหมู่",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="text-sm text-gray-600">
          {row.category || row.group?.name || "-"}
        </span>
      );
    },
  },
  {
    id: "brand",
    header: "ยี่ห้อ",
    cell: (info) => {
      const row = info.row.original;
      return <span className="text-sm text-gray-600">{row.brand || "-"}</span>;
    },
  },
  {
    id: "qty",
    header: "คงเหลือ",
    cell: (info) => {
      const row = info.row.original;
      const st = getSparePartStatus(row);
      const colorMap = {
        NORMAL: "text-gray-900 font-medium",
        LOW: "text-amber-600 font-semibold",
        OUT: "text-red-600 font-semibold",
      };
      return (
        <span className={`text-sm ${colorMap[st]}`}>
          {row.qtyInStock} {row.unit || "หน่วย"}
        </span>
      );
    },
  },
  {
    id: "minStock",
    header: "จุดสั่งซื้อขั้นต่ำ",
    cell: (info) => {
      const row = info.row.original;
      return <span className="text-sm text-gray-600">{row.minStock}</span>;
    },
  },
  {
    id: "price",
    header: "ราคา/หน่วย",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="text-sm text-gray-900">
          {Number(row.price).toLocaleString("th-TH", {
            minimumFractionDigits: 2,
          })}
        </span>
      );
    },
  },
  {
    id: "status",
    header: "สถานะ",
    cell: (info) => <StockStatusBadge item={info.row.original} />,
  },
  {
    id: "actions",
    header: "จัดการ",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="ดูรายละเอียด"
            onClick={() =>
              useSparePartDetailModalStore.getState().openModal(row)
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="แก้ไข"
            onClick={() =>
              useSparePartFormModalStore.getState().openEdit(row)
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="ลบ"
            onClick={() =>
              useSparePartDeleteModalStore.getState().openDelete(row)
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      );
    },
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
        item.code?.toLowerCase().includes(sl) ||
        item.brand?.toLowerCase().includes(sl);
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
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="font-bold text-md">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-200">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-3 px-4">
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
                  className="py-8 text-center text-slate-400 text-sm"
                >
                  กำลังโหลดข้อมูลอะไหล่...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-slate-400 text-sm"
                >
                  ไม่พบข้อมูลอะไหล่
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="py-3 px-4">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 text-sm text-slate-500">
        <div>
          แสดง {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} ถึง{" "}
          {Math.min(currentPage * pageSize, totalItems)} จาก{" "}
          {totalItems.toLocaleString()} รายการ
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, currentPage - 3), currentPage + 2)
            .map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  currentPage === page
                    ? "bg-emerald-600 font-semibold text-white shadow-sm"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
