import React, { useState, useEffect, useMemo } from "react";
import {
  Scale,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Banknote,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import StatCards, {
  type StatCardData,
} from "../components/borrow-return/StatCards";
import AssetViabilityTable from "../components/asset-viability/AssetViabilityTable";
import AssetViabilityDetailModal from "../components/asset-viability/AssetViabilityDetailModal";
import RequestDisposalModal from "../components/asset-viability/RequestDisposalModal";
import { getAssetViabilityList } from "../services/assetViabilityService";
import { getAllDepartment } from "../services/departmentService";
import { getAssetTypes } from "../services/assetService";
import type {
  ViabilityStatusFilter,
  ViabilitySortBy,
  SortOrder,
  DisposalPrefillData,
} from "../types/TypeAssetViability";

export default function AssetViabilityPage() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [statusFilter, setStatusFilter] = useState<ViabilityStatusFilter>("ALL");
  const [inputSearch, setInputSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<ViabilitySortBy>("costRatio");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Modals state
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null);
  const [disposalPrefill, setDisposalPrefill] =
    useState<DisposalPrefillData | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(inputSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputSearch]);

  // Master Data Queries
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-all"],
    queryFn: getAllDepartment,
  });

  const { data: assetTypes = [] } = useQuery({
    queryKey: ["assetTypes"],
    queryFn: getAssetTypes,
  });

  // Main Viability List Query
  const { data: viabilityResponse, isLoading, refetch } = useQuery({
    queryKey: [
      "asset-viability-list",
      page,
      pageSize,
      statusFilter,
      selectedSection,
      selectedType,
      debouncedSearch,
      sortBy,
      sortOrder,
    ],
    queryFn: () =>
      getAssetViabilityList({
        page,
        limit: pageSize,
        viabilityStatus: statusFilter,
        sectionId: selectedSection !== "ALL" ? selectedSection : undefined,
        assetTypeId: selectedType !== "ALL" ? Number(selectedType) : undefined,
        search: debouncedSearch,
        sortBy,
        sortOrder,
      }),
  });

  const summary = viabilityResponse?.summary;
  const items = viabilityResponse?.items || [];
  const pagination = viabilityResponse?.pagination || {
    total: 0,
    page: 1,
    limit: pageSize,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  };

  // StatCards Data
  const statsSummary: StatCardData[] = useMemo(() => {
    const total = summary?.totalEvaluated ?? 0;
    const viable = summary?.viableCount ?? 0;
    const warning = summary?.warningCount ?? 0;
    const unviable = summary?.unviableCount ?? 0;
    const totalCost = summary?.totalCumulativeRepairCost ?? 0;

    return [
      {
        id: "all",
        filterKey: "ALL",
        title: "ทั้งหมดที่ประเมิน",
        value: total,
        icon: Scale,
        iconBg: "bg-slate-100",
        iconColor: "text-slate-700",
        valueColor: "text-slate-900",
      },
      {
        id: "viable",
        filterKey: "VIABLE",
        title: "คุ้มค่าในการซ่อม",
        value: viable,
        icon: CheckCircle2,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        valueColor: "text-emerald-600",
      },
      {
        id: "warning",
        filterKey: "WARNING",
        title: "เฝ้าระวัง / ใกล้เกินเกณฑ์",
        value: warning,
        icon: AlertTriangle,
        iconBg: "bg-amber-50",
        iconColor: "text-amber-600",
        valueColor: "text-amber-600",
      },
      {
        id: "unviable",
        filterKey: "UNVIABLE",
        title: "ไม่คุ้มค่า / ควรแทงจำหน่าย",
        value: unviable,
        icon: AlertOctagon,
        iconBg: "bg-rose-50",
        iconColor: "text-rose-600",
        valueColor: "text-rose-600",
      },
      {
        id: "cost",
        filterKey: "COST",
        title: "ยอดค่าซ่อมสะสมรวม (บาท)",
        value: Math.round(totalCost),
        icon: Banknote,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
        valueColor: "text-blue-700",
      },
    ];
  }, [summary]);

  const handleSelectStat = (key: string) => {
    if (key === "COST") return; // ไม่ฟิลเตอร์ยอดเงิน
    setStatusFilter(key as ViabilityStatusFilter);
    setPage(1);
  };

  return (
    <div className="flex flex-col h-full space-y-4">

      {/* Stat Cards */}
      <div className="shrink-0">
        <StatCards
          stats={statsSummary}
          selectedCategory={statusFilter}
          onSelectCategory={handleSelectStat}
          gridClassName="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-3 bg-bg-component shadow-sm w-full rounded-lg p-4">
        {/* Search Box */}
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหารหัส noid, ชื่อครุภัณฑ์, รุ่น, หมายเลขเครื่อง..."
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">

          {/* Department Filter */}
          <div className="relative inline-flex items-center h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs hover:border-slate-300 transition-colors w-full sm:w-auto">
            <span className="text-slate-500 mr-1.5 whitespace-nowrap">
              แผนก:
            </span>
            <select
              value={selectedSection}
              onChange={(e) => {
                setSelectedSection(e.target.value);
                setPage(1);
              }}
              className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer max-w-[140px] truncate"
            >
              <option value="ALL">ทุกแผนก</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Asset Type Filter */}
          <div className="relative inline-flex items-center h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs hover:border-slate-300 transition-colors w-full sm:w-auto">
            <span className="text-slate-500 mr-1.5 whitespace-nowrap">
              ประเภท:
            </span>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer max-w-[130px] truncate"
            >
              <option value="ALL">ทุกประเภท</option>
              {assetTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="relative inline-flex items-center h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs hover:border-slate-300 transition-colors w-full sm:w-auto">
            <span className="text-slate-500 mr-1.5 whitespace-nowrap">
              เรียงตาม:
            </span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as ViabilitySortBy);
                setPage(1);
              }}
              className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="costRatio">% สัดส่วนค่าซ่อม</option>
              <option value="cumulativeCost">ยอดเงินค่าซ่อม</option>
              <option value="age">อายุเครื่อง</option>
              <option value="repairCount">จำนวนครั้งซ่อม</option>
              <option value="createdAt">วันที่นำเข้า</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-hidden min-h-0">
        <AssetViabilityTable
          items={items}
          isLoading={isLoading}
          currentPage={page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pageSize}
          onPageChange={setPage}
          onOpenDetail={(id) => setDetailAssetId(id)}
          onRequestDisposal={(prefill) => setDisposalPrefill(prefill)}
        />
      </div>

      {/* Deep-dive Detail Modal */}
      <AssetViabilityDetailModal
        assetId={detailAssetId}
        onClose={() => setDetailAssetId(null)}
        onRequestDisposal={(prefill) => setDisposalPrefill(prefill)}
      />

      {/* Request Disposal Modal (Case C) */}
      <RequestDisposalModal
        isOpen={Boolean(disposalPrefill)}
        onClose={() => setDisposalPrefill(null)}
        prefillData={disposalPrefill}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
