import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Asset } from "../../Types/TypeAsset";

import { useAssetDetailModalStore } from "../../stores/useAssetDetailModalStore";
import { useAuthStore } from "../../stores/authStore";
import { ROLES } from "../../router/roles";

const features = tableFeatures({});

interface StockAssetsTableProps {
  assets?: Asset[];
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isAssetCenter?: boolean;
}

export default function StockAssetsTable({
  assets = [],
  isLoading = false,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  isAssetCenter: isAssetCenterProp,
}: StockAssetsTableProps) {
  const role = useAuthStore((state) => state.role);
  const isAssetCenter =
    isAssetCenterProp ??
    (role === ROLES.ADMIN || role === ROLES.ASSET_CENTER_STAFF);

  const columns = useMemo<Array<ColumnDef<typeof features, Asset>>>(() => {
    const cols: Array<ColumnDef<typeof features, Asset>> = [
      {
        id: "pid",
        header: "รหัสครุภัณฑ์ (PID)",
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="font-semibold text-gray-900 text-sm font-mono">
              {row.noid || row.id}
            </span>
          );
        },
      },
      {
        id: "name_model",
        header: "ชื่อครุภัณฑ์ / ยี่ห้อ-รุ่น",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <div className="font-semibold text-gray-900">{row.name}</div>
              <div className="text-sm text-gray-400 font-mono mt-0.5">
                {row.model || row.company?.name || "-"}
              </div>
            </div>
          );
        },
      },
      {
        id: "serialNo",
        header: "หมายเลขเครื่อง (S/N)",
        cell: (info) => (
          <span className="text-sm text-gray-600 font-mono">
            {info.row.original.serialNo || "-"}
          </span>
        ),
      },
    ];

    // แสดงคอลัมน์ "หน่วยงานที่รับผิดชอบ" เฉพาะเจ้าหน้าที่ศูนย์ครุภัณฑ์ / Admin
    if (isAssetCenter) {
      cols.push({
        id: "department_location",
        header: "หน่วยงานที่รับผิดชอบ",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <div className="text-sm font-medium text-gray-900">
                {row.section?.name ?? "-"}
              </div>
              {row.section?.building && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {row.section.building}
                </div>
              )}
            </div>
          );
        },
      });
    }

    cols.push(
      {
        id: "status",
        header: "สถานะ",
        cell: (info) => {
          const status = info.row.original.status;
          const code = status?.code;
          const name = status?.name ?? "-";

          const getStatusStyle = (statusCode?: string) => {
            switch (statusCode) {
              case "NORMAL":
                return "border-emerald-500 text-emerald-700 bg-emerald-50/70";
              case "DAMAGED":
              case "LOST":
                return "border-rose-400 text-rose-700 bg-rose-50/70";
              case "UNDER_REPAIR":
              case "WAIT_DISPOSAL":
                return "border-amber-400 text-amber-700 bg-amber-50/70";
              case "DISPOSAL":
                return "border-slate-400 text-slate-700 bg-slate-50/70";
              default:
                return "border-gray-300 text-gray-700 bg-gray-50";
            }
          };

          const getDotColor = (statusCode?: string) => {
            switch (statusCode) {
              case "NORMAL":
                return "bg-emerald-500";
              case "DAMAGED":
              case "LOST":
                return "bg-rose-500";
              case "UNDER_REPAIR":
              case "WAIT_DISPOSAL":
                return "bg-amber-500";
              case "DISPOSAL":
                return "bg-slate-500";
              default:
                return "bg-gray-400";
            }
          };

          return (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium border ${getStatusStyle(
                code
              )}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${getDotColor(code)}`} />
              {name}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "จัดการ",
        cell: (info) => (
          <button
            type="button"
            onClick={() =>
              useAssetDetailModalStore.getState().openModal(info.row.original)
            }
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 transition-colors shadow-xs cursor-pointer"
          >
            รายละเอียด
          </button>
        ),
      }
    );

    return cols;
  }, [isAssetCenter]);
  const table = useTable({
    key: "stock-assets-table",
    features,
    columns,
    data: assets,
  });

  const visiblePages = useMemo(() => {
    if (totalPages <= 3) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 2) {
      return [1, 2, 3];
    }
    if (currentPage >= totalPages - 1) {
      return [totalPages - 2, totalPages - 1, totalPages];
    }
    return [currentPage - 1, currentPage, currentPage + 1];
  }, [currentPage, totalPages]);

  // Custom Horizontal Scrollbar logic
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [thumbWidthPercent, setThumbWidthPercent] = useState(25);
  const [canScroll, setCanScroll] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);

  // Sync scroll position from table to custom thumb
  const handleTableScroll = useCallback(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll > 0) {
      setScrollProgress(el.scrollLeft / maxScroll);
    } else {
      setScrollProgress(0);
    }
  }, []);

  // Update track/thumb sizes whenever content or container resizes
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;

    const measure = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll > 2) {
        setCanScroll(true);
        const ratio = el.clientWidth / el.scrollWidth;
        setThumbWidthPercent(Math.max(15, Math.min(85, ratio * 100)));
        setScrollProgress(el.scrollLeft / maxScroll);
      } else {
        setCanScroll(false);
        setScrollProgress(0);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [assets, currentPage, isAssetCenter]);

  // Handle clicking anywhere on the custom track
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !tableContainerRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const maxScroll = tableContainerRef.current.scrollWidth - tableContainerRef.current.clientWidth;
    tableContainerRef.current.scrollTo({
      left: clickRatio * maxScroll,
      behavior: "smooth",
    });
  };

  // Handle dragging the custom thumb
  const handleThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = tableContainerRef.current?.scrollLeft || 0;

    const handlePointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current || !tableContainerRef.current || !trackRef.current) return;
      const deltaX = ev.clientX - dragStartXRef.current;
      const trackWidth = trackRef.current.clientWidth;
      const maxScroll = tableContainerRef.current.scrollWidth - tableContainerRef.current.clientWidth;
      const scrollableTrackWidth = trackWidth * (1 - thumbWidthPercent / 100);
      if (scrollableTrackWidth <= 0) return;
      const scrollDelta = (deltaX / scrollableTrackWidth) * maxScroll;
      tableContainerRef.current.scrollLeft = dragStartScrollLeftRef.current + scrollDelta;
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <div
        ref={tableContainerRef}
        onScroll={handleTableScroll}
        className="flex-1 overflow-auto min-h-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <table className="w-full text-left min-w-[950px]">
          <thead className="font-bold text-md border-b border-slate-200 bg-white sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-2 px-4 font-bold text-slate-800 text-sm whitespace-nowrap">
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
                <td colSpan={columns.length} className="py-8 text-center text-slate-400 text-sm">
                  กำลังโหลดข้อมูลครุภัณฑ์...
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-slate-400 text-sm">
                  ไม่พบข้อมูลครุภัณฑ์
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="py-2 px-4 align-middle text-sm">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Custom Horizontal Scrollbar for Main Table */}
      {canScroll && (
        <div className="shrink-0 px-6 pt-2 pb-2 bg-white select-none">
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            className="group relative h-2 w-full rounded-full bg-slate-100 hover:bg-slate-200/70 transition-colors cursor-pointer"
            title="คลิกหรือลากเพื่อเลื่อนดูตารางแนวนอน"
          >
            <div
              onPointerDown={handleThumbPointerDown}
              style={{
                width: `${thumbWidthPercent}%`,
                left: `${scrollProgress * (100 - thumbWidthPercent)}%`,
              }}
              className="absolute top-0 bottom-0 rounded-full bg-slate-300 group-hover:bg-slate-400 hover:!bg-emerald-500 active:!bg-emerald-600 cursor-grab active:cursor-grabbing transition-colors shadow-2xs"
            />
          </div>
        </div>
      )}

      {/* Pagination & Summary footer */}
      <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-2.5 border-t border-slate-100 text-sm text-slate-500 bg-white">
        <div>
          แสดง {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} ถึง{" "}
          {Math.min(currentPage * pageSize, totalItems)} จาก {totalItems.toLocaleString()}{" "}
          รายการ
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {visiblePages.map((page) => (
            <button
              key={page}
              type="button"
              disabled={isLoading}
              onClick={() => onPageChange(page)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${currentPage === page
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
