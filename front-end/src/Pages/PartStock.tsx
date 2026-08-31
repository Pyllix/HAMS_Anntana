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

export default function PartStock() {
  const [inputSearch, setInputSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [stockStatus, setStockStatus] = useState("ALL");

  const { data: groups } = useQuery({
    queryKey: ["sparepartGroups"],
    queryFn: getSparepartGroups,
  });

  const stockStatusOptions = [
    { value: "ALL", label: "ทั้งหมด" },
    { value: "NORMAL", label: "ปกติ" },
    { value: "LOW", label: "ต้องสั่งเพิ่ม" },
    { value: "OUT", label: "ของหมด" },
  ];

  return (
    <div className="space-y-4 p-1">
      {/* Title */}
      <div className="pt-2">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          รายการสต็อกอะไหล่ทั้งหมดในระบบ
        </h1>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-100 shadow-2xs rounded-xl p-3.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหารหัส / ชื่ออะไหล่..."
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>

        {/* Dropdown: หมวดหมู่ */}
        <div className="relative inline-flex items-center h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-xs hover:border-slate-300 transition-colors cursor-pointer w-48 shrink-0 justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            <span className="text-slate-500 shrink-0">หมวดหมู่:</span>
            <span className="font-semibold text-emerald-600 truncate">
              {category === "ALL" ? "ทั้งหมด" : category}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="ALL">ทั้งหมด</option>
            {groups?.map((g) => (
              <option key={g.id} value={g.name}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown: สถานะ */}
        <div className="relative inline-flex items-center h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-xs hover:border-slate-300 transition-colors cursor-pointer w-44 shrink-0 justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            <span className="text-slate-500 shrink-0">สถานะ:</span>
            <span className="font-semibold text-emerald-600 truncate">
              {stockStatusOptions.find((o) => o.value === stockStatus)?.label ??
                "ทั้งหมด"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
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

        {/* Spacer */}
        <div className="flex-1 hidden md:block" />

        {/* Add Button */}
        <button
          type="button"
          onClick={() => useSparePartFormModalStore.getState().openAdd()}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          เพิ่มอะไหล่ใหม่
        </button>
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
