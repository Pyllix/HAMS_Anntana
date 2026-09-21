import DepartmentTable from "../components/department-management/DepartmentTable";
import InputSearchDepartment from "../components/department-management/InputSearchDepartment";
import BtnAddDepartment from "../components/department-management/BtnAddDepartment";
import DialogAddDepartment from "../components/department-management/DialogAddDepartment";
import { useState } from "react";

export default function DepartmentManagement() {
  const [isOpenAdd, setIsOpenAdd] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-col h-full space-y-4 md:space-y-6">
      {/* Search & Filter Bar */}
      <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 bg-bg-component shadow-sm w-full rounded-lg p-4">
        <InputSearchDepartment value={search} onChange={setSearch} />
        <div className="md:ml-auto">
          <BtnAddDepartment clickOpen={() => setIsOpenAdd(true)} />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden border-none">
        <DepartmentTable search={search} />
      </div>

      <DialogAddDepartment
        isOpenAdd={isOpenAdd}
        onClose={() => setIsOpenAdd(false)}
      />
    </div>
  );
}
