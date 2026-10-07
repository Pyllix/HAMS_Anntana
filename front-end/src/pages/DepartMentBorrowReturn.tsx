import { Search, ChevronDown, Repeat, Undo2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getAssetTypes } from "../services/assetService";
import AvailableAssetsTable from "../components/borrow-return/AvailableAssetsTable";
import DepartmentBorrowingsTable from "../components/borrow-return/DepartmentBorrowingsTable";
import RequestReturnModal from "../components/borrow-return/RequestReturnModal";
import SelfBorrowModal from "../components/borrow-return/SelfBorrowModal";
import ToastContainer from "../components/borrow-return/ToastContainer";
import { useRequestReturnModalStore } from "../stores/useRequestReturnModalStore";
import { useSelfBorrowModalStore } from "../stores/useSelfBorrowModalStore";

type TabId = "borrow" | "return";

export default function DepartMentBorrowReturn() {
  const [activeTab, setActiveTab] = useState<TabId>("borrow");
  const [inputSearch, setInputSearch] = useState("");
  const [type, setType] = useState("ALL");
  const { isFormOpen } = useSelfBorrowModalStore();
  const isRequestReturnOpen = useRequestReturnModalStore((s) => s.isFormOpen);

  const { data: assetTypes } = useQuery({
    queryKey: ["assetTypes"],
    queryFn: getAssetTypes,
  });

  const tabs: Array<{ id: TabId; label: string; icon: typeof Repeat }> = [
    { id: "borrow", label: "ยืมครุภัณฑ์", icon: Repeat },
    { id: "return", label: "คืนครุภัณฑ์", icon: Undo2 },
  ];

  return (
    <div className="flex flex-col h-full space-y-4 md:space-y-6">
      {/* Tab Navigation แยกหน้า ยืม / คืน */}
      <div className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm w-full sm:w-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ครุภัณฑ์ที่แผนกยืมอยู่ และใครเป็นผู้ยืม (กดขอคืนได้จากตารางนี้) */}
      {activeTab === "return" && (
        <div className="shrink-0">
          <DepartmentBorrowingsTable />
        </div>
      )}

      {activeTab === "borrow" && (
        <>
          {/* Search & Filter Bar */}
          <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 bg-bg-component shadow-sm w-full rounded-lg p-4">
            {/* กรอกคำค้นหา */}
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาครุภัณฑ์ที่ต้องการยืม ..."
                onChange={(e) => setInputSearch(e.target.value)}
                value={inputSearch}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
              />
            </div>

            {/* Dropdown ประเภท */}
            <div className="relative inline-flex items-center h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-full sm:w-auto">
              <span className="text-slate-600 mr-1.5 whitespace-nowrap">
                ประเภท:
              </span>
              <span className="font-semibold text-emerald-600 whitespace-nowrap truncate max-w-[100px]">
                {type === "ALL" ? "ทั้งหมด" : type}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400 ml-auto sm:ml-3 shrink-0" />
              <select
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="ALL">ทั้งหมด</option>
                {assetTypes?.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table แสดงเฉพาะครุภัณฑ์ของศูนย์ครุภัณฑ์กลางที่ว่างและใช้งานได้เท่านั้น */}
          <div className="flex-1 overflow-hidden min-h-[420px]">
            <AvailableAssetsTable search={inputSearch} typeFilter={type} />
          </div>
        </>
      )}

      {/* Modal */}
      {isFormOpen && <SelfBorrowModal />}
      {isRequestReturnOpen && <RequestReturnModal />}

      {/* Toast แจ้งเตือน */}
      <ToastContainer />
    </div>
  );
}
