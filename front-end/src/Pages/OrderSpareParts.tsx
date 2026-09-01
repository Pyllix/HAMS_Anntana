import { useState } from "react";
import { Search } from "lucide-react";
import PartOrderTable from "../components/part-order/PartOrderTable";
import {
  PartOrderPurchasingModal,
  PartOrderDetailModal,
} from "../components/part-order/PartOrderModals";

export default function OrderSpareParts() {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  return (
    <div className="space-y-4 p-4 md:p-6 bg-slate-50/50 min-h-screen">
      {/* Title Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          รายการสั่งซื้ออะไหล่
        </h1>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <input
            type="text"
            placeholder="ค้นหาอะไหล่, รหัสใบสั่งซื้อ, ผู้ขอเบิก..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden transition-all shadow-2xs"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>

        {/* Standard Date Picker Filter */}
        <div className="relative inline-flex items-center h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs hover:border-slate-300 transition-colors shadow-2xs">
          <span className="text-slate-500 mr-2 whitespace-nowrap">วันที่สั่งซื้อ:</span>
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
      </div>

      {/* Table Container */}
      <div className="bg-white border border-slate-100 shadow-2xs rounded-xl overflow-hidden">
        <PartOrderTable
          search={search}
          dateFilter={dateFilter}
        />
      </div>

      {/* Modals */}
      <PartOrderPurchasingModal />
      <PartOrderDetailModal />
    </div>
  );
}
