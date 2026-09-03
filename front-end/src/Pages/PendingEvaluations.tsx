import { useState, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";
import type { PriorityFilter, AssessmentTab } from "../Types/TypeAssessment";
import PendingEvaluationTable from "../components/accept-work/PendingEvaluationTable";
import AssessmentForm from "../components/accept-work/AssessmentForm";
import { useAssessmentStore } from "../stores/useAssessmentModalStore";
import RepairHistory from "./RepairHistory";
import ConfirmRepair from "./ConfirmRepair";

const PRIORITY_OPTIONS: readonly { value: PriorityFilter; label: string }[] = [
  { value: "ALL", label: "ทั้งหมด" },
  { value: "NORMAL", label: "ปกติ" },
  { value: "URGENT", label: "ด่วน" },
  { value: "EMERGENCY", label: "ด่วนมาก" },
];

const TABS: readonly { id: AssessmentTab; label: string }[] = [
  { id: "PENDING", label: "งานแจ้งซ่อม" },
  { id: "REPAIR_LIST", label: "รายการงานซ่อม" },
  { id: "CONFIRM_REPAIR", label: "ยืนยันการซ่อม" },
];

export default function PendingEvaluationsPage() {
  const [activeTab, setActiveTab] = useState<AssessmentTab>("PENDING");
  const [inputSearch, setInputSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [priority, setPriority] = useState<PriorityFilter>("ALL");

  const viewMode = useAssessmentStore((state) => state.viewMode);
  const selectedJob = useAssessmentStore((state) => state.selectedJob);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(inputSearch);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [inputSearch]);

  if (viewMode === "form" && selectedJob) {
    return (
      <div className="p-1">
        <AssessmentForm />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200/80 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Tab Content */}
      {activeTab === "PENDING" && (
        <div className="space-y-4">
          {/* Filter / Search Bar */}
          <div className="flex flex-wrap items-center gap-4 bg-white shadow-sm w-full rounded-lg p-4 border border-slate-100">
            {/* Search input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

              <input
                type="text"
                placeholder="ค้นหาใบแจ้งซ่อม, รหัสครุภัณฑ์..."
                value={inputSearch}
                onChange={(e) => setInputSearch(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>

            {/* Dropdown: ความเร่งด่วน */}
            <div className="relative inline-flex items-center h-8 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-56 shrink-0 justify-between">
              <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                <span className="text-slate-500 shrink-0">
                  ระดับความเร่งด่วน:
                </span>

                <span className="font-semibold text-emerald-600 truncate">
                  {PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ??
                    "ทั้งหมด"}
                </span>
              </div>

              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />

              <select
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityFilter)}
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl overflow-hidden">
            <PendingEvaluationTable
              search={debouncedSearch}
              urgencyStatus={priority}
            />
          </div>
        </div>
      )}

      {/* รายการงานซ่อม */}
      {activeTab === "REPAIR_LIST" && <RepairHistory />}

      {/* ยืนยันการซ่อม */}
      {activeTab === "CONFIRM_REPAIR" && <ConfirmRepair />}
    </div>
  );
}
