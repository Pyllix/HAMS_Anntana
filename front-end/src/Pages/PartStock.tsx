import { useState } from "react";
import { Search, ChevronDown, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSparepartGroups } from "../services/sparepartService";
import SparePartTable from "../components/spare-part/SparePartTable";
import {
  SparePartDetailModal,
  SparePartFormModal,
  SparePartDeleteModal,
} from "../components/spare-part/SparePartModals";
import { useSparePartFormModalStore } from "../stores/useSparePartModalStore";
import { useAuthStore } from "../stores/authStore";

export default function PartStock() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "ASSET_CENTER_STAFF" || role === "ADMIN";

  const [inputSearch, setInputSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [stockStatus, setStockStatus] = useState("ALL");

  const { data: groups } = useQuery({
    queryKey: ["sparepartGroups"],
    queryFn: getSparepartGroups,
  });

  const defaultGroups = [
    { id: 1, name: "ไฟฟ้า" },
    { id: 2, name: "เครื่องมือแพทย์" },
    { id: 3, name: "อิเล็กทรอนิกส์" },
    { id: 4, name: "กลไก/เครื่องกล" },
  ];

  const availableGroups = groups && groups.length > 0 ? groups : defaultGroups;

  const stockStatusOptions = [
    { value: "ALL", label: "ทั้งหมด" },
    { value: "NORMAL", label: "ปกติ" },
    { value: "LOW", label: "ต้องสั่งเพิ่ม" },
    { value: "OUT", label: "ของหมด" },
  ];

  return (
    <div className="space-y-4">
      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-bg-component shadow-sm w-full rounded-sm p-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหารหัส, ชื่ออะไหล่..."
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
          />
        </div>

        {/* Dropdown: หมวดหมู่ */}
        <div>
          <div className="relative inline-flex items-center h-8 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer">
            <span className="text-slate-600 mr-1.5">หมวดหมู่:</span>
            <span className="font-semibold text-emerald-600">
              {category === "ALL" ? "ทั้งหมด" : category}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-3" />

            <select
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="ALL">ทั้งหมด</option>
              {availableGroups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dropdown: สถานะ */}
        <div>
          <div className="relative inline-flex items-center h-8 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer">
            <span className="text-slate-600 mr-1.5">สถานะ:</span>
            <span className="font-semibold text-emerald-600">
              {stockStatusOptions.find((o) => o.value === stockStatus)?.label ??
                "ทั้งหมด"}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-3" />

            <select
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value)}
            >
              {stockStatusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1 hidden md:block" />

        {/* Add Button - แสดงเฉพาะผู้มีสิทธิ์จัดการสต็อกอะไหล่ */}
        {canManage && (
          <button
            type="button"
            onClick={() => useSparePartFormModalStore.getState().openAdd()}
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            เพิ่มอะไหล่ใหม่
          </button>
        )}
      </div>

      {/* Table Container */}
      <div className="bg-white border border-slate-100 shadow-2xs rounded-xl overflow-hidden">
        <SparePartTable
          search={inputSearch}
          category={category}
          stockStatus={stockStatus}
        />
      </div>

      {/* Modals */}
      <SparePartDetailModal />
      <SparePartFormModal />
      <SparePartDeleteModal />
    </div>
  );
}
