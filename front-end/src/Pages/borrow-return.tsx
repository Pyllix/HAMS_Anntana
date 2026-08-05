import { Search } from "lucide-react";

export default function BorrowReturn() {
  return (
    <div className="bg-bg-component shadow-sm w-full rounded-sm p-4">
      {/* search bar */}
      <div className="flex">
        {/* กรอกคำค้นหา */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            className="h-8 w-full bg-slate-100 px-8 border text-sm border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400/20 focus:border-slate-400 transition-all"
          />
        </div>
        {/* drop down สถานะ */}
        <div></div>
        {/* drop down ประเภท */}
        <div></div>
      </div>
      {/* table */}
      <div>
        
      </div>
    </div>
  );
}
