import { useState } from "react";
import { Search, Plus, Trash2, Package, Loader2, Box, ShoppingCart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { SparePart } from "../../Types/TypeAssessment";
import { getSpareParts } from "../../services/assessmentService";

export interface SelectedSpareItem extends Partial<SparePart> {
  sparepartId: number; // ต้องเป็น positive integer เสมอ
  name: string;
  quantity: number;
  stockType: "INTERNAL" | "EXTERNAL";
}

interface InternalSpareFieldsProps {
  selectedSpares: SelectedSpareItem[];
  setSelectedSpares: React.Dispatch<React.SetStateAction<SelectedSpareItem[]>>;
  availableSpares?: SparePart[];
}

export default function InternalSpareFields({
  selectedSpares = [],
  setSelectedSpares,
  availableSpares: propAvailableSpares,
}: InternalSpareFieldsProps) {
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: apiSpares, isLoading } = useQuery<SparePart[]>({
    queryKey: ["spareParts"],
    queryFn: getSpareParts,
    enabled: !propAvailableSpares,
  });

  const rawSpares = propAvailableSpares || apiSpares;

  const availableSpares: SparePart[] = Array.isArray(rawSpares)
    ? rawSpares
    : (rawSpares as unknown as { data: SparePart[] })?.data &&
      Array.isArray((rawSpares as unknown as { data: SparePart[] }).data)
      ? (rawSpares as unknown as { data: SparePart[] }).data
      : [];

  // เพิ่มรายการอะไหล่
  const handleAddSpare = (item: SparePart) => {
    const numericId = Number(item.id);
    if (!numericId || numericId <= 0) return;

    const exists = selectedSpares.some((s) => s.sparepartId === numericId);

    if (!exists) {
      const isOutOfStock = (item.qtyInStock ?? 0) <= 0;
      setSelectedSpares((prev) => [
        ...prev,
        {
          ...item,
          sparepartId: numericId,
          quantity: 1,
          stockType: isOutOfStock ? "EXTERNAL" : "INTERNAL",
        },
      ]);
      setSearchTerm("");
    }
  };

  const handleRemoveSpare = (indexToRemove: number) => {
    setSelectedSpares((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleQuantityChange = (indexToUpdate: number, qty: number) => {
    setSelectedSpares((prev) =>
      prev.map((item, index) =>
        index === indexToUpdate ? { ...item, quantity: qty } : item
      )
    );
  };

  const handleStockTypeChange = (
    indexToUpdate: number,
    stockType: "INTERNAL" | "EXTERNAL"
  ) => {
    setSelectedSpares((prev) =>
      prev.map((item, index) =>
        index === indexToUpdate ? { ...item, stockType } : item
      )
    );
  };

  const filteredStock = availableSpares.filter((item) => {
    const search = searchTerm.toLowerCase();
    const nameStr = (item.name || "").toLowerCase();
    const codeStr = (item.code || "").toLowerCase();
    return nameStr.includes(search) || codeStr.includes(search);
  });

  return (
    <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Package className="w-4 h-4 text-emerald-600" />
          รายการอะไหล่ที่ขอเบิก <span className="text-rose-500">*</span>
        </label>

        <span className="text-[11px] text-slate-400">
          เลือกแล้ว {selectedSpares.length} รายการ
        </span>
      </div>

      {/* Dropdown ค้นหาและเลือกอะไหล่ */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpenDropdown(!isOpenDropdown)}
          className="w-full bg-white border border-slate-200 hover:border-emerald-500 rounded-lg px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer"
        >
          <span className="text-slate-500 font-medium">
            + คลิกเพื่อเลือกรายการอะไหล่...
          </span>
          <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-md">
            ในคลัง / ภายนอก
          </span>
        </button>

        {isOpenDropdown && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่ออะไหล่ หรือรหัสอะไหล่..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  กำลังโหลดรายการอะไหล่...
                </div>
              ) : filteredStock.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  ไม่พบรายการอะไหล่ตรงกับคำค้นหา
                </div>
              ) : (
                filteredStock.map((item) => {
                  const itemId = Number(item.id);
                  const isAdded = selectedSpares.some(
                    (s) => s.sparepartId === itemId
                  );
                  const itemPrice = Number(item.price ?? 0);
                  const stockQty = item.qtyInStock ?? 0;
                  const isOutOfStock = stockQty <= 0;

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
                        </div>
                        <div className="text-[11px] font-medium flex items-center gap-3 pt-0.5">
                          <span
                            className={
                              isOutOfStock
                                ? "text-amber-600 font-semibold"
                                : "text-emerald-600"
                            }
                          >
                            คงเหลือ: {stockQty} {item.unit || "ชิ้น"}
                            {isOutOfStock && " (สินค้าหมด)"}
                          </span>
                          <span className="text-slate-600 font-mono">
                            {itemPrice.toFixed(2)} ฿
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
                        {isAdded ? "เลือกแล้ว" : "เพิ่มรายการ"}
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

      {/* ตารางแสดงรายการที่เลือก */}
      {selectedSpares.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="p-3">รายการอะไหล่</th>
                <th className="p-3 text-center w-36">แหล่งอะไหล่</th>
                <th className="p-3 text-center w-28">คงเหลือคลัง</th>
                <th className="p-3 text-center w-28">จำนวนที่เบิก</th>
                <th className="p-3 text-right w-28">ราคา/หน่วย</th>
                <th className="p-3 text-right w-28">ราคารวม</th>
                <th className="p-3 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {selectedSpares.map((item, index) => {
                const priceNum = Number(item.price ?? 0);
                const stockQty = item.qtyInStock ?? 0;
                const qty = item.quantity || 1;
                const totalPrice = priceNum * qty;
                const isOverStock = item.stockType === "INTERNAL" && qty > stockQty;

                return (
                  <tr key={item.sparepartId} className="hover:bg-slate-50/50">
                    {/* รายการอะไหล่ */}
                    <td className="p-3 align-middle">
                      <div className="font-semibold text-slate-800 leading-snug">
                        {item.name}
                      </div>
                      {item.code && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {item.code}
                        </div>
                      )}
                    </td>

                    {/* แหล่งอะไหล่ */}
                    <td className="p-3 text-center align-middle">
                      <div className="relative inline-block w-full max-w-[130]">
                        <select
                          value={item.stockType}
                          onChange={(e) =>
                            handleStockTypeChange(
                              index,
                              e.target.value as "INTERNAL" | "EXTERNAL"
                            )
                          }
                          className={`w-full appearance-none rounded-full px-7 py-1.5 text-xs font-medium border focus:outline-none cursor-pointer transition-colors ${
                            item.stockType === "INTERNAL"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300"
                              : "bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-300"
                          }`}
                        >
                          <option value="INTERNAL">ในคลัง</option>
                          <option value="EXTERNAL">จัดหาภายนอก</option>
                        </select>
                        <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
                          {item.stockType === "INTERNAL" ? (
                            <Box className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                          )}
                        </div>
                        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                          ▼
                        </div>
                      </div>
                    </td>

                    {/* คงเหลือคลัง */}
                    <td className="p-3 text-center align-middle font-medium text-slate-600">
                      {stockQty} {item.unit || "ชิ้น"}
                    </td>

                    {/* จำนวนที่เบิก */}
                    <td className="p-3 text-center align-middle">
                      <div className="flex flex-col items-center">
                        <input
                          type="number"
                          min={1}
                          value={qty}
                          onChange={(e) =>
                            handleQuantityChange(
                              index,
                              parseInt(e.target.value) || 1
                            )
                          }
                          className={`w-16 rounded-lg py-1 px-2 text-center text-xs font-semibold border focus:outline-none transition-colors ${
                            isOverStock
                              ? "border-rose-400 bg-rose-50 text-rose-600 focus:border-rose-500"
                              : "border-emerald-500 bg-white text-slate-700 focus:border-emerald-600"
                          }`}
                        />
                        {isOverStock && (
                          <span className="text-[10px] font-bold text-rose-500 mt-0.5">
                            เกินสต็อก!
                          </span>
                        )}
                      </div>
                    </td>

                    {/* ราคา/หน่วย */}
                    <td className="p-3 text-right align-middle font-mono text-slate-600">
                      {priceNum.toFixed(2)} ฿
                    </td>

                    {/* ราคารวม */}
                    <td className="p-3 text-right align-middle font-mono font-semibold text-slate-700">
                      {totalPrice.toFixed(2)} ฿
                    </td>

                    {/* ปุ่มลบ */}
                    <td className="p-3 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => handleRemoveSpare(index)}
                        className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
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