import { useState, useMemo } from "react";
import { Search, ChevronDown, Plus, Check, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  getAssetTypes,
  getAssetStatuses,
  getSections,
  getAssets,
} from "../services/assetService";
import StockAssetsTable from "../components/asset-stock/StockAssetsTable";
import AssetDetailModal from "../components/asset-stock/AssetDetailModal";

export default function AssetStock() {
  const [inputSearch, setInputSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const { data: assets } = useQuery({
    queryKey: ["assets"],
    queryFn: getAssets,
  });

  const { data: assetTypes } = useQuery({
    queryKey: ["assetTypes"],
    queryFn: getAssetTypes,
  });

  const { data: assetStatuses } = useQuery({
    queryKey: ["assetStatuses"],
    queryFn: getAssetStatuses,
  });

  const { data: sections } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
  });

  // Calculate KPIs dynamically
  const totalAssets = assets?.length || 0;
  const normalAssets = useMemo(() => {
    return assets?.filter((a) => a.status?.code === "NORMAL").length || 0;
  }, [assets]);

  const damagedAssets = useMemo(() => {
    return (
      assets?.filter(
        (a) => a.status?.code === "DAMAGED" || a.status?.code === "UNDER_REPAIR"
      ).length || 0
    );
  }, [assets]);

  return (
    <div className="space-y-2">
      {/* KPI / Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Total Assets */}
        <div className="flex items-center gap-4 bg-bg-component rounded-sm p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">
              จำนวนครุภัณฑ์ทั้งหมด (รายการ)
            </p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-0.5">
              {totalAssets.toLocaleString()}
            </h3>
          </div>
        </div>

        {/* Normal / In-use Assets */}
        <div className="flex items-center gap-4 bg-bg-component rounded-sm p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
            <Check className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">
              ใช้งานได้ปกติ (รายการ)
            </p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-0.5">
              {normalAssets.toLocaleString()}
            </h3>
          </div>
        </div>

        {/* Damaged / Repairing Assets */}
        <div className="flex items-center gap-4 bg-bg-component rounded-sm p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500 shrink-0">
            <X className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">
              กำลังชำรุด / รอซ่อม (รายการ)
            </p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-rose-500 mt-0.5">
              {damagedAssets.toLocaleString()}
            </h3>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-bg-component shadow-sm w-full rounded-sm p-4">
        {/* Search input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหารหัส, ชื่อ, Serial Number..."
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
          />
        </div>

        {/* Dropdown: ประเภท */}
        <div className="relative inline-flex items-center h-8 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-56 shrink-0 justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            <span className="text-slate-500 shrink-0">ประเภท:</span>
            <span
              className="font-semibold text-emerald-600 truncate"
              title={type === "ALL" ? "ทั้งหมด" : type}
            >
              {type === "ALL" ? "ทั้งหมด" : type}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="ALL">ทั้งหมด</option>
            {assetTypes?.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown: แผนก */}
        <div className="relative inline-flex items-center h-8 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-48 shrink-0 justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            <span className="text-slate-500 shrink-0">แผนก:</span>
            <span
              className="font-semibold text-emerald-600 truncate"
              title={department === "ALL" ? "ทั้งหมด" : department}
            >
              {department === "ALL" ? "ทั้งหมด" : department}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="ALL">ทั้งหมด</option>
            {sections?.map((sec) => (
              <option key={sec.id} value={sec.name}>
                {sec.name}
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown: สถานะ */}
        <div className="relative inline-flex items-center h-8 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-44 shrink-0 justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            <span className="text-slate-500 shrink-0">สถานะ:</span>
            <span
              className="font-semibold text-emerald-600 truncate"
              title={status === "ALL" ? "ทั้งหมด" : status}
            >
              {status === "ALL" ? "ทั้งหมด" : status}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">ทั้งหมด</option>
            {assetStatuses?.map((st) => (
              <option key={st.id} value={st.name}>
                {st.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-bg-component shadow-sm w-full rounded-sm overflow-hidden">
        <StockAssetsTable
          search={inputSearch}
          type={type}
          department={department}
          status={status}
        />
      </div>

      {/* Asset Detail Dialog */}
      <AssetDetailModal />
    </div>
  );
}
