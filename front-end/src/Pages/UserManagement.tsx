import UserTable from "../components/user-management/UserTable";
import InputSearch from "../components/user-management/InputSearch";
import RoleFilter from "../components/user-management/RoleFilter";
import StatusFilter, {
  StatusFilterValue,
} from "../components/user-management/StatusFilter";
import BtnAdd from "../components/user-management/BtnAdd";
import DialogAddUser from "../components/user-management/DialogAddUser";
import { useState } from "react";
import { RoleType } from "../router/roles";

export default function UserManagement() {
  const [isOpenAdd, setIsOpenAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleType | "">("");
  const [status, setStatus] = useState<StatusFilterValue>("");

  return (
    // 1. เพิ่ม flex flex-col และ h-full เพื่อเตรียมให้ Table ขยายเต็มพื้นที่ที่เหลือ
    <div className="flex flex-col h-full space-y-4 md:space-y-6">
      {/* Search & Filter Bar */}
      {/* 2. เพิ่ม flex-wrap, md:flex-row และจัด items-center */}
      <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 bg-bg-component shadow-sm w-full rounded-lg p-4">
        <InputSearch value={search} onChange={setSearch} />
        <RoleFilter value={role} onChange={setRole} />
        <StatusFilter value={status} onChange={setStatus} />
        <div className="md:ml-auto">
          <BtnAdd clickOpen={() => setIsOpenAdd(true)} />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden border-none">
        <UserTable search={search} role={role} status={status} />
      </div>

      <DialogAddUser
        isOpenAdd={isOpenAdd}
        onClose={() => setIsOpenAdd(false)}
      />
    </div>
  );
}
