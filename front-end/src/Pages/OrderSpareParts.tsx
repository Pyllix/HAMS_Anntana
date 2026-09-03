import { useState } from "react";
import { Search, Plus, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSparepartGroups } from "../services/sparepartService";
import PartOrderTable from "../components/part-order/PartOrderTable";
import {
  PartOrderCreateModal,
  PartOrderPurchasingModal,
  PartOrderDetailModal,
} from "../components/part-order/PartOrderModals";
import { usePartOrderModalStore } from "../stores/usePartOrderModalStore";

export default function OrderSpareParts() {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const { openCreateModal } = usePartOrderModalStore();

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

  return (
    <div className="space-y-4">
      {/* Filter & Action Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-bg-component shadow-sm w-full rounded-sm p-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาอะไหล่, รหัสใบสั่งซื้อ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
          />
        </div>

        {/* Dropdown: หมวดหมู่ */}
        <div>
          <div className="relative inline-flex items-center h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs hover:border-slate-300 transition-colors cursor-pointer shadow-2xs">
            <span className="text-slate-600 mr-1.5">หมวดหมู่:</span>
            <span className="font-semibold text-emerald-600">
              {categoryFilter === "ALL" ? "ทั้งหมด" : categoryFilter}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-2.5" />

            <select
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
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

        {/* Standard Date Picker Filter */}
        <div className="relative inline-flex items-center h-8 px-3 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors shadow-2xs">
          <span className="text-slate-500 mr-2 whitespace-nowrap text-xs">วันที่สั่งซื้อ:</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="text-xs text-slate-800 bg-transparent border-0 focus:outline-hidden cursor-pointer"
          />
        </div>

        {/* Clear Date Filter Button */}
        {dateFilter && (
          <button
            type="button"
            onClick={() => setDateFilter("")}
            className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer"
          >
            ล้างวันที่
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1 hidden md:block" />

        {/* ปุ่มสั่งซื้ออะไหล่เพิ่ม */}
        <button
          type="button"
          onClick={() => openCreateModal()}
          className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer shrink-0 active:scale-95"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          สั่งซื้ออะไหล่เพิ่ม
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-slate-100 shadow-2xs rounded-xl overflow-hidden">
        <PartOrderTable
          search={search}
          dateFilter={dateFilter}
          categoryFilter={categoryFilter}
        />
      </div>

      {/* Modals */}
      <PartOrderCreateModal />
      <PartOrderPurchasingModal />
      <PartOrderDetailModal />
    </div>
  );
}

