import { ChevronDown } from "lucide-react";

export type StatusFilterValue = "" | "active" | "banned";

interface Props {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}

export default function StatusFilter({ value, onChange }: Props) {
  return (
    <div className="relative flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 pl-4 pr-9 text-sm text-slate-700">
      <span className="pointer-events-none">สถานะ:</span>
      <span className="pointer-events-none font-bold text-emerald-600">
        {value === "active" ? "ใช้งานปกติ" : value === "banned" ? "ระงับการใช้งาน" : "ทั้งหมด"}
      </span>
      <select
        aria-label="กรองสถานะผู้ใช้"
        value={value}
        onChange={(e) => onChange(e.target.value as StatusFilterValue)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        <option value="">ทั้งหมด</option>
        <option value="active">ใช้งานปกติ</option>
        <option value="banned">ระงับการใช้งาน</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-[#1F2937]/40" />
    </div>
  );
}
