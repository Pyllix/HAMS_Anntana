import {
  ChevronDown,
  Search,
  ClipboardList,
  Clock,
  Repeat,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AssetsHistoryTable from "../components/borrow-history/AssetsHistoryTable";
import { getAllBorrowHistory } from "../services/borrowService";
import StatCards from "../components/borrow-return/StatCards";
import type { StatCardData } from "../components/borrow-return/StatCards";

// จัดกลุ่มสถานะการยืม (borrow status code) สำหรับการ์ดสรุปและ dropdown
const STATUS_GROUPS = [
  {
    key: "PENDING",
    title: "รอดำเนินการ",
    codes: ["PENDING_APPROVAL", "APPROVED"],
    icon: Clock,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    valueColor: "text-amber-600",
  },
  {
    key: "BORROWED",
    title: "กำลังยืม",
    codes: ["BORROWED", "PENDING_VERIFICATION"],
    icon: Repeat,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    valueColor: "text-blue-600",
  },
  {
    key: "RETURNED",
    title: "คืนแล้ว",
    codes: ["RETURNED", "RETURNED_OPERATIONAL", "RETURNED_DAMAGED"],
    icon: CheckCircle2,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
    valueColor: "text-emerald-600",
  },
  {
    key: "CLOSED",
    title: "ปฏิเสธ / ยกเลิก",
    codes: ["REJECTED", "CANCELLED"],
    icon: XCircle,
    iconBg: "bg-rose-50",
    iconColor: "text-rose-500",
    valueColor: "text-rose-600",
  },
];

export default function BorrowHistory() {
  const [inputSearch, setInputSearch] = useState("");
  // กลุ่มสถานะที่เลือกจากการ์ดหรือ dropdown ("ALL" = ไม่กรอง)
  const [statusGroup, setStatusGroup] = useState("ALL");

  const { data: borrowHistory } = useQuery({
    queryKey: ["borrowHistory", "all"],
    queryFn: () => getAllBorrowHistory({ limit: 100 }),
  });

  const statsSummary: StatCardData[] = useMemo(() => {
    const items = borrowHistory ?? [];
    const countGroup = (codes: string[]) =>
      items.filter((item) => codes.includes(item.borrowStatus?.code ?? ""))
        .length;

    return [
      {
        id: "total",
        filterKey: "ALL",
        title: "รายการทั้งหมด",
        value: items.length,
        icon: ClipboardList,
        iconBg: "bg-slate-100",
        iconColor: "text-slate-600",
        valueColor: "text-slate-800",
      },
      ...STATUS_GROUPS.map((g) => ({
        id: g.key,
        filterKey: g.key,
        title: g.title,
        value: countGroup(g.codes),
        icon: g.icon,
        iconBg: g.iconBg,
        iconColor: g.iconColor,
        valueColor: g.valueColor,
      })),
    ];
  }, [borrowHistory]);

  const statusCodes = useMemo(
    () => STATUS_GROUPS.find((g) => g.key === statusGroup)?.codes ?? null,
    [statusGroup],
  );

  const statusLabel =
    STATUS_GROUPS.find((g) => g.key === statusGroup)?.title ?? "ทั้งหมด";

  return (
    // 1. กำหนดให้เต็มความสูง (h-full) และเป็น flex-col
    <div className="flex flex-col h-full space-y-4 md:space-y-6">
      {/* การ์ดสรุปสถานะการยืม-คืน (กดเพื่อกรองตาราง) */}
      <div className="shrink-0">
        <StatCards
          stats={statsSummary}
          selectedCategory={statusGroup}
          onSelectCategory={setStatusGroup}
        />
      </div>

      {/* Search & Filter Bar */}
      {/* 2. ทำให้รองรับจอเล็กด้วย flex-wrap และ md:flex-row */}
      <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 bg-bg-component shadow-sm w-full rounded-lg p-4">
        {/* กรอกคำค้นหา */}
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาประวัติ ..."
            onChange={(e) => setInputSearch(e.target.value)}
            value={inputSearch}
            // ปรับความสูงเป็น h-10 และทำขอบ rounded-lg ให้เข้ากัน
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
          />
        </div>

        {/* Dropdown สถานะ (ซิงก์กับการ์ดสรุป) */}
        <div className="w-full md:w-auto">
          <div className="relative flex items-center justify-between md:justify-start h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-full md:w-auto">
            <div className="flex items-center">
              <span className="text-slate-600 mr-1.5 whitespace-nowrap">
                สถานะ:
              </span>
              <span className="font-semibold text-emerald-600 whitespace-nowrap">
                {statusLabel}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-3 shrink-0" />

            {/* ซ่อน select ล่องหนไว้ดักจับคลิก */}
            <select
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              value={statusGroup}
              onChange={(e) => setStatusGroup(e.target.value)}
            >
              <option value="ALL">ทั้งหมด</option>
              {STATUS_GROUPS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {/* 3. ให้ตารางยืดจนสุดพื้นที่ (flex-1) และเกิด Scroll ภายในตัวเอง (overflow-hidden) */}
      <div className="flex-1 overflow-hidden min-h-[420px]">
        <AssetsHistoryTable
          items={borrowHistory}
          inputSearch={inputSearch}
          statusCodes={statusCodes}
        />
      </div>
    </div>
  );
}
