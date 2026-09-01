import React, { useState } from "react";
import { Search, Plus, Trash2, Package } from "lucide-react";

export interface SpareItem {
  id: string | number;
  code?: string;
  name: string;
  location?: string;
  stock: number;
  price: number;
  quantity?: number;
}

interface InternalSpareFieldsProps {
  selectedSpares: SpareItem[];
  setSelectedSpares: React.Dispatch<React.SetStateAction<SpareItem[]>>;
  availableSpares?: SpareItem[];
}

// ข้อมูลจำลอง อะไหล่ในคลัง
const DEFAULT_STOCK_ITEMS: SpareItem[] = [
  {
    id: "1",
    code: "CAP-1000-25",
    name: "Capacitor 1000uF 25V (Electrolytic)",
    location: "ชั้นวาง A-02",
    stock: 15,
    price: 40.0,
  },
  {
    id: "2",
    code: "FUS-10A-250",
    name: "Ceramic Fuse 10A 250V (Fast Blow)",
    location: "ชั้นวาง B-01",
    stock: 8,
    price: 15.0,
  },
  {
    id: "3",
    code: "CAP-0470-50",
    name: "Capacitor 470uF 50V (High Temp)",
    location: "ชั้นวาง A-03",
    stock: 4,
    price: 25.0,
  },
  {
    id: "4",
    code: "RES-10K-025",
    name: "Resistor 10k Ohm 1/4W",
    location: "ชั้นวาง A-01",
    stock: 50,
    price: 5.0,
  },
];

export default function InternalSpareFields({
  selectedSpares = [],
  setSelectedSpares,
  availableSpares = DEFAULT_STOCK_ITEMS,
}: InternalSpareFieldsProps) {
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // ฟังก์ชันเพิ่มรายการอะไหล่
  const handleAddSpare = (item: SpareItem) => {
    const exists = selectedSpares.some((s) => String(s.id) === String(item.id));
    if (!exists) {
      setSelectedSpares((prev) => [...prev, { ...item, quantity: 1 }]);
    }
  };

  // ฟังก์ชันลบรายการอะไหล่
  const handleRemoveSpare = (id: string | number) => {
    setSelectedSpares((prev) =>
      prev.filter((s) => String(s.id) !== String(id)),
    );
  };

  // ฟังก์ชันเปลี่ยนจำนวนที่เบิก
  const handleQuantityChange = (id: string | number, qty: number) => {
    setSelectedSpares((prev) =>
      prev.map((s) =>
        String(s.id) === String(id) ? { ...s, quantity: qty } : s,
      ),
    );
  };

  // กรองอะไหล่ตามคำค้นหา
  const filteredStock = availableSpares.filter((item) => {
    const search = searchTerm.toLowerCase();
    const nameStr = (item.name || "").toLowerCase();
    const codeStr = (item.code || "").toLowerCase();
    const locStr = (item.location || "").toLowerCase();
    return (
      nameStr.includes(search) ||
      codeStr.includes(search) ||
      locStr.includes(search)
    );
  });

  return (
    <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Package className="w-4 h-4 text-emerald-600" />
          รายการอะไหล่ภายในคลังที่ขอเบิก{" "}
          <span className="text-rose-500">*</span>
        </label>
        <span className="text-[11px] text-slate-400">
          เลือกแล้ว {selectedSpares.length} รายการ
        </span>
      </div>

      {/* Dropdown เลือกอะไหล่ */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpenDropdown(!isOpenDropdown)}
          className="w-full bg-white border border-slate-200 hover:border-emerald-500 rounded-lg px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer"
        >
          <span className="text-slate-500 font-medium">
            + คลิกเพื่อเลือกเบิกอะไหล่จากคลัง...
          </span>
          <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-md">
            คลังอะไหล่
          </span>
        </button>

        {isOpenDropdown && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่ออะไหล่, รหัส หรือตำแหน่งจัดเก็บ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              {filteredStock.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400">
                  ไม่พบรายการอะไหล่ในคลัง
                </div>
              ) : (
                filteredStock.map((item) => {
                  const isAdded = selectedSpares.some(
                    (s) => String(s.id) === String(item.id),
                  );

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="space-y-0.5 pr-2">
                        <div className="text-xs font-semibold text-slate-800">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          {item.code && <span>รหัส: {item.code}</span>}
                          {item.location && (
                            <span>ตำแหน่ง: {item.location}</span>
                          )}
                        </div>
                        <div className="text-[11px] font-medium flex items-center gap-3 pt-0.5">
                          <span className="text-emerald-600">
                            คลัง: {item.stock} ชิ้น
                          </span>
                          <span className="text-slate-600 font-mono">
                            {(item.price || 0).toFixed(2)} ฿
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddSpare(item)}
                        disabled={isAdded}
                        className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                          isAdded
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                        }`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {isAdded ? "เลือกแล้ว" : "เบิกอะไหล่"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpenDropdown(false)}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-medium px-2 py-1 cursor-pointer"
              >
                ปิดหน้าต่างเลือก
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ตารางอะไหล่ที่เลือกไว้ */}
      {selectedSpares.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="p-2.5">รายการอะไหล่</th>
                <th className="p-2.5 text-center w-24">คงเหลือ</th>
                <th className="p-2.5 text-center w-28">จำนวนที่เบิก</th>
                <th className="p-2.5 text-right w-24">ราคา/หน่วย</th>
                <th className="p-2.5 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {selectedSpares.map((item) => {
                const matchedStockItem = availableSpares.find(
                  (s) => String(s.id) === String(item.id),
                );

                const name =
                  item.name || matchedStockItem?.name || "ไม่ระบุชื่ออะไหล่";
                const code = item.code || matchedStockItem?.code;
                const stock = item.stock ?? matchedStockItem?.stock ?? 0;
                const price = item.price ?? matchedStockItem?.price ?? 0;
                const qty = item.quantity || 1;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="p-2.5">
                      <div className="font-semibold text-slate-800">{name}</div>
                      {code && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          {code}
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-center text-emerald-600 font-medium">
                      {stock} ชิ้น
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        min={1}
                        max={stock || undefined}
                        value={qty}
                        onChange={(e) =>
                          handleQuantityChange(
                            item.id,
                            parseInt(e.target.value) || 1,
                          )
                        }
                        className="w-16 border border-slate-200 rounded-md py-1 px-2 text-center text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-600">
                      {(price || 0).toFixed(2)} ฿
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveSpare(item.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-md transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
