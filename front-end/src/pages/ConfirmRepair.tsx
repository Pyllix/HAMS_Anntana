import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import ConfirmRepairTable from "../components/confirm-repair/ConfirmRepairTable";
import ConfirmRepairDialog from "../components/confirm-repair/ConfirmRepairDialog";
import RepairHistoryDetailModal from "../components/repair-history/RepairHistoryDetailModal";
import { RepairStatusFilter } from "../types/TypeRepairWorkflow";

const statusOptions: Array<{ value: RepairStatusFilter; label: string }> = [
  { value: "ALL", label: "ทั้งหมด" },
  { value: "WAITING_DELIVERY", label: "เสร็จแล้วรอรับคืน" },
  { value: "COMPLETED", label: "ตรวจรับแล้ว" },
];

export default function ConfirmRepair() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RepairStatusFilter>("ALL");

  return (
    <div className="flex flex-col h-full space-y-4 md:space-y-6">
      {/* Search & Filter Bar */}
      {/* 2. ทำให้รองรับจอเล็กด้วย flex-wrap และ md:flex-row */}
      <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 bg-bg-component shadow-sm w-full rounded-lg p-4">
        {/* กรอกคำค้นหา */}
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหารหัสงาน ชื่อครุภัณฑ์..."
            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>

        <div className="relative inline-flex items-center h-8 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-56 shrink-0 justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            <span className="text-slate-500 shrink-0">สถานะ: </span>
            <span className="font-semibold text-emerald-600 truncate">
              {statusOptions.find((option) => option.value === status)?.label}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            aria-label="สถานะการยืนยัน"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as RepairStatusFilter)
            }
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-hidden border-none">
        <ConfirmRepairTable search={search} status={status} />
      </div>

      <ConfirmRepairDialog />
      <RepairHistoryDetailModal />
    </div>
  );
}
