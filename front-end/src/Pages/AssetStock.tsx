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
import { useAuthStore } from "../stores/authStore";
import { ROLES } from "../router/roles";

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

  const { data: normalCountRes } = useQuery({
    queryKey: [
      "kpi-normal-assets",
      isAssetCenter ? "all" : user?.section_id,
      normalStatus?.id,
    ],
    queryFn: () =>
      getAssetsPaginated({
        page: 1,
        limit: 1,
        section_id: !isAssetCenter && user?.section_id ? user.section_id : undefined,
        asset_status_id: normalStatus?.id,
      }),
    enabled: Boolean(normalStatus?.id),
  });

  const { data: damagedCountRes } = useQuery({
    queryKey: [
      "kpi-damaged-assets",
      isAssetCenter ? "all" : user?.section_id,
      damagedStatus?.id,
    ],
    queryFn: () =>
      getAssetsPaginated({
        page: 1,
        limit: 1,
        section_id: !isAssetCenter && user?.section_id ? user.section_id : undefined,
        asset_status_id: damagedStatus?.id,
      }),
    enabled: Boolean(damagedStatus?.id),
  });

  // Calculate KPIs dynamically
  const totalAssets = assetResponse?.meta?.total ?? 0;
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

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] space-y-2 overflow-hidden">
      {/* KPI / Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 shrink-0">
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
      <div className="flex flex-wrap items-center gap-4 bg-bg-component shadow-sm w-full rounded-sm p-4 shrink-0">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
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
              title={selectedTypeName}
            >
              {selectedTypeName}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
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

        {/* Dropdown: แผนก (แสดงเฉพาะศูนย์ครุภัณฑ์ / Admin) */}
        {isAssetCenter && (
          <div className="relative inline-flex items-center h-8 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-48 shrink-0 justify-between">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
              <span className="text-slate-500 shrink-0">แผนก:</span>
              <span
                className="font-semibold text-emerald-600 truncate"
                title={selectedSectionName}
              >
                {selectedSectionName}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
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

        {/* Dropdown: สถานะ */}
        <div className="relative inline-flex items-center h-8 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-44 shrink-0 justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            <span className="text-slate-500 shrink-0">สถานะ:</span>
            <span
              className="font-semibold text-emerald-600 truncate"
              title={selectedStatusName}
            >
              {selectedStatusName}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
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

      {/* Table Container */}
      <div className="bg-bg-component shadow-sm w-full rounded-sm overflow-hidden flex-1 flex flex-col min-h-0">
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
    </div>
  );
}
