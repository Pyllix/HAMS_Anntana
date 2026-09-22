import {
  ColumnDef,
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useEffect, useMemo } from "react";
import type { Department } from "../../types/TypeDepartment";
import { useQuery } from "@tanstack/react-query";
import { getAllDepartment } from "../../services/departmentService";

import Actions from "./table-compnent/Actions";

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

const columns: Array<ColumnDef<typeof features, Department>> = [
  // 1. รหัสแผนก / ตัวย่อ
  {
    accessorKey: "code",
    header: "รหัสแผนก / ตัวย่อ",
    cell: (info) => (
      <span className="font-mono text-sm font-bold text-slate-800">
        {(info.getValue() as string) || "-"}
      </span>
    ),
  },

  // 2. ชื่อแผนก
  {
    accessorKey: "name",
    header: "ชื่อแผนก",
    cell: (info) => (
      <span className="text-sm font-bold text-slate-800">
        {(info.getValue() as string) || "-"}
      </span>
    ),
  },

  // 3. เบอร์โทรศัพท์ภายใน
  {
    accessorKey: "tel",
    header: "เบอร์โทรศัพท์ภายใน",
    cell: (info) => (
      <span className="text-sm text-slate-600">
        {(info.getValue() as string) || "-"}
      </span>
    ),
  },

  // 4. อาคาร / สถานที่ตั้ง
  {
    accessorKey: "building",
    header: "อาคาร / สถานที่ตั้ง",
    cell: (info) => (
      <span className="text-sm text-slate-600">
        {(info.getValue() as string) || "-"}
      </span>
    ),
  },

  // 5. หมายเหตุ (ยังไม่มีข้อมูลนี้ในระบบหลังบ้าน)
  {
    id: "remark",
    header: "หมายเหตุ",
    cell: () => <span className="text-sm text-slate-400">-</span>,
  },

  // 6. จัดการ (Icon Actions: แก้ไข, ลบ)
  {
    id: "actions",
    header: "จัดการ",
    cell: (info) => {
      const row = info.row.original;

      return <Actions row={row} />;
    },
  },
];

interface DepartmentTableProps {
  search: string;
}

export default function DepartmentTable({ search }: DepartmentTableProps) {
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => getAllDepartment(),
  });

  const filteredDepartments = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return departments ?? [];

    return (departments ?? []).filter((department) =>
      [department.code, department.name].some((field) =>
        field?.toLowerCase().includes(term),
      ),
    );
  }, [departments, search]);

  const table = useTable({
    key: "departments-table",
    features,
    columns,
    data: filteredDepartments,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
  });

  // กลับไปหน้าแรกทุกครั้งที่ผลลัพธ์การค้นหาเปลี่ยน
  useEffect(() => {
    table.setPageIndex(0);
  }, [search]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* พื้นที่ตาราง Scroll ได้ */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-sm text-slate-600">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-3.5 px-4 ">
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="py-3.5 px-4 whitespace-nowrap align-middle"
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12 text-slate-400"
                >
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* กล่อง Pagination */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
        {/* ข้อความบอกจำนวนหน้า */}
        <div className="text-xs text-slate-500 hidden sm:block">
          หน้า{" "}
          <span className="font-semibold text-slate-700">
            {table.state.pagination.pageIndex + 1}
          </span>{" "}
          จาก{" "}
          <span className="font-semibold text-slate-700">
            {table.getPageCount() || 1}
          </span>
        </div>

        {/* กลุ่มปุ่มเปลี่ยนหน้า */}
        <div className="flex items-center space-x-1.5 ml-auto sm:ml-0">
          {/* ปุ่ม Previous */}
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* ปุ่มตัวเลขหน้า */}
          {Array.from({ length: table.getPageCount() }, (_, index) => {
            const pageNumber = index + 1;
            const currentPage = table.state.pagination.pageIndex;
            const isCurrentPage = currentPage === index;

            if (index < currentPage - 2 || index > currentPage + 2) return null;

            return (
              <button
                key={pageNumber}
                type="button"
                onClick={() => table.setPageIndex(index)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
                  isCurrentPage
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {pageNumber}
              </button>
            );
          })}

          {/* ปุ่ม Next */}
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
