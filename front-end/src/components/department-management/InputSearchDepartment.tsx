import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function InputSearchDepartment({ value, onChange }: Props) {
  return (
    <div className="relative flex-1 w-full md:max-w-md">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1F2937]/40" />
      <input
        type="text"
        placeholder="ชื่อแผนก, รหัสแผนก..."
        onChange={(e) => onChange(e.target.value)}
        value={value}
        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
      />
    </div>
  );
}
