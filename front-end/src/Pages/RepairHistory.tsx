import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Package,
  Search,
  Truck,
} from "lucide-react";
import RepairHistoryTable from "../components/repair-history/RepairHistoryTable";
import RepairHistoryDetailModal from "../components/repair-history/RepairHistoryDetailModal";
import {
  RepairActionFilter,
  RepairStatusFilter,
} from "../Types/TypeRepairWorkflow";
import { getRepairHistory } from "../services/repairHistoryService";

const actionOptions: Array<{ value: RepairActionFilter; label: string }> = [
  { value: "ALL", label: "ทั้งหมด" },
  { value: "SELF_REPAIR", label: "ซ่อมเอง" },
  { value: "INTERNAL_STOCK", label: "เบิกอะไหล่ภายใน" },
  { value: "EXTERNAL_STOCK", label: "จัดหาอะไหล่ภายนอก" },
  { value: "OUTSOURCE", label: "ส่งซ่อมภายนอก" },
  { value: "PURCHASE_REPLACEMENT", label: "เสนอซื้อทดแทน" },
];

const statusOptions: Array<{ value: RepairStatusFilter; label: string }> = [
  { value: "ALL", label: "ทั้งหมด" },
  { value: "WAITING_HANDOVER", label: "รอรับเครื่อง" },
  { value: "PENDING_ASSIGN", label: "รอมอบหมายงาน" },
  { value: "IN_PROGRESS", label: "กำลังดำเนินการ" },
  { value: "WAITING_PARTS", label: "สั่งซื้อ / รออะไหล่" },
  { value: "PARCEL_PROCESSING", label: "พัสดุกำลังดำเนินการ" },
  { value: "OUTSOURCED", label: "ส่งซ่อมบริษัทภายนอก" },
  { value: "UNREPAIRABLE", label: "ชำรุด / เสนอซื้อทดแทน" },
  { value: "WAITING_DELIVERY", label: "เสร็จแล้วรอรับคืน" },
  { value: "COMPLETED", label: "ปิดงานแล้ว" },
  { value: "CANCELLED", label: "ยกเลิก" },
];

export default function RepairHistory() {
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState<RepairActionFilter>("ALL");
  const [status, setStatus] = useState<RepairStatusFilter>("ALL");

  const { data: jobs = [] } = useQuery({
    queryKey: ["repairHistory"],
    queryFn: getRepairHistory,
  });

  const summary = useMemo(
    () => ({
      all: jobs.length,
      inProgress: jobs.filter((job) =>
        ["IN_PROGRESS", "WAITING_DELIVERY"].includes(
          job.status?.statusCode || "",
        ),
      ).length,
      waiting: jobs.filter((job) =>
        ["WAITING_PARTS", "PARCEL_PROCESSING"].includes(
          job.status?.statusCode || "",
        ),
      ).length,
      external: jobs.filter((job) =>
        ["OUTSOURCED", "UNREPAIRABLE"].includes(job.status?.statusCode || ""),
      ).length,
    }),
    [jobs],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="ประเมินแล้วทั้งหมด"
          value={summary.all}
          icon={CheckCircle2}
          color="emerald"
        />
        <SummaryCard
          label="กำลังดำเนินการ"
          value={summary.inProgress}
          icon={Clock3}
          color="blue"
        />
        <SummaryCard
          label="รออะไหล่ / รออนุมัติ"
          value={summary.waiting}
          icon={Package}
          color="amber"
        />
        <SummaryCard
          label="ส่งซ่อมภายนอก / ซื้อทดแทน"
          value={summary.external}
          icon={Truck}
          color="violet"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-white p-3.5 shadow-2xs">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหารหัสงาน ชื่อครุภัณฑ์ หรืออาการที่แจ้ง..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <FilterSelect
          label="ผลการประเมิน"
          value={actionType}
          options={actionOptions}
          onChange={(value) => setActionType(value as RepairActionFilter)}
        />
        <FilterSelect
          label="สถานะ"
          value={status}
          options={statusOptions}
          onChange={(value) => setStatus(value as RepairStatusFilter)}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-2xs">
        <RepairHistoryTable
          search={search}
          actionType={actionType}
          status={status}
        />
      </div>

      <RepairHistoryDetailModal />
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  color: "emerald" | "blue" | "amber" | "violet";
}

function SummaryCard({ label, value, icon: Icon, color }: SummaryCardProps) {
  const colorClasses = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colorClasses[color]}`}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div>
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="mt-0.5 text-lg font-bold text-slate-900">
          {value}{" "}
          <span className="text-xs font-medium text-slate-500">งาน</span>
        </p>
      </div>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label;
  return (
    <div className="relative inline-flex h-9 w-56 shrink-0 cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 text-xs transition-colors hover:border-slate-300">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-2">
        <span className="shrink-0 text-slate-500">{label}:</span>
        <span className="truncate font-semibold text-emerald-600">
          {selectedLabel || "ทั้งหมด"}
        </span>
      </div>
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
