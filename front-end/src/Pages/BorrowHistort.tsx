import { ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import AssetsHistoryTable from "../components/borrow-history/AssetsHistoryTable";

export default function BorrowHistory() {
  const [inputSearch, setInputSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "BORROWED" | "RETURNED">("ALL");

  return (
    // 1. กำหนดให้เต็มความสูง (h-full) และเป็น flex-col
    <div className="flex flex-col h-full space-y-4 md:space-y-6">
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

        {/* Dropdown สถานะ */}
        <div className="w-full md:w-auto">
          <div className="relative flex items-center justify-between md:justify-start h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer w-full md:w-auto">
            <div className="flex items-center">
              <span className="text-slate-600 mr-1.5 whitespace-nowrap">
                สถานะ:
              </span>
              <span className="font-semibold text-emerald-600 whitespace-nowrap">
                {/* 3. แก้ไขการแสดงผลข้อความให้เป็นภาษาไทยตรงตาม Option */}
                {status === "ALL"
                  ? "ทั้งหมด"
                  : status === "BORROWED"
                    ? "ยืมแล้ว"
                    : "คืนแล้ว"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-3 shrink-0" />

            {/* ซ่อน select ล่องหนไว้ดักจับคลิก */}
            <select
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "ALL" | "BORROWED" | "RETURNED")
              }
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="BORROWED">ยืมแล้ว</option>
              <option value="RETURNED">คืนแล้ว</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {/* 4. ให้ตารางยืดจนสุดพื้นที่ (flex-1) และเกิด Scroll ภายในตัวเอง (overflow-hidden) */}
      <div className="flex-1 overflow-hidden bg-bg-component rounded-lg shadow-sm border border-slate-100">
        <AssetsHistoryTable inputSearch={inputSearch} status={status} />
      </div>
    </div>
  );
}
