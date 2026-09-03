import { useState } from "react";
import { Search, Plus } from "lucide-react";
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
  const { openCreateModal } = usePartOrderModalStore();

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
        />
      </div>

      {/* Modals */}
      <PartOrderCreateModal />
      <PartOrderPurchasingModal />
      <PartOrderDetailModal />
    </div>
  );
}

