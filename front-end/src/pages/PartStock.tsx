import RefreshButton from "../components/shared/RefreshButton";
import { useForegroundQuery } from "../hooks/useServerPage";
import { getSummary } from "../services/pagedApi";
import type { SpareSummary } from "../services/pagedApi";
import QueryStatus from "../components/shared/QueryStatus";
import { getLocalSparepartDrafts } from "../services/sparepartService";
import { useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  Plus,
  HardDriveDownload,
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSparepartGroups, getSpareParts } from "../services/sparepartService";
import { getSparePartStatus } from "../types/TypeSparePart";
import SparePartTable, { LocalSpareDraftTable } from "../components/spare-part/SparePartTable";
import StatCards from "../components/borrow-return/StatCards";
import type { StatCardData } from "../components/borrow-return/StatCards";
import {
  SparePartDetailModal,
  SparePartFormModal,
  SparePartDeleteModal,
} from "../components/spare-part/SparePartModals";
import { SparePartReturnModal } from "../components/spare-part/SparePartReturnModal";
import {
  useSparePartFormModalStore,
  useSparePartReturnModalStore,
} from "../stores/useSparePartModalStore";
import { useAuthStore } from "../stores/authStore";

export default function PartStock() {
  const role = useAuthStore((state) => state.role);
  // จัดการสต็อกอะไหล่ได้เฉพาะเจ้าหน้าที่พัสดุ
  const canManage = role === "PARCEL_STAFF";

  const [inputSearch, setInputSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [stockStatus, setStockStatus] = useState("ALL");

  const { data: groups } = useQuery({
    queryKey: ["sparepartGroups"],
    queryFn: getSparepartGroups,
  });

  // query key เดียวกับ SparePartTable จึงแชร์ cache กัน ไม่ยิงซ้ำ
  const summaryQuery = useForegroundQuery(["spareParts", "summary"],
    (signal) => getSummary<SpareSummary>("/spare-parts/summary", {}, signal), true);
  const stockSummary = summaryQuery.data;
  const draftsQuery = useForegroundQuery(["spareParts", "local-drafts"], () => Promise.resolve(getLocalSparepartDrafts()));
  const localDrafts = draftsQuery.data ?? [];

  const availableGroups = groups ?? [];

  const stockStatusOptions = [
    { value: "ALL", label: "ทั้งหมด" },
    { value: "NORMAL", label: "ปกติ" },
    { value: "LOW", label: "ต้องสั่งเพิ่ม" },
    { value: "OUT", label: "ของหมด" },
  ];

  const statsSummary: StatCardData[] = useMemo(() => {
    const countByStatus = (status: string) => stockSummary?.byStockStatus[status] ?? (stockSummary ? 0 : undefined);

    return [
      {
        id: "total",
        filterKey: "ALL",
        title: "อะไหล่ทั้งหมด",
        value: stockSummary?.total,
        icon: Package,
        iconBg: "bg-slate-100",
        iconColor: "text-slate-600",
        valueColor: "text-slate-800",
      },
      {
        id: "normal",
        filterKey: "NORMAL",
        title: "ปกติ",
        value: countByStatus("NORMAL"),
        icon: CheckCircle2,
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-600",
        valueColor: "text-emerald-600",
      },
      {
        id: "low",
        filterKey: "LOW",
        title: "ต้องสั่งเพิ่ม",
        value: countByStatus("LOW"),
        icon: AlertTriangle,
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        valueColor: "text-amber-600",
      },
      {
        id: "out",
        filterKey: "OUT",
        title: "ของหมด",
        value: countByStatus("OUT"),
        icon: XCircle,
        iconBg: "bg-rose-100",
        iconColor: "text-rose-600",
        valueColor: "text-rose-600",
      },
    ];
  }, [stockSummary]);

  return (
    <div className="flex flex-col h-full space-y-4 md:space-y-6">
      <QueryStatus query={summaryQuery} />
      {localDrafts.length > 0 && <div role="status" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
        <p>ข้อมูลอะไหล่ที่บันทึกในเครื่อง ยังไม่ยืนยันกับเซิร์ฟเวอร์ (ไม่นับรวมในยอด)</p>
        <LocalSpareDraftTable rows={localDrafts} />
      </div>}
      {/* Stat Cards */}
      <div className="shrink-0">
        <StatCards
          stats={statsSummary}
          selectedCategory={stockStatus}
          onSelectCategory={setStockStatus}
          gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 bg-bg-component shadow-sm w-full rounded-lg p-4">
        {/* กรอกคำค้นหา */}
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหารหัส, ชื่ออะไหล่..."
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Dropdown หมวดหมู่ */}
          <div className="relative inline-flex items-center h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-full sm:w-auto">
            <span className="text-slate-600 mr-1.5 whitespace-nowrap">
              หมวดหมู่:
            </span>
            <span className="font-semibold text-emerald-600 whitespace-nowrap truncate max-w-[100px]">
              {category === "ALL" ? "ทั้งหมด" : category}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-auto sm:ml-3 shrink-0" />
            <select
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="ALL">ทั้งหมด</option>
              {availableGroups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown สถานะ */}
          <div className="relative inline-flex items-center h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-full sm:w-auto">
            <span className="text-slate-600 mr-1.5 whitespace-nowrap">
              สถานะ:
            </span>
            <span className="font-semibold text-emerald-600 whitespace-nowrap truncate max-w-[100px]">
              {stockStatusOptions.find((o) => o.value === stockStatus)?.label ??
                "ทั้งหมด"}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-auto sm:ml-3 shrink-0" />
            <select
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value)}
            >
              {stockStatusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="md:ml-auto flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <RefreshButton families={["spareParts"]} />
          {/* Add Buttons - แสดงเฉพาะผู้มีสิทธิ์จัดการสต็อกอะไหล่ */}
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => useSparePartFormModalStore.getState().openAdd()}
                className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-emerald-600 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                เพิ่มอะไหล่ใหม่
              </button>

              {/* ปุ่มบันทึกรับคืน */}
              <button
                type="button"
                onClick={() =>
                  useSparePartReturnModalStore.getState().openModal(null as any)
                }
                className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 h-10 px-4 rounded-lg border border-emerald-600 bg-white text-sm font-medium text-emerald-700 shadow-sm hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                <HardDriveDownload className="h-4 w-4 stroke-[2.5]" />
                บันทึกรับคืน
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden min-h-[420px]">
        <SparePartTable
          search={inputSearch}
          category={category}
          stockStatus={stockStatus}
        />
      </div>

      {/* Modals */}
      <SparePartDetailModal />
      <SparePartFormModal />
      <SparePartDeleteModal />
      <SparePartReturnModal />
    </div>
  );
}
