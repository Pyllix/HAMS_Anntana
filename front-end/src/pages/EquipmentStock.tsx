import RefreshButton from "../components/shared/RefreshButton";
import { useServerPage, useForegroundQuery } from "../hooks/useServerPage";
import { getPage, getSummary } from "../services/pagedApi";
import type { AssetSummary } from "../services/pagedApi";
import type { Asset } from "../types/TypeAsset";
import { assetDateRange } from "../services/assetDateRange";
import QueryStatus from "../components/shared/QueryStatus";
import { useState, useMemo, useEffect } from "react";
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
  Printer,
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
import SendAssessmentModal from "../components/equipment-stock/SendAssessmentModal";
import ToastContainer from "../components/borrow-return/ToastContainer";
import CalendarFilterDialog from "../components/equipment-stock/CalendarFilterDialog";
import { EquipmentStockPrintDialog } from "../components/equipment-stock/EquipmentStockPrintDialog";
import { useEquipmentModalStore } from "../stores/useEquipmentModalStore";
import { useAuthStore } from "../stores/authStore";
import StatCards from "../components/borrow-return/StatCards";
import type { StatCardData } from "../components/borrow-return/StatCards";

// Tab types matching Figma
type TabKey = "ALL" | "WAIT_DISPOSAL" | "DISPOSAL" | "LOST";

export default function EquipmentStock() {
  const [activeTab, setActiveTab] = useState<TabKey>("ALL");
  const user = useAuthStore((state) => state.user);
  const userName = user
    ? `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.userName
    : "เจ้าหน้าที่พัสดุ";

  const pageSize = 10;
  const [inputSearch, setInputSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  // Date Filter States for Wait Disposal Tab
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateFilterLabel, setDateFilterLabel] = useState("ทั้งหมด");
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);

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

  const dateRange = assetDateRange(selectedDate, dateFilterLabel, activeTab !== "ALL");
  const listQuery = useServerPage<Asset>("equipment-assets-paginated", {
    search: debouncedSearch, asset_status_id: effectiveStatusId,
    asset_type_id: selectedType !== "ALL" ? Number(selectedType) : undefined,
    ...dateRange,
  }, (filters, signal) => getPage("/asset", filters, signal), false, true, pageSize);
  const { data: assetResponse, isLoading, page, setPage } = listQuery;

  // KPI Status Counts
  const normalId = assetStatuses.find((s) => s.code === "NORMAL")?.id;
  const damagedId = assetStatuses.find((s) => s.code === "DAMAGED")?.id;
  const underRepairId = assetStatuses.find((s) => s.code === "UNDER_REPAIR")?.id;
  const waitDisposalId = assetStatuses.find((s) => s.code === "WAIT_DISPOSAL")?.id;
  const disposalId = assetStatuses.find((s) => s.code === "DISPOSAL")?.id;
  const lostId = assetStatuses.find((s) => s.code === "LOST")?.id;

  const summaryQuery = useForegroundQuery(["equipment-assets-paginated", "summary"],
    (signal) => getSummary<AssetSummary>("/asset/summary", {}, signal));
  const counts = summaryQuery.data?.byAssetStatusCode;
  const lostCount = counts ? (counts.LOST ?? 0) : undefined;
  const underRepairCount = counts ? (counts.UNDER_REPAIR ?? 0) : undefined;
  const normalCount = counts ? (counts.NORMAL ?? 0) : undefined;
  const damagedCount = counts ? (counts.DAMAGED ?? 0) : undefined;
  const waitDisposalCount = counts ? (counts.WAIT_DISPOSAL ?? 0) : undefined;
  const disposalCount = counts ? (counts.DISPOSAL ?? 0) : undefined;
  const totalAssets = summaryQuery.data?.total;
  const displayedAssets = listQuery.rows;
  const totalDisplayItems = listQuery.total;
  const totalDisplayPages = listQuery.totalPages;

  // Show 'เพิ่มครุภัณฑ์' button only on "รายการทั้งหมด" and "ใช้งานปกติ" (Approach 1)
  const canCreateAsset =
    activeTab === "ALL" &&
    (selectedStatus === "ALL" || (normalId && selectedStatus === String(normalId)));

  // KPI Cards (เรียงตาม Lifecycle) ใช้ StatCards แบบเดียวกับหน้ายืม-คืน
  const statusIdByCode: Record<string, number | undefined> = {
    NORMAL: normalId,
    DAMAGED: damagedId,
    UNDER_REPAIR: underRepairId,
  };

  const statsSummary: StatCardData[] = [
    {
      id: "total",
      filterKey: "ALL",
      title: "รายการทั้งหมด",
      value: totalAssets,
      icon: Package,
      iconBg: "bg-slate-100",
      iconColor: "text-slate-600",
      valueColor: "text-slate-800",
    },
    {
      id: "normal",
      filterKey: "NORMAL",
      title: "ใช้งานปกติ",
      value: normalCount,
      icon: CheckCircle2,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-600",
    },
    {
      id: "damaged",
      filterKey: "DAMAGED",
      title: "ชำรุด",
      value: damagedCount,
      icon: Wrench,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      valueColor: "text-orange-600",
    },
    {
      id: "underRepair",
      filterKey: "UNDER_REPAIR",
      title: "อยู่ระหว่างซ่อม",
      value: underRepairCount,
      icon: Clock,
      iconBg: "bg-sky-100",
      iconColor: "text-sky-600",
      valueColor: "text-sky-600",
    },
    {
      id: "waitDisposal",
      filterKey: "WAIT_DISPOSAL",
      title: "รอจำหน่าย",
      value: waitDisposalCount,
      icon: Clock,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      valueColor: "text-amber-600",
    },
    {
      id: "disposal",
      filterKey: "DISPOSAL",
      title: "จำหน่ายแล้ว",
      value: disposalCount,
      icon: XCircle,
      iconBg: "bg-slate-100",
      iconColor: "text-slate-500",
      valueColor: "text-slate-600",
    },
    {
      id: "lost",
      filterKey: "LOST",
      title: "สูญหาย",
      value: lostCount,
      icon: AlertTriangle,
      iconBg: "bg-rose-100",
      iconColor: "text-rose-600",
      valueColor: "text-rose-600",
    },
  ];

  const selectedStatKey =
    activeTab !== "ALL"
      ? activeTab
      : selectedStatus === "ALL"
        ? "ALL"
        : (assetStatuses.find((s) => String(s.id) === selectedStatus)?.code ??
          "");

  const handleSelectStat = (key: string) => {
    if (key === "ALL" || key === "WAIT_DISPOSAL" || key === "DISPOSAL" || key === "LOST") {
      handleTabChange(key);
      return;
    }
    const statusId = statusIdByCode[key];
    if (statusId) handleStatusChange(String(statusId));
  };

  const isArchiveTab =
    activeTab === "WAIT_DISPOSAL" ||
    activeTab === "DISPOSAL" ||
    activeTab === "LOST";

  return (
    <div className="flex flex-col h-full space-y-4">
      <QueryStatus query={listQuery} />
      <QueryStatus query={summaryQuery} />
      {/* Stat Cards */}
      <div className="shrink-0">
        <StatCards
          stats={statsSummary}
          selectedCategory={selectedStatKey}
          onSelectCategory={handleSelectStat}
          gridClassName="grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7"
        />
      </div>

      {/* Disposal Warning Banner */}
      {activeTab === "DISPOSAL" && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-slate-100/90 text-slate-600 rounded-lg text-sm border border-slate-200">
          <Info className="h-4 w-4 text-slate-500 shrink-0" />
          <span>
            รายการในหน้านี้ <strong className="font-semibold text-slate-800">"ถูกตัดออกจากทะเบียนพัสดุแล้ว"</strong> ข้อมูลถูกเก็บไว้เพื่อการตรวจสอบประวัติเท่านั้น
          </span>
        </div>
      )}

      {/* Lost Warning Banner */}
      {activeTab === "LOST" && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-slate-100/90 text-slate-600 rounded-lg text-sm border border-slate-200">
          <Info className="h-4 w-4 text-slate-500 shrink-0" />
          <span>
            รายการในหน้านี้ <strong className="font-semibold text-slate-800">"ถูกบันทึกเป็นสูญหายแล้ว"</strong> ข้อมูลถูกเก็บไว้เพื่อการตรวจสอบและดำเนินการทางบัญชี
          </span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 bg-bg-component shadow-sm w-full rounded-lg p-4">
        {/* กรอกคำค้นหา */}
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหารหัส, ชื่อ, หมายเลขเครื่อง..."
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Date Filter (เฉพาะแท็บ รอจำหน่าย / จำหน่ายแล้ว / สูญหาย) */}
          {isArchiveTab && (
            <div className="inline-flex items-center gap-1 w-full sm:w-auto">
              <div
                onClick={() => setIsCalendarOpen(true)}
                className={`relative inline-flex items-center h-10 px-4 rounded-lg border text-sm transition-colors cursor-pointer w-full sm:w-auto ${
                  selectedDate || dateFilterLabel !== "ทั้งหมด"
                    ? "border-emerald-400 bg-emerald-50/50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="text-slate-600 mr-1.5 whitespace-nowrap">
                  วันที่ทำ:
                </span>
                <span className="font-semibold text-emerald-600 whitespace-nowrap">
                  {dateFilterLabel}
                </span>
                <CalendarIcon className="h-4 w-4 text-slate-400 ml-auto sm:ml-3 shrink-0" />
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
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Dropdown ประเภท */}
          <div className="relative inline-flex items-center h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-full sm:w-auto">
            <span className="text-slate-600 mr-1.5 whitespace-nowrap">
              ประเภท:
            </span>
            <span className="font-semibold text-emerald-600 whitespace-nowrap truncate max-w-[100px]">
              {selectedType === "ALL"
                ? "ทั้งหมด"
                : assetTypes.find((t) => String(t.id) === selectedType)?.name}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-auto sm:ml-3 shrink-0" />
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
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

        {/* Action Buttons: Print Report & Add Equipment */}
        <div className="md:ml-auto flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
          <RefreshButton families={["equipment-assets-paginated"]} />
          <button
            type="button"
            onClick={() => setIsPrintDialogOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-emerald-600 text-sm font-medium text-white shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer w-full sm:w-auto"
            title="พิมพ์รายงานสต็อกครุภัณฑ์"
          >
            <Printer className="h-4 w-4" />
            <span>พิมพ์รายงาน</span>
          </button>

          {/* Add Equipment Button (Only for "รายการทั้งหมด" and "ใช้งานปกติ") */}
          {canCreateAsset && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-emerald-600 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              เพิ่มครุภัณฑ์
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden min-h-0">
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
      <SendAssessmentModal />

      {/* Toast Notifications */}
      <ToastContainer />

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

      {/* Equipment Stock Print Dialog */}
      <EquipmentStockPrintDialog
        isOpen={isPrintDialogOpen}
        onClose={() => setIsPrintDialogOpen(false)}
        activeTab={activeTab}
        currentPageAssets={displayedAssets}
        effectiveStatusId={effectiveStatusId}
        selectedTypeId={selectedType}
        searchQuery={debouncedSearch}
        dateRange={dateRange}
        userName={userName}
      />
    </div>
  );
}
