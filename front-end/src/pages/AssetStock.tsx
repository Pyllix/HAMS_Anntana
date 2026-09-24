import { useState, useMemo, useEffect } from "react";
import { Search, ChevronDown, Plus, Check, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  getAssetTypes,
  getAssetStatuses,
  getSections,
  getAssetsPaginated,
  getMySectionAssetsPaginated,
} from "../services/assetService";
import StockAssetsTable from "../components/asset-stock/StockAssetsTable";
import AssetDetailModal from "../components/asset-stock/AssetDetailModal";
import AssetRepairHistoryModal from "../components/asset-stock/AssetRepairHistoryModal";
import { useAuthStore } from "../stores/authStore";
import { ROLES } from "../router/roles";
import StatCards from "../components/borrow-return/StatCards";
import type { StatCardData } from "../components/borrow-return/StatCards";

export default function AssetStock() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [inputSearch, setInputSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeId, setTypeId] = useState("ALL");
  const [sectionId, setSectionId] = useState("ALL");
  const [statusId, setStatusId] = useState("ALL");

  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const isAssetCenter = role === ROLES.ADMIN || role === ROLES.ASSET_CENTER_STAFF;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(inputSearch);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [inputSearch]);

  const { data: assetResponse, isLoading } = useQuery({
    queryKey: [
      "assets",
      isAssetCenter ? "all" : (user?.section_id || "my-section"),
      page,
      pageSize,
      debouncedSearch,
      typeId,
      sectionId,
      statusId,
    ],
    queryFn: () => {
      if (isAssetCenter) {
        return getAssetsPaginated({
          page,
          limit: pageSize,
          search: debouncedSearch || undefined,
          section_id: sectionId !== "ALL" ? sectionId : undefined,
          asset_type_id: typeId !== "ALL" ? Number(typeId) : undefined,
          asset_status_id: statusId !== "ALL" ? Number(statusId) : undefined,
        });
      }
      return getMySectionAssetsPaginated({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
      });
    },
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
    enabled: isAssetCenter,
  });

  // Query KPI Counts accurately from server
  const normalStatus = assetStatuses?.find((s) => s.code === "NORMAL");
  const damagedStatus = assetStatuses?.find((s) => s.code === "DAMAGED");

  const { data: totalCountRes } = useQuery({
    queryKey: [
      "kpi-total-assets",
      isAssetCenter ? "all" : (user?.section_id || "my-section"),
    ],
    queryFn: () => {
      if (isAssetCenter) {
        return getAssetsPaginated({
          page: 1,
          limit: 1,
        });
      }
      return getMySectionAssetsPaginated({
        page: 1,
        limit: 1,
      });
    },
  });

  const { data: normalCountRes } = useQuery({
    queryKey: [
      "kpi-normal-assets",
      isAssetCenter ? "all" : user?.section_id,
      normalStatus?.id,
    ],
    queryFn: () => {
      if (isAssetCenter) {
        return getAssetsPaginated({
          page: 1,
          limit: 1,
          asset_status_id: normalStatus?.id,
        });
      }
      return getMySectionAssetsPaginated({
        page: 1,
        limit: 1,
      });
    },
    enabled: Boolean(normalStatus?.id),
  });

  const { data: damagedCountRes } = useQuery({
    queryKey: [
      "kpi-damaged-assets",
      isAssetCenter ? "all" : user?.section_id,
      damagedStatus?.id,
    ],
    queryFn: () => {
      if (isAssetCenter) {
        return getAssetsPaginated({
          page: 1,
          limit: 1,
          asset_status_id: damagedStatus?.id,
        });
      }
      return getMySectionAssetsPaginated({
        page: 1,
        limit: 1,
      });
    },
    enabled: Boolean(damagedStatus?.id),
  });

  // Calculate KPIs dynamically (Total assets stays fixed, not affected by search query)
  const totalAssets = totalCountRes?.meta?.total ?? assetResponse?.meta?.total ?? 0;
  const normalAssets = normalCountRes?.meta?.total ?? 0;
  const damagedAssets = damagedCountRes?.meta?.total ?? 0;

  const selectedTypeName = useMemo(() => {
    if (typeId === "ALL") return "ทั้งหมด";
    return (
      assetTypes?.find((item) => String(item.id) === String(typeId))?.name ||
      "ทั้งหมด"
    );
  }, [typeId, assetTypes]);

  const selectedSectionName = useMemo(() => {
    if (sectionId === "ALL") return "ทั้งหมด";
    return sections?.find((sec) => sec.id === sectionId)?.name || "ทั้งหมด";
  }, [sectionId, sections]);

  const selectedStatusName = useMemo(() => {
    if (statusId === "ALL") return "ทั้งหมด";
    return (
      assetStatuses?.find((st) => String(st.id) === String(statusId))?.name ||
      "ทั้งหมด"
    );
  }, [statusId, assetStatuses]);

  // การ์ดสรุป (ใช้ StatCards แบบเดียวกับหน้ายืม-คืน)
  const statsSummary: StatCardData[] = [
    {
      id: "total",
      filterKey: "ALL",
      title: "จำนวนครุภัณฑ์ทั้งหมด (รายการ)",
      value: totalAssets,
      icon: Plus,
      iconBg: "bg-slate-100",
      iconColor: "text-slate-600",
      valueColor: "text-slate-800",
    },
    {
      id: "normal",
      filterKey: normalStatus ? String(normalStatus.id) : "NORMAL",
      title: "ใช้งานปกติ (รายการ)",
      value: normalAssets,
      icon: Check,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-600",
    },
    {
      id: "damaged",
      filterKey: damagedStatus ? String(damagedStatus.id) : "DAMAGED",
      title: "กำลังชำรุด / รอซ่อม (รายการ)",
      value: damagedAssets,
      icon: X,
      iconBg: "bg-rose-100",
      iconColor: "text-rose-600",
      valueColor: "text-rose-600",
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-4 md:space-y-6">
      {/* Stat Cards */}
      <div className="shrink-0">
        <StatCards
          stats={statsSummary}
          // กรองสถานะได้เฉพาะศูนย์ครุภัณฑ์ / Admin (API ของแผนกไม่รองรับตัวกรองสถานะ)
          selectedCategory={isAssetCenter ? statusId : undefined}
          onSelectCategory={
            isAssetCenter
              ? (key) => {
                  setStatusId(key);
                  setPage(1);
                }
              : undefined
          }
          gridClassName="grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 bg-bg-component shadow-sm w-full rounded-lg p-4">
        {/* กรอกคำค้นหา */}
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหารหัส, ชื่อ, Serial Number..."
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Dropdown ประเภท */}
          <div className="relative inline-flex items-center h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-full sm:w-auto">
            <span className="text-slate-600 mr-1.5 whitespace-nowrap">
              ประเภท:
            </span>
            <span
              className="font-semibold text-emerald-600 whitespace-nowrap truncate max-w-[100px]"
              title={selectedTypeName}
            >
              {selectedTypeName}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-auto sm:ml-3 shrink-0" />
            <select
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              value={typeId}
              onChange={(e) => {
                setTypeId(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">ทั้งหมด</option>
              {assetTypes?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown แผนก (แสดงเฉพาะศูนย์ครุภัณฑ์ / Admin) */}
          {isAssetCenter && (
            <div className="relative inline-flex items-center h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-full sm:w-auto">
              <span className="text-slate-600 mr-1.5 whitespace-nowrap">
                แผนก:
              </span>
              <span
                className="font-semibold text-emerald-600 whitespace-nowrap truncate max-w-[100px]"
                title={selectedSectionName}
              >
                {selectedSectionName}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400 ml-auto sm:ml-3 shrink-0" />
              <select
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                value={sectionId}
                onChange={(e) => {
                  setSectionId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">ทั้งหมด</option>
                {sections?.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dropdown สถานะ */}
          <div className="relative inline-flex items-center h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-full sm:w-auto">
            <span className="text-slate-600 mr-1.5 whitespace-nowrap">
              สถานะ:
            </span>
            <span
              className="font-semibold text-emerald-600 whitespace-nowrap truncate max-w-[100px]"
              title={selectedStatusName}
            >
              {selectedStatusName}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-auto sm:ml-3 shrink-0" />
            <select
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              value={statusId}
              onChange={(e) => {
                setStatusId(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">ทั้งหมด</option>
              {assetStatuses?.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden min-h-[420px]">
        <StockAssetsTable
          assets={assetResponse?.data ?? []}
          isLoading={isLoading}
          currentPage={page}
          totalPages={assetResponse?.meta?.totalPages ?? 1}
          totalItems={assetResponse?.meta?.total ?? 0}
          pageSize={pageSize}
          onPageChange={setPage}
          isAssetCenter={isAssetCenter}
        />
      </div>

      {/* Asset Detail Dialog */}
      <AssetDetailModal />

      {/* Asset Repair History Dialog */}
      <AssetRepairHistoryModal />
    </div>
  );
}
