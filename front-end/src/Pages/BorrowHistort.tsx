import { ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import AssetsHistoryTable from "../components/borrow-history/AssetsHistoryTable";

export default function BorrowHistory() {
  const [inputSearch, setInputSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "BORROWED" | "RETURNED">("ALL");

  return (
    <div className="space-y-2">
      {/* search bar */}
      <div className="flex gap-4 bg-bg-component shadow-sm w-full rounded-sm p-4">
        {/* กรอกคำค้นหา */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหา ..."
            onChange={(e) => setInputSearch(e.target.value)}
            value={inputSearch}
            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
          />
        </div>
        {/* drop down สถานะ */}
        <div>
          <div className="relative inline-flex items-center h-8 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer">
            <span className="text-slate-600 mr-1.5">สถานะ:</span>
            <span className="font-semibold text-emerald-600">
              {status === "ALL" ? "ทั้งหมด" : status}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-3" />

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
      <div className=" ">
        <AssetsHistoryTable inputSearch={inputSearch} status={status} />
      </div>
    </div>
  );
}
