import { Plus, Check, Clock, X, FileCheck, LucideIcon } from "lucide-react";

export interface StatCardData {
  id: string;
  filterKey: string; // ส่งค่าสำหรับ filter กลับไปที่ category
  title: string;
  value: number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}

interface StatCardsProps {
  stats: StatCardData[];
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}

export default function StatCards({
  stats,
  selectedCategory,
  onSelectCategory,
}: StatCardsProps) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((item) => {
          const Icon = item.icon;
          const isSelected = selectedCategory === item.filterKey;

          return (
            <div
              key={item.id}
              onClick={() => onSelectCategory?.(item.filterKey)}
              className={`bg-white border rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-all cursor-pointer ${
                isSelected
                  ? "border-emerald-500 ring-2 ring-emerald-200"
                  : "border-slate-200/80 hover:shadow-md"
              }`}
            >
              {/* Icon Box */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg}`}
              >
                <Icon className={`w-6 h-6 stroke-[2.5] ${item.iconColor}`} />
              </div>

              {/* Text / Value */}
              <div className="flex flex-col">
                <span className="text-xs font-medium text-slate-400">
                  {item.title}
                </span>
                <span
                  className={`text-2xl font-bold tracking-tight ${item.valueColor}`}
                >
                  {item.value.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
