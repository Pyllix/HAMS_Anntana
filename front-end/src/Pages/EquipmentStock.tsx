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
  FileText,
  Calendar as CalendarIcon,
  X,
  Info,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  getAssetsPaginated,
  getAssetTypes,
  getAssetStatuses,
} from "../services/assetService";
import AssetTable from "../components/equipment-stock/AssetTable";
import WaitDisposalTable from "../components/equipment-stock/WaitDisposalTable";
import DisposalTable from "../components/equipment-stock/DisposalTable";
import LostTable from "../components/equipment-stock/LostTable";
import AssetFormModal from "../components/equipment-stock/AssetFormModal";
import EquipmentDetailModal from "../components/equipment-stock/EquipmentDetailModal";
import AssetRepairHistoryModal from "../components/asset-stock/AssetRepairHistoryModal";
import WaitDisposalModal from "../components/equipment-stock/WaitDisposalModal";
import ConfirmDisposalModal from "../components/equipment-stock/ConfirmDisposalModal";
import ConfirmLostModal from "../components/equipment-stock/ConfirmLostModal";
import CalendarFilterDialog from "../components/equipment-stock/CalendarFilterDialog";
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

  // Date Filter States for Wait Disposal Tab
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateFilterLabel, setDateFilterLabel] = useState("ทั้งหมด");

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
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setPage(1);
    setSelectedDate(null);
    setDateFilterLabel("ทั้งหมด");
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
    setSelectedDate(null);
    setDateFilterLabel("ทั้งหมด");
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
      "equipment-assets-paginated",
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
        search: debouncedSearch,
        asset_status_id: effectiveStatusId,
        asset_type_id: selectedType !== "ALL" ? Number(selectedType) : undefined,
      }),
  });

  // KPI Status Counts
  const normalId = assetStatuses.find((s) => s.code === "NORMAL")?.id;
  const damagedId = assetStatuses.find((s) => s.code === "DAMAGED")?.id;
  const underRepairId = assetStatuses.find((s) => s.code === "UNDER_REPAIR")?.id;
  const waitDisposalId = assetStatuses.find((s) => s.code === "WAIT_DISPOSAL")?.id;
  const disposalId = assetStatuses.find((s) => s.code === "DISPOSAL")?.id;
  const lostId = assetStatuses.find((s) => s.code === "LOST")?.id;

  const { data: totalAllRes } = useQuery({
    queryKey: ["kpi-status", "TOTAL"],
    queryFn: () => getAssetsPaginated({ page: 1, limit: 1 }),
  });
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

  // Filter assets on client for date filter when in WAIT_DISPOSAL tab
  const displayedAssets = useMemo(() => {
    let list = assetResponse?.data || [];

    if (
      activeTab === "WAIT_DISPOSAL" ||
      activeTab === "DISPOSAL" ||
      activeTab === "LOST"
    ) {
      if (selectedDate) {
        list = list.filter((item) => {
          const dateStr = item.updatedAt || item.receivedDate || item.createdAt;
          if (!dateStr) return false;
          const d = new Date(dateStr);
          return (
            d.getDate() === selectedDate.getDate() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getFullYear() === selectedDate.getFullYear()
          );
        });
      } else if (dateFilterLabel === "เดือนนี้") {
        const now = new Date();
        list = list.filter((item) => {
          const dateStr = item.updatedAt || item.receivedDate || item.createdAt;
          if (!dateStr) return true;
          const d = new Date(dateStr);
          return (
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
          );
        });
      }
    }

    return list;
  }, [assetResponse?.data, activeTab, selectedDate, dateFilterLabel]);

  const isClientFiltered =
    (activeTab === "WAIT_DISPOSAL" ||
      activeTab === "DISPOSAL" ||
      activeTab === "LOST") &&
    Boolean(selectedDate || (dateFilterLabel !== "ทั้งหมด" && dateFilterLabel !== ""));

  const totalDisplayItems = isClientFiltered
    ? displayedAssets.length
    : (assetResponse?.meta?.total ?? 0);

  const totalDisplayPages = isClientFiltered
    ? Math.ceil(displayedAssets.length / pageSize) || 1
    : (assetResponse?.meta?.totalPages ?? 1);

  // Show 'เพิ่มครุภัณฑ์' button only on "รายการทั้งหมด" and "ใช้งานปกติ" (Approach 1)
  const canCreateAsset =
    activeTab === "ALL" &&
    (selectedStatus === "ALL" || (normalId && selectedStatus === String(normalId)));

  return (
    <div className="flex flex-col h-[calc(100vh-6.8rem)] max-h-[calc(100vh-6.8rem)] space-y-2 overflow-hidden">

      {/* KPI Cards Row - All 7 Cards always displayed in Lifecycle Order */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0">
        {/* 1. Total Card - รายการทั้งหมด */}
        <div
          onClick={() => handleTabChange("ALL")}
          className={`flex items-center gap-3 bg-white p-3 rounded-xl border shadow-2xs cursor-pointer hover:shadow-xs transition-all ${
            activeTab === "ALL" && selectedStatus === "ALL"
              ? "border-emerald-400 ring-1 ring-emerald-300"
              : "border-slate-100 hover:border-slate-300"
          }`}
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

        {/* 2. Normal Ready Card - ใช้งานปกติ */}
        <div
          onClick={() => {
            if (normalId) {
              handleStatusChange(String(normalId));
            }
          }}
          className={`flex items-center gap-3 bg-white p-3 rounded-xl border shadow-2xs cursor-pointer hover:shadow-xs transition-all ${
            activeTab === "ALL" && selectedStatus === String(normalId)
              ? "border-emerald-400 ring-1 ring-emerald-300"
              : "border-slate-100 hover:border-slate-300"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              ใช้งานปกติ
            </p>
            <h4 className="text-lg font-bold text-emerald-600 mt-0.5">
              {normalCount}
            </h4>
          </div>
        </div>

        {/* 3. Damaged Card - ชำรุด */}
        <div
          onClick={() => {
            if (damagedId) {
              handleStatusChange(String(damagedId));
            }
          }}
          className={`flex items-center gap-3 bg-white p-3 rounded-xl border shadow-2xs cursor-pointer hover:shadow-xs transition-all ${
            activeTab === "ALL" && selectedStatus === String(damagedId)
              ? "border-orange-400 ring-1 ring-orange-300"
              : "border-slate-100 hover:border-slate-300"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600 shrink-0">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              ชำรุด
            </p>
            <h4 className="text-lg font-bold text-orange-600 mt-0.5">
              {damagedCount}
            </h4>
          </div>
        </div>

        {/* 4. Under Repair Card - อยู่ระหว่างซ่อม */}
        <div
          onClick={() => {
            if (underRepairId) {
              handleStatusChange(String(underRepairId));
            }
          }}
          className={`flex items-center gap-3 bg-white p-3 rounded-xl border shadow-2xs cursor-pointer hover:shadow-xs transition-all ${
            activeTab === "ALL" && selectedStatus === String(underRepairId)
              ? "border-sky-400 ring-1 ring-sky-300"
              : "border-slate-100 hover:border-slate-300"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              อยู่ระหว่างซ่อม
            </p>
            <h4 className="text-lg font-bold text-sky-600 mt-0.5">
              {underRepairCount}
            </h4>
          </div>
        </div>

        {/* 5. Wait Disposal Card - รอจำหน่าย */}
        <div
          onClick={() => handleTabChange("WAIT_DISPOSAL")}
          className={`flex items-center gap-3 bg-white p-3 rounded-xl border shadow-2xs cursor-pointer hover:shadow-xs transition-all ${
            activeTab === "WAIT_DISPOSAL"
              ? "border-amber-400 ring-1 ring-amber-300"
              : "border-slate-100 hover:border-slate-300"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              รอจำหน่าย
            </p>
            <h4 className="text-lg font-bold text-amber-600 mt-0.5">
              {waitDisposalCount}
            </h4>
          </div>
        </div>

        {/* 6. Disposal Done Card - จำหน่ายแล้ว */}
        <div
          onClick={() => handleTabChange("DISPOSAL")}
          className={`flex items-center gap-3 bg-white p-3 rounded-xl border shadow-2xs cursor-pointer hover:shadow-xs transition-all ${
            activeTab === "DISPOSAL"
              ? "border-slate-400 ring-1 ring-slate-300"
              : "border-slate-100 hover:border-slate-300"
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

        {/* 7. Lost Card - สูญหาย */}
        <div
          onClick={() => handleTabChange("LOST")}
          className={`flex items-center gap-3 bg-white p-3 rounded-xl border shadow-2xs cursor-pointer hover:shadow-xs transition-all ${
            activeTab === "LOST"
              ? "border-rose-400 ring-1 ring-rose-300"
              : "border-slate-100 hover:border-slate-300"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              สูญหาย
            </p>
            <h4 className="text-lg font-bold text-rose-600 mt-0.5">
              {lostCount}
            </h4>
          </div>
        </div>
      </div>

      {/* Disposal Warning Banner */}
      {activeTab === "DISPOSAL" && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100/90 text-slate-600 rounded-xl text-xs shrink-0 border border-slate-200/60">
          <Info className="h-4 w-4 text-slate-500 shrink-0" />
          <span>
            รายการในหน้านี้ <strong className="font-semibold text-slate-800">"ถูกตัดออกจากทะเบียนพัสดุแล้ว"</strong> ข้อมูลถูกเก็บไว้เพื่อการตรวจสอบประวัติเท่านั้น
          </span>
        </div>
      )}

      {/* Lost Warning Banner */}
      {activeTab === "LOST" && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100/90 text-slate-600 rounded-xl text-xs shrink-0 border border-slate-200/60">
          <Info className="h-4 w-4 text-slate-500 shrink-0" />
          <span>
            รายการในหน้านี้ <strong className="font-semibold text-slate-800">"ถูกบันทึกเป็นสูญหายแล้ว"</strong> ข้อมูลถูกเก็บไว้เพื่อการตรวจสอบและดำเนินการทางบัญชี
          </span>
        </div>
      )}

      {/* Filter / Search Bar */}
      {activeTab === "WAIT_DISPOSAL" || activeTab === "DISPOSAL" || activeTab === "LOST" ? (
        /* Filter bar matching reference for รอจำหน่าย / จำหน่ายออกแล้ว */
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
                className="w-full h-8 pl-9 pr-3 rounded-lg border border-slate-200 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Date Filter: วันที่ทำ: [ทั้งหมด 📅] */}
            <div className="inline-flex items-center gap-1">
              <div
                onClick={() => setIsCalendarOpen(true)}
                className={`relative inline-flex items-center h-8 px-3 rounded-lg border transition-colors text-xs cursor-pointer shadow-2xs ${
                  selectedDate || dateFilterLabel !== "ทั้งหมด"
                    ? "border-emerald-400 bg-emerald-50/50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="text-slate-600 mr-1.5">วันที่ทำ:</span>
                <span className="font-semibold text-emerald-600">
                  {dateFilterLabel}
                </span>
                <CalendarIcon className="h-3.5 w-3.5 text-slate-400 ml-2.5" />
              </div>
              {(selectedDate || dateFilterLabel !== "ทั้งหมด") && (
                <button
                  type="button"
                  title="ล้างตัวกรองวันที่ (แสดงทั้งหมด)"
                  onClick={() => {
                    setSelectedDate(null);
                    setDateFilterLabel("ทั้งหมด");
                    setPage(1);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Type Dropdown */}
            <div>
              <div className="relative inline-flex items-center h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs hover:border-slate-300 transition-colors cursor-pointer shadow-2xs">
                <span className="text-slate-600 mr-1.5">ประเภท:</span>
                <span className="font-semibold text-emerald-600 truncate">
                  {selectedType === "ALL"
                    ? "ทั้งหมด"
                    : assetTypes.find((t) => String(t.id) === selectedType)?.name}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-2.5 shrink-0" />
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
          </div>
        </div>
      ) : (
        /* Standard Filter / Search Bar with + เพิ่มครุภัณฑ์ Button */
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

            {/* Type Dropdown */}
            <div>
              <div className="relative inline-flex items-center h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs hover:border-slate-300 transition-colors cursor-pointer shadow-2xs">
                <span className="text-slate-600 mr-1.5">ประเภท:</span>
                <span className="font-semibold text-emerald-600 truncate">
                  {selectedType === "ALL"
                    ? "ทั้งหมด"
                    : assetTypes.find((t) => String(t.id) === selectedType)?.name}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-2.5 shrink-0" />
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
          </div>

          {/* Add Equipment Button (Only for "รายการทั้งหมด" and "ใช้งานปกติ") */}
          {canCreateAsset && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>เพิ่มครุภัณฑ์</span>
            </button>
          )}
        </div>
      )}

      {/* Main Table */}
      <div className="bg-bg-component shadow-sm w-full rounded-sm overflow-hidden flex-1 flex flex-col min-h-0">
        {activeTab === "WAIT_DISPOSAL" ? (
          <WaitDisposalTable
            assets={displayedAssets}
            isLoading={isLoading}
            currentPage={page}
            totalPages={totalDisplayPages}
            totalItems={totalDisplayItems}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        ) : activeTab === "DISPOSAL" ? (
          <DisposalTable
            assets={displayedAssets}
            isLoading={isLoading}
            currentPage={page}
            totalPages={totalDisplayPages}
            totalItems={totalDisplayItems}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        ) : activeTab === "LOST" ? (
          <LostTable
            assets={displayedAssets}
            isLoading={isLoading}
            currentPage={page}
            totalPages={totalDisplayPages}
            totalItems={totalDisplayItems}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        ) : (
          <AssetTable
            assets={displayedAssets}
            isLoading={isLoading}
            currentPage={page}
            totalPages={totalDisplayPages}
            totalItems={totalDisplayItems}
            pageSize={pageSize}
            onPageChange={setPage}
            activeTab={activeTab}
          />
        )}
      </div>

      {/* Modals */}
      <AssetFormModal />
      <EquipmentDetailModal />
      <AssetRepairHistoryModal />
      <WaitDisposalModal />
      <ConfirmDisposalModal />
      <ConfirmLostModal />

      {/* Calendar Filter Dialog */}
      <CalendarFilterDialog
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        selectedDate={selectedDate}
        onSelectDate={(d, label) => {
          setSelectedDate(d);
          if (label) {
            setDateFilterLabel(label);
          } else if (d) {
            setDateFilterLabel(
              `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`
            );
          } else {
            setDateFilterLabel("ทั้งหมด");
          }
          setPage(1);
        }}
      />
    </div>
  );
}
