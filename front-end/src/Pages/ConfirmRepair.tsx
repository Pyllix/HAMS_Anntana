import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import ConfirmRepairTable from "../components/confirm-repair/ConfirmRepairTable";
import ConfirmRepairDialog from "../components/confirm-repair/ConfirmRepairDialog";
import RepairHistoryDetailModal from "../components/repair-history/RepairHistoryDetailModal";
import { RepairStatusFilter } from "../Types/TypeRepairWorkflow";

const statusOptions: Array<{ value: RepairStatusFilter; label: string }> = [
  { value: "ALL", label: "ทั้งหมด" },
  { value: "WAITING_DELIVERY", label: "เสร็จแล้วรอรับคืน" },
  { value: "COMPLETED", label: "ตรวจรับแล้ว" },
];

export default function ConfirmRepair() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RepairStatusFilter>("ALL");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-white p-3.5 shadow-2xs">
        <div className="relative min-w-[240px] flex-1 max-w-xl">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหารหัสงาน ชื่อครุภัณฑ์..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="relative inline-flex h-9 w-52 shrink-0 cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 text-xs transition-colors hover:border-slate-300">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-2">
            <span className="shrink-0 text-slate-500">สถานะ:</span>
            <span className="truncate font-semibold text-emerald-600">
              {statusOptions.find((option) => option.value === status)?.label}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
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

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-2xs">
        <ConfirmRepairTable search={search} status={status} />
      </div>

      <ConfirmRepairDialog />
      <RepairHistoryDetailModal />
    </div>
  );
}
