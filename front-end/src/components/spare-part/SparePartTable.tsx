import { useMemo, useState, useEffect } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  BatteryCharging,
  Wrench,
} from "lucide-react";
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

function ActionsCell({ row }: { row: Sparepart }) {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "ASSET_CENTER_STAFF";

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
    id: "image",
    header: "รูปภาพ",
    cell: (info) => {
      const item = info.row.original;
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 border border-gray-200 overflow-hidden text-gray-400">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : item.category === "ไฟฟ้า" || item.group?.name === "ไฟฟ้า" ? (
            <BatteryCharging className="h-5 w-5 text-gray-500" />
          ) : (
            <Wrench className="h-5 w-5 text-gray-500" />
          )}
        </div>
      );
    },
  },
  {
    id: "code",
    header: "รหัสอะไหล่",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="font-semibold text-gray-900 font-mono text-sm whitespace-nowrap">
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
        <div className="font-semibold text-gray-900 text-sm leading-snug">
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
        <span className="text-sm text-gray-600 whitespace-nowrap">
          {row.group?.name || row.category || "-"}
        </span>
      );
    },
  },
  {
    id: "brand",
    header: "ยี่ห้อ",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="text-sm text-gray-600 whitespace-nowrap">
          {row.brand || "-"}
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
          ? "text-red-600 font-bold"
          : st === "LOW"
          ? "text-amber-600 font-bold"
          : "text-gray-900 font-semibold";
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
        <span className="text-sm text-gray-600 whitespace-nowrap">
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
        <span className="text-sm text-gray-700 font-mono whitespace-nowrap">
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
  const pageSize = 6;

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
        <table className="w-full text-left border-collapse">
          <thead className="font-bold text-md">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-200">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="py-3.5 px-3.5 font-bold text-slate-900 whitespace-nowrap text-base"
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
                  className="py-8 text-center text-slate-400 text-sm whitespace-nowrap"
                >
                  กำลังโหลดข้อมูลอะไหล่...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-slate-400 text-sm whitespace-nowrap"
                >
                  ไม่พบข้อมูลอะไหล่
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="py-2.5 px-3">
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-3 border-t border-slate-100 text-sm text-slate-500">
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
