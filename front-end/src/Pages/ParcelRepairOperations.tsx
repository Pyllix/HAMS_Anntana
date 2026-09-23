import { useState } from "react";
import SparePartApprovals from "./SparePartApprovals";
import UnrepairableReceipts from "./UnrepairableReceipts";
import OutsourceApprovals from "./OutsourceApprovals";

type ParcelRepairTab = "UNREPAIRABLE" | "SPARE_PARTS" | "OUTSOURCE";

const TABS: readonly { id: ParcelRepairTab; label: string }[] = [
  { id: "UNREPAIRABLE", label: "รับคืนครุภัณฑ์ซ่อมไม่ได้" },
  { id: "SPARE_PARTS", label: "อนุมัติเบิกอะไหล่" },
  { id: "OUTSOURCE", label: "อนุมัติส่งซ่อมภายนอก" },
];

export default function ParcelRepairOperations() {
  const [activeTab, setActiveTab] = useState<ParcelRepairTab>("UNREPAIRABLE");

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4 md:space-y-6">
      <div className="inline-flex w-full shrink-0 items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex min-w-max flex-1 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors sm:flex-initial ${
              activeTab === tab.id
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === "UNREPAIRABLE" && <UnrepairableReceipts embedded />}
        {activeTab === "SPARE_PARTS" && <SparePartApprovals embedded />}
        {activeTab === "OUTSOURCE" && <OutsourceApprovals embedded />}
      </div>
    </div>
  );
}
