import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import SparepartGroupTable from "../components/spare-part-group/SparepartGroupTable";
import SparepartGroupFormDialog from "../components/spare-part-group/SparepartGroupFormDialog";

export default function SparepartGroupManagement() {
  const [search, setSearch] = useState("");
  const [isOpenAdd, setIsOpenAdd] = useState(false);
  const role = useAuthStore((state) => state.role);
  const canManage = role === "PARCEL_STAFF" || role === "ASSET_CENTER_STAFF";

  return (
    <div className="flex flex-col min-h-0 h-full space-y-4 md:space-y-6">
      <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 bg-bg-component shadow-sm w-full rounded-lg p-4">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1F2937]/40"
          />
          <input
            type="search"
            aria-label="ค้นหากลุ่มอะไหล่"
            placeholder="ค้นหาชื่อกลุ่มอะไหล่..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
          />
        </div>
        {canManage && (
          <div className="w-full md:w-auto md:ml-auto">
            <button
              type="button"
              onClick={() => setIsOpenAdd(true)}
              className="inline-flex w-full items-center justify-center gap-3 bg-[#009660] hover:bg-[#007f51] text-white font-medium px-4 py-2 rounded-2xl shadow-sm transition-all duration-200 active:scale-95"
            >
              <Plus aria-hidden="true" className="w-5 h-5" />
              <span className="text-xl">เพิ่มกลุ่มอะไหล่ใหม่</span>
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden border-none">
        <SparepartGroupTable search={search} />
      </div>
      {canManage && (
        <SparepartGroupFormDialog
          isOpen={isOpenAdd}
          onClose={() => setIsOpenAdd(false)}
        />
      )}
    </div>
  );
}
