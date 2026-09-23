import { useState, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";
import type { PriorityFilter, AssessmentTab } from "../types/TypeAssessment";
import PendingEvaluationTable from "../components/accept-work/PendingEvaluationTable";
import AssessmentForm from "../components/accept-work/AssessmentForm";
import { useAssessmentStore } from "../stores/useAssessmentModalStore";
import { useAuthStore } from "../stores/authStore";
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
  const closeForm = useAssessmentStore((state) => state.closeForm);
  const { user, token } = useAuthStore();

  useEffect(() => {
    if (!token || !user) {
      closeForm();
    }
    return () => {
      closeForm();
    };
  }, [token, user, closeForm]);

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
    <div className="flex flex-col h-full space-y-4 md:space-y-6">
      {/* Navigation Tabs */}
      <div className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm w-full sm:w-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === "PENDING" && (
          <div className="flex flex-col h-full space-y-4 md:space-y-6">
            {/* Search & Filter Bar */}
            <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 bg-bg-component shadow-sm w-full rounded-lg p-4">
              {/* กรอกคำค้นหา */}
              <div className="relative flex-1 w-full md:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหารหัสงาน, รหัสครุภัณฑ์..."
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
                    {PRIORITY_OPTIONS.find((o) => o.value === priority)
                      ?.label ?? "ทั้งหมด"}
                  </span>
                </div>

                <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />

                <select
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as PriorityFilter)
                  }
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
            <div className="flex-1 overflow-hidden border-none">
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
    </div>
  );
}
