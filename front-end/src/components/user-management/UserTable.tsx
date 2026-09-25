import {
  ColumnDef,
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useEffect, useMemo } from "react";
import type { User } from "../../types/TypeUser";
import { useQuery } from "@tanstack/react-query";
import { getAllUser } from "../../services/userService";

import UserInfo from "./table-compnent/UserInfo";
import Actions from "./table-compnent/Actions";
import Section from "./table-compnent/Section";
import { ROLES, RoleType } from "../../router/roles";
import type { StatusFilterValue } from "./StatusFilter";

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

const columns: Array<ColumnDef<typeof features, User>> = [
  // 1. รหัสพนักงาน
  {
    accessorKey: "employeeId",
    header: "รหัสผู้ใช้",
    cell: (info) => (
      <span className="font-mono text-sm font-medium text-slate-800">
        {(info.getValue() as string) || "-"}
      </span>
    ),
  },

  // 2. รูปโปรไฟล์ + ชื่อ-นามสกุล / ชื่อผู้ใช้
  {
    id: "userInfo",
    header: "ชื่อ-นามสกุล / อีเมล",
    cell: (info) => {
      const row = info.row.original;
      const fullName =
        `${row.firstname || ""} ${row.lastname || ""}`.trim() || "-";

      return <UserInfo row={row} fullName={fullName} />;
    },
  },

  // 3. หน่วยงาน / สังกัด
  {
    id: "section",
    header: "หน่วยงาน",
    cell: (info) => {
      const row = info.row.original;
      const sectionId = row.section_id;
      return <Section sectionId={sectionId} />;
    },
  },
  {
    accessorKey: "role",
    header: "บทบาท",
    cell: (info) => {
      const role = (info.getValue() as string) || "";

      // แมปชื่อบทบาทภาษาไทย
      const roleLabels: Record<string, string> = {
        [ROLES.ADMIN]: "ผู้ดูแลระบบ",
        [ROLES.MANAGER]: "ผู้จัดการ / หัวหน้างาน",
        [ROLES.MAINTENANCE_HEAD]: "หัวหน้าช่างซ่อมบำรุง",
        [ROLES.MAINTENANCE_STAFF]: "ช่างซ่อมบำรุง",
        [ROLES.ASSET_CENTER_STAFF]: "เจ้าหน้าที่ศูนย์สินทรัพย์",
        [ROLES.PARCEL_STAFF]: "เจ้าหน้าที่พัสดุ",
        [ROLES.DEPARTMENT_STAFF]: "เจ้าหน้าที่ประจำแผนก",
      };

      const label = roleLabels[role] || role || "ผู้ใช้งานทั่วไป";

      return (
        <span className="inline-flex items-center justify-center px-3.5 py-1 text-xs font-medium rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm">
          {label}
        </span>
      );
    },
  },
  // 6. สถานะการใช้งาน (จุดสี + ข้อความสถานะ)
  {
    id: "status",
    header: "สถานะ",
    cell: (info) => {
      const isBanned = info.row.original.banned;

      return (
        <div className="inline-flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isBanned ? "bg-slate-400" : "bg-emerald-500"
            }`}
          />
          <span
            className={`text-sm font-medium ${
              isBanned ? "text-slate-500" : "text-emerald-600"
            }`}
          >
            {isBanned ? "ระงับการใช้งาน" : "ใช้งานปกติ"}
          </span>
        </div>
      );
    },
  },

  // 7. จัดการ (Icon Actions: ดู, แก้ไข, ลบ)
  {
    id: "actions",
    header: "จัดการ",
    cell: (info) => {
      const row = info.row.original;

      return <Actions row={row} />;
    },
  },
];

interface UserTableProps {
  search: string;
  role: RoleType | "";
  status: StatusFilterValue;
}

export default function UserTable({ search, role, status }: UserTableProps) {
  const { data: users } = useQuery({
    queryKey: ["assets"],
    queryFn: () => getAllUser(),
  });

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (users ?? []).filter((user) => {
      if (role && user.role !== role) return false;
      if (status === "active" && user.banned) return false;
      if (status === "banned" && !user.banned) return false;

      if (!term) return true;

      return [
        user.employeeId,
        user.userName,
        user.firstname,
        user.lastname,
        user.email,
      ].some((field) => field?.toLowerCase().includes(term));
    });
  }, [users, search, role, status]);

  const table = useTable({
    key: "assets-table",
    features,
    columns,
    data: filteredUsers,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
  });

  // กลับไปหน้าแรกทุกครั้งที่ผลลัพธ์การค้นหา/กรองเปลี่ยน
  useEffect(() => {
    table.setPageIndex(0);
  }, [search, role, status]);

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

      {/* กล่อง Pagination (ที่คุณลืมใส่กรอบครอบไว้) */}
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
          {/* ปุ่ม Previous (ที่หายไป) */}
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
