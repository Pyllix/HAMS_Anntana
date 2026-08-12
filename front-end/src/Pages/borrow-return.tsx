import { ChevronDown, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAssetTypes, getAvailabilities } from "../services/assetService";
import AssetsTable from "../components/borrow-return/assetsTable";
import { useState } from "react";
import BorrowModal from "../components/borrow-return/borrowModal";
import { useBorrowModalStore } from "../stores/useBorrowModalStore";

export default function BorrowReturn() {
  const { data: assetTypes } = useQuery({
    queryKey: ["assetTypes"],
    queryFn: getAssetTypes,
  });

  const { data: availabilities } = useQuery({
    queryKey: ["availabilities"],
    queryFn: getAvailabilities,
  });

  const [inputSearch, setInputSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [type, setType] = useState("ALL");
  const { isFormOpen } = useBorrowModalStore();
  

  return (
    <div className="space-y-4">
      {/* search bar */}
      <div className="flex gap-4 bg-bg-component shadow-sm w-full rounded-sm p-4">
        {/* กรอกคำค้นหา */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ, อีเมล หรือรหัสพนักงาน..."
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
              {category === "ALL" ? "ทั้งหมด" : category}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-3" />

            {/* ซ่อน select ล่องหนไว้ดักจับคลิก */}
            <select
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="ALL">ทั้งหมด</option>
              {availabilities?.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {/* drop down ประเภท */}
        <div>
          <div className="relative inline-flex items-center h-8 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer">
            <span className="text-slate-600 mr-1.5">ประเภท:</span>
            <span className="font-semibold text-emerald-600">
              {type === "ALL" ? "ทั้งหมด" : type}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 ml-3" />
            <select
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="ALL">ทั้งหมด</option>
              {assetTypes?.map((type) => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {/* Table */}
      <div className="bg-bg-component shadow-sm w-full rounded-sm ">
        <AssetsTable search={inputSearch} category={category} type={type} />
      </div>

      {/* เรียกใช้ Modal ที่นี่ */}
      {isFormOpen && <BorrowModal />}
    </div>
  );
}
