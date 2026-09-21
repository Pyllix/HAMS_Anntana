import UserTable from "../components/user-management/UserTable";

export default function UserManagement() {
  return (
    // 1. เพิ่ม flex flex-col และ h-full เพื่อเตรียมให้ Table ขยายเต็มพื้นที่ที่เหลือ
    <div className="flex flex-col h-full space-y-4 md:space-y-6">
      {/* Search & Filter Bar */}
      {/* 2. เพิ่ม flex-wrap, md:flex-row และจัด items-center */}
      <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 bg-bg-component shadow-sm w-full rounded-lg p-4"></div>

      {/* Table */}
      <div className="flex-1 overflow-hidden border-none">
        <UserTable />
      </div>
    </div>
  );
}
