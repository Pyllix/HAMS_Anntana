import { useMemo, useState, useEffect } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPartOrders } from "../../services/partOrderService";
import type { PartOrder } from "../../Types/TypePartOrder";
import { usePartOrderModalStore } from "../../stores/usePartOrderModalStore";

const features = tableFeatures({});

// ─── Columns Definition ───────────────────────────────────────────────────────

const columns: Array<ColumnDef<typeof features, PartOrder>> = [
  {
    id: "orderNo",
    header: "รหัสคำสั่งซื้อ",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="font-bold text-slate-900 font-mono text-sm whitespace-nowrap">
          {row.orderNo}
        </span>
      );
    },
  },
  {
    id: "partDetails",
    header: "รายการอะไหล่",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="space-y-1 py-0.5 min-w-[200px] max-w-xs">
          <div className="font-bold text-slate-900 text-sm leading-snug break-words">
            {row.partName}
          </div>
          <div>
            <span className="inline-flex items-center text-3xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/50">
              ประเภท: {row.category}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    id: "requester",
    header: "ผู้ขอเบิก/หน่วยงาน",
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="text-xs space-y-0.5 whitespace-nowrap">
          <p className="font-semibold text-slate-900">{row.requesterName}</p>
          <p className="text-slate-500 text-2xs">หน่วยงาน : {row.department}</p>
        </div>
      );
    },
  },
  {
    id: "purchasingInfo",
    header: "ข้อมูลจัดซื้อ",
    cell: (info) => {
      const row = info.row.original;
      if (!row.supplier && !row.brandModel && !row.unitPrice) {
        return (
          <span className="text-xs text-slate-400 italic">
            - ยังไม่ระบุข้อมูลจัดซื้อ -
          </span>
        );
      }
      return (
        <div className="text-2xs text-slate-600 space-y-1 max-w-xs leading-relaxed">
          {row.brandModel && (
            <p>
              <span className="font-semibold text-slate-800">ยี่ห้อและรุ่น:</span>{" "}
              <span className="text-slate-700">{row.brandModel}</span>
            </p>
          )}
          {row.supplier && (
            <p>
              <span className="font-semibold text-slate-800">สั่งซื้อจากร้านค้า/บริษัท:</span>{" "}
              <span className="text-slate-700">{row.supplier}</span>
            </p>
          )}
          {row.unitPrice !== undefined && (
            <p>
              <span className="font-semibold text-slate-800">ราคาต่อหน่วย(บาท):</span>{" "}
              <span className="font-mono text-slate-900 font-medium">
                {row.unitPrice.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
              </span>
            </p>
          )}
        </div>
      );
    },
  },
  {
    id: "orderDate",
    header: "วันที่สั่งซื้อ",
    cell: (info) => {
      const row = info.row.original;
      if (!row.orderDate) {
        return <span className="text-xs text-slate-400 font-mono">-</span>;
      }
      if (row.orderDate.includes("-")) {
        const parts = row.orderDate.split("-");
        if (parts.length === 3) {
          const [y, m, d] = parts;
          const thaiYear = parseInt(y) + 543;
          return (
            <span className="text-xs text-slate-700 font-mono whitespace-nowrap">
              {d}/{m}/{thaiYear}
            </span>
          );
        }
      }
      return (
        <span className="text-xs text-slate-700 font-mono whitespace-nowrap">
          {row.orderDate}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "การดำเนินการ",
    cell: (info) => {
      const row = info.row.original;
      const { openPurchasingModal } = usePartOrderModalStore.getState();

      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <button
            type="button"
            onClick={() => openPurchasingModal(row)}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <Plus className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600" />
            เพิ่ม
          </button>
        </div>
      );
    },
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

interface PartOrderTableProps {
  search?: string;
  dateFilter?: string;
}

export default function PartOrderTable({
  search = "",
  dateFilter = "ALL",
}: PartOrderTableProps) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["partOrders"],
    queryFn: getPartOrders,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, dateFilter]);

  const filteredData = useMemo(() => {
    if (!orders) return [];
    return orders.filter((item) => {
      const sl = search.toLowerCase();
      const matchesSearch =
        search === "" ||
        item.orderNo?.toLowerCase().includes(sl) ||
        item.partName?.toLowerCase().includes(sl) ||
        item.requesterName?.toLowerCase().includes(sl) ||
        item.supplier?.toLowerCase().includes(sl);

      const matchesDate =
        !dateFilter ||
        dateFilter === "ALL" ||
        item.orderDate === dateFilter ||
        (item.orderDate && item.orderDate.startsWith(dateFilter));

      return matchesSearch && matchesDate;
    });
  }, [orders, search, dateFilter]);

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
    key: "part-order-table",
    features,
    columns,
    data: paginatedData,
  });

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/70 border-b border-slate-200/80">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="py-3.5 px-4 font-bold text-slate-800 whitespace-nowrap text-sm"
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
                  กำลังโหลดข้อมูลการสั่งซื้ออะไหล่...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-slate-400 text-sm whitespace-nowrap"
                >
                  ไม่พบข้อมูลคำสั่งซื้ออะไหล่
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="py-3 px-4 align-middle">
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
