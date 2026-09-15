import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  ChevronDown,
  Plus,
  AlertTriangle,
  Clock,
  Wrench,
  CheckCircle2,
  XCircle,
  Package,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  getAssetsPaginated,
  getAssetTypes,
  getAssetStatuses,
} from "../services/assetService";
import AssetTable from "../components/equipment-stock/AssetTable";
import AssetFormModal from "../components/equipment-stock/AssetFormModal";
import AssetDetailModal from "../components/asset-stock/AssetDetailModal";
import AssetRepairHistoryModal from "../components/asset-stock/AssetRepairHistoryModal";
import { useEquipmentModalStore } from "../stores/useEquipmentModalStore";

// Tab types matching Figma
type TabKey = "ALL" | "WAIT_DISPOSAL" | "DISPOSAL" | "LOST";

export default function EquipmentStock() {
  const [activeTab, setActiveTab] = useState<TabKey>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [inputSearch, setInputSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  const openCreateModal = useEquipmentModalStore((state) => state.openCreate);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(inputSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputSearch]);

  // Master Data Queries
  const { data: assetStatuses = [] } = useQuery({
    queryKey: ["assetStatuses"],
    queryFn: getAssetStatuses,
  });

  const { data: assetTypes = [] } = useQuery({
    queryKey: ["assetTypes"],
    queryFn: getAssetTypes,
  });

  // Synchronize Tab and Status Filter
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    if (tab === "WAIT_DISPOSAL") {
      const s = assetStatuses.find((x) => x.code === "WAIT_DISPOSAL");
      if (s) setSelectedStatus(String(s.id));
    } else if (tab === "DISPOSAL") {
      const s = assetStatuses.find((x) => x.code === "DISPOSAL");
      if (s) setSelectedStatus(String(s.id));
    } else if (tab === "LOST") {
      const s = assetStatuses.find((x) => x.code === "LOST");
      if (s) setSelectedStatus(String(s.id));
    } else {
      setSelectedStatus("ALL");
    }
  };

  const handleStatusChange = (statusVal: string) => {
    setSelectedStatus(statusVal);
    setPage(1);
    if (statusVal === "ALL") {
      setActiveTab("ALL");
    } else {
      const s = assetStatuses.find((x) => String(x.id) === statusVal);
      if (s?.code === "WAIT_DISPOSAL") setActiveTab("WAIT_DISPOSAL");
      else if (s?.code === "DISPOSAL") setActiveTab("DISPOSAL");
      else if (s?.code === "LOST") setActiveTab("LOST");
      else setActiveTab("ALL");
    }
  };

  // Calculate Status Filter based on Tab + Dropdown Filter
  const effectiveStatusId = useMemo(() => {
    if (activeTab === "WAIT_DISPOSAL") {
      return assetStatuses.find((s) => s.code === "WAIT_DISPOSAL")?.id;
    }
    if (activeTab === "DISPOSAL") {
      return assetStatuses.find((s) => s.code === "DISPOSAL")?.id;
    }
    if (activeTab === "LOST") {
      return assetStatuses.find((s) => s.code === "LOST")?.id;
    }
    if (selectedStatus !== "ALL") {
      return Number(selectedStatus);
    }
    return undefined;
  }, [activeTab, selectedStatus, assetStatuses]);

  // Main Assets Query
  const { data: assetResponse, isLoading } = useQuery({
    queryKey: [
      "assets",
      "equipment-stock",
      page,
      pageSize,
      debouncedSearch,
      effectiveStatusId,
      selectedType,
    ],
    queryFn: () =>
      getAssetsPaginated({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        asset_status_id: effectiveStatusId,
        asset_type_id: selectedType !== "ALL" ? Number(selectedType) : undefined,
      }),
  });

  // KPI Queries to display counter cards on top
  const { data: totalAllRes } = useQuery({
    queryKey: ["kpi-total-assets", "all"],
    queryFn: () => getAssetsPaginated({ page: 1, limit: 1 }),
  });

  const lostId = assetStatuses.find((s) => s.code === "LOST")?.id;
  const underRepairId = assetStatuses.find((s) => s.code === "UNDER_REPAIR")?.id;
  const normalId = assetStatuses.find((s) => s.code === "NORMAL")?.id;
  const damagedId = assetStatuses.find((s) => s.code === "DAMAGED")?.id;
  const waitDisposalId = assetStatuses.find((s) => s.code === "WAIT_DISPOSAL")?.id;
  const disposalId = assetStatuses.find((s) => s.code === "DISPOSAL")?.id;

  const { data: lostRes } = useQuery({
    queryKey: ["kpi-status", "LOST", lostId],
    queryFn: () => getAssetsPaginated({ page: 1, limit: 1, asset_status_id: lostId }),
    enabled: Boolean(lostId),
  });
  const { data: underRepairRes } = useQuery({
    queryKey: ["kpi-status", "UNDER_REPAIR", underRepairId],
    queryFn: () => getAssetsPaginated({ page: 1, limit: 1, asset_status_id: underRepairId }),
    enabled: Boolean(underRepairId),
  });
  const { data: normalRes } = useQuery({
    queryKey: ["kpi-status", "NORMAL", normalId],
    queryFn: () => getAssetsPaginated({ page: 1, limit: 1, asset_status_id: normalId }),
    enabled: Boolean(normalId),
  });
  const { data: damagedRes } = useQuery({
    queryKey: ["kpi-status", "DAMAGED", damagedId],
    queryFn: () => getAssetsPaginated({ page: 1, limit: 1, asset_status_id: damagedId }),
    enabled: Boolean(damagedId),
  });
  const { data: waitDisposalRes } = useQuery({
    queryKey: ["kpi-status", "WAIT_DISPOSAL", waitDisposalId],
    queryFn: () => getAssetsPaginated({ page: 1, limit: 1, asset_status_id: waitDisposalId }),
    enabled: Boolean(waitDisposalId),
  });
  const { data: disposalRes } = useQuery({
    queryKey: ["kpi-status", "DISPOSAL", disposalId],
    queryFn: () => getAssetsPaginated({ page: 1, limit: 1, asset_status_id: disposalId }),
    enabled: Boolean(disposalId),
  });

  const lostCount = lostRes?.meta?.total ?? 0;
  const underRepairCount = underRepairRes?.meta?.total ?? 0;
  const normalCount = normalRes?.meta?.total ?? 0;
  const damagedCount = damagedRes?.meta?.total ?? 0;
  const waitDisposalCount = waitDisposalRes?.meta?.total ?? 0;
  const disposalCount = disposalRes?.meta?.total ?? 0;
  const totalAssets = totalAllRes?.meta?.total ?? assetResponse?.meta?.total ?? 0;

  return (
    <div className="flex flex-col h-[calc(100vh-6.8rem)] max-h-[calc(100vh-6.8rem)] space-y-2 overflow-hidden">
      {/* Header Tabs matching Figma */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5 shrink-0">
        <button
          type="button"
          onClick={() => handleTabChange("ALL")}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "ALL"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          รายการสต็อกหลัก
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("WAIT_DISPOSAL")}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "WAIT_DISPOSAL"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          รอจำหน่าย
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("DISPOSAL")}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "DISPOSAL"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          จำหน่ายออกแล้ว
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("LOST")}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "LOST"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          สูญหาย
        </button>
      </div>

      {/* KPI Cards Row (7 Cards matching Figma) - Clickable to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0">
        {/* Total Card */}
        <div
          onClick={() => handleTabChange("ALL")}
          className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-2xs cursor-pointer hover:border-slate-300 hover:shadow-xs transition-all"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              รายการทั้งหมด
            </p>
            <h4 className="text-lg font-bold text-slate-800 mt-0.5">
              {totalAssets}
            </h4>
          </div>
        </div>

        {/* Lost Card */}
        <div
          onClick={() => handleTabChange("LOST")}
          className={`flex items-center gap-3 bg-white p-3 rounded-xl border shadow-2xs cursor-pointer hover:shadow-xs transition-all ${
            activeTab === "LOST" ? "border-rose-400 ring-1 ring-rose-300" : "border-slate-100 hover:border-rose-200"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-500 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              สูญหาย
            </p>
            <h4 className="text-lg font-bold text-rose-500 mt-0.5">
              {lostCount}
            </h4>
          </div>
        </div>

        {/* Wait Disposal Card */}
        <div
          onClick={() => handleTabChange("WAIT_DISPOSAL")}
          className={`flex items-center gap-3 bg-white p-3 rounded-xl border shadow-2xs cursor-pointer hover:shadow-xs transition-all ${
            activeTab === "WAIT_DISPOSAL" ? "border-amber-400 ring-1 ring-amber-300" : "border-slate-100 hover:border-amber-200"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-500 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              รอจำหน่าย
            </p>
            <h4 className="text-lg font-bold text-amber-500 mt-0.5">
              {waitDisposalCount}
            </h4>
          </div>
        </div>

        {/* Pending Card */}
        <div
          onClick={() => handleStatusChange(String(damagedId))}
          className={`flex items-center gap-3 bg-white p-3 rounded-xl border shadow-2xs cursor-pointer hover:shadow-xs transition-all ${
            selectedStatus === String(damagedId) ? "border-orange-400 ring-1 ring-orange-300" : "border-slate-100 hover:border-orange-200"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-500 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              รอดำเนินการ
            </p>
            <h4 className="text-lg font-bold text-orange-500 mt-0.5">
              {damagedCount}
            </h4>
          </div>
        </div>

        {/* Repairing Card */}
        <div
          onClick={() => handleStatusChange(String(underRepairId))}
          className={`flex items-center gap-3 bg-white p-3 rounded-xl border shadow-2xs cursor-pointer hover:shadow-xs transition-all ${
            selectedStatus === String(underRepairId) ? "border-blue-400 ring-1 ring-blue-300" : "border-slate-100 hover:border-blue-200"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-500 shrink-0">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              กำลังซ่อม
            </p>
            <h4 className="text-lg font-bold text-blue-500 mt-0.5">
              {underRepairCount}
            </h4>
          </div>
        </div>

        {/* Normal Card */}
        <div
          onClick={() => handleStatusChange(String(normalId))}
          className={`flex items-center gap-3 bg-white p-3 rounded-xl border shadow-2xs cursor-pointer hover:shadow-xs transition-all ${
            selectedStatus === String(normalId) ? "border-emerald-400 ring-1 ring-emerald-300" : "border-slate-100 hover:border-emerald-200"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              พร้อมใช้งาน
            </p>
            <h4 className="text-lg font-bold text-emerald-600 mt-0.5">
              {normalCount}
            </h4>
          </div>
        </div>

        {/* Disposal Done Card */}
        <div
          onClick={() => handleTabChange("DISPOSAL")}
          className={`flex items-center gap-3 bg-white p-3 rounded-xl border shadow-2xs cursor-pointer hover:shadow-xs transition-all ${
            activeTab === "DISPOSAL" ? "border-slate-400 ring-1 ring-slate-300" : "border-slate-100 hover:border-slate-300"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 shrink-0">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              จำหน่ายแล้ว
            </p>
            <h4 className="text-lg font-bold text-slate-600 mt-0.5">
              {disposalCount}
            </h4>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar with + เพิ่มครุภัณฑ์ Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-100 shadow-2xs shrink-0">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหารหัส, ชื่อ, หมายเลขเครื่อง..."
              value={inputSearch}
              onChange={(e) => setInputSearch(e.target.value)}
              className="w-full h-8 pl-9 pr-3 rounded-lg border border-slate-200 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Status Dropdown */}
          <div className="relative inline-flex items-center h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:border-slate-300 transition-colors w-40 justify-between bg-white">
            <span className="truncate">
              สถานะ: {selectedStatus === "ALL" ? "ทั้งหมด" : assetStatuses.find((s) => String(s.id) === selectedStatus)?.name}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 pointer-events-none" />
            <select
              value={selectedStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            >
              <option value="ALL">ทั้งหมด</option>
              {assetStatuses.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Dropdown */}
          <div className="relative inline-flex items-center h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:border-slate-300 transition-colors w-48 justify-between bg-white">
            <span className="truncate">
              ประเภท: {selectedType === "ALL" ? "ทั้งหมด" : assetTypes.find((t) => String(t.id) === selectedType)?.name}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 pointer-events-none" />
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            >
              <option value="ALL">ทั้งหมด</option>
              {assetTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Add Equipment Button */}
        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>เพิ่มครุภัณฑ์</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-bg-component shadow-sm w-full rounded-sm overflow-hidden flex-1 flex flex-col min-h-0">
        <AssetTable
          assets={assetResponse?.data || []}
          isLoading={isLoading}
          currentPage={page}
          totalPages={assetResponse?.meta?.totalPages || 1}
          totalItems={assetResponse?.meta?.total || 0}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>

      {/* Modals */}
      <AssetFormModal />
      <AssetDetailModal />
      <AssetRepairHistoryModal />
    </div>
  );
}
