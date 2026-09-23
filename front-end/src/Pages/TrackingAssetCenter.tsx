import { ChevronDown, Search } from "lucide-react";
import TrackTable from "../components/track/TrackTable";
import { useState } from "react";
import { getAssetTypes } from "../services/assetService";
import { useQuery } from "@tanstack/react-query";
import { getLookUp } from "../services/trackingService";

export default function TrackingAssetCenter({}) {
  // const { data: assetTypes } = useQuery({
  //   queryKey: ["assetTypes"],
  //   queryFn: getAssetTypes,
  // });

  const { data: jobStatuses } = useQuery({
    queryKey: ["repairsLookups"],
    queryFn: getLookUp,
  });

  const [inputSearch, setInputSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  return (
    // 1. เปลี่ยนให้หน้าเพจนี้ใช้ความสูงเต็มพื้นที่ (h-full) และเรียงลงมา (flex-col)
    // เพิ่มระยะห่างระหว่างส่วนค้นหากับตารางให้โปร่งขึ้น
    <div className="flex flex-col h-full space-y-4 md:space-y-6">
      {/* Search & Filter Bar */}
      {/* 2. ทำให้รองรับจอเล็ก (Responsive) จัดเรียงบน-ล่างในจอมือถือ และเรียงซ้าย-ขวาในจอใหญ่ */}
      <div className="shrink-0 flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 bg-bg-component shadow-sm w-full rounded-lg p-4">
        {/* กรอกคำค้นหา */}
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหา ..."
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
              {/* ป้องกันชื่อสถานะยาวเกินไปแล้วทำให้ UI พังด้วย truncate */}
              <span className="font-semibold text-emerald-600 whitespace-nowrap truncate max-w-[150px]">
                {status === "ALL" ? "ทั้งหมด" : status}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-3 shrink-0" />

            {/* <select
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ALL">ทั้งหมด</option>
              {jobStatuses?.jobStatuses?.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select> */}
          </div>
        </div>
      </div>

      {/* Table */}
      {/* 3. ดันตารางให้กินพื้นที่ที่เหลือทั้งหมด (flex-1) พร้อมกับบังคับให้ Scroll เกิดเฉพาะในกล่องนี้ (overflow-hidden) */}
      <div className="flex-1 overflow-hidden min-h-[420px]">
        <TrackTable inputSearch={inputSearch} status={status} />
      </div>
    </div>
  );
}
